/**
 * Sidebar: every function of the active file, worst first, with metrics and
 * suggestions as children. Clicking an item jumps to the code.
 */
import * as vscode from 'vscode';
import { FileAnalysis, FunctionAnalysis, Suggestion } from '../engine';
import { AnalysisService } from './analysisService';
import { getSettings } from './config';
import { cognitiveHint, cyclomaticHint, gradeIcon } from './format';

type Item = FunctionItem | MetricItem | SuggestionItem | MessageItem;

class FunctionItem extends vscode.TreeItem {
    constructor(readonly fn: FunctionAnalysis, readonly uri: vscode.Uri) {
        super(fn.qualifiedName, fn.rating.grade === 'A' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded);
        this.description = `${fn.rating.grade} · cyc ${fn.cyclomatic} · cog ${fn.cognitive} · ${fn.time.notation}`;
        this.tooltip = `${fn.rating.label}: ${fn.rating.summary}\nLine ${fn.nameLine + 1}`;
        this.iconPath = gradeIcon(fn.rating.grade);
        this.contextValue = 'function';
        this.command = { command: 'codecomplexity.revealLine', title: 'Go to function', arguments: [uri.toString(), fn.nameLine] };
    }
}

class MetricItem extends vscode.TreeItem {
    constructor(label: string, value: string, hint: string, icon: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = `${value} — ${hint}`;
        this.tooltip = `${label}: ${value}\n${hint}`;
        this.iconPath = new vscode.ThemeIcon(icon);
    }
}

class SuggestionItem extends vscode.TreeItem {
    constructor(readonly suggestion: Suggestion, fn: FunctionAnalysis, uri: vscode.Uri) {
        super(suggestion.title, vscode.TreeItemCollapsibleState.None);
        this.description = suggestion.impact ?? suggestion.category;
        this.tooltip = `${suggestion.problem}\n\nFix: ${suggestion.fix}`;
        this.iconPath = new vscode.ThemeIcon(
            suggestion.severity === 'critical' ? 'error' : suggestion.severity === 'warning' ? 'warning' : 'lightbulb',
            new vscode.ThemeColor(suggestion.severity === 'critical' ? 'list.errorForeground' : suggestion.severity === 'warning' ? 'list.warningForeground' : 'charts.blue'),
        );
        this.command = { command: 'codecomplexity.showSuggestionsPanel', title: 'Show', arguments: [uri.toString(), fn.name, fn.startLine, suggestion.id] };
    }
}

class MessageItem extends vscode.TreeItem {
    constructor(label: string, icon = 'info') {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
    }
}

export class FunctionsTreeProvider implements vscode.TreeDataProvider<Item>, vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<Item | undefined>();
    readonly onDidChangeTreeData = this.emitter.event;
    private current: { uri: vscode.Uri; analysis: FileAnalysis } | undefined;
    private readonly subscriptions: vscode.Disposable[] = [];

    constructor(private readonly service: AnalysisService) {
        this.subscriptions.push(
            service.onDidAnalyze(({ uri, result }) => {
                const active = vscode.window.activeTextEditor;
                if (active && active.document.uri.toString() === uri.toString()) {
                    this.current = { uri, analysis: result };
                    this.emitter.fire(undefined);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (!editor) {
                    return;
                }
                const cached = this.service.getCached(editor.document.uri);
                this.current = cached ? { uri: editor.document.uri, analysis: cached } : undefined;
                this.emitter.fire(undefined);
            }),
        );
    }

    refresh(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const cached = this.service.getCached(editor.document.uri);
            this.current = cached ? { uri: editor.document.uri, analysis: cached } : undefined;
        }
        this.emitter.fire(undefined);
    }

    getTreeItem(element: Item): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Item): Item[] {
        if (!element) {
            if (!this.current) {
                return [];
            }
            const fns = this.current.analysis.functions.filter((f) => !f.ignored);
            if (fns.length === 0) {
                return [new MessageItem('No functions found in this file.')];
            }
            const order = { D: 0, C: 1, B: 2, A: 3 };
            return [...fns].sort((a, b) => order[a.rating.grade] - order[b.rating.grade] || a.startLine - b.startLine).map((f) => new FunctionItem(f, this.current!.uri));
        }
        if (element instanceof FunctionItem) {
            const t = getSettings().thresholds;
            const f = element.fn;
            const items: Item[] = [
                new MetricItem('Cyclomatic', String(f.cyclomatic), cyclomaticHint(f.cyclomatic, t), 'git-merge'),
                new MetricItem('Cognitive', String(f.cognitive), cognitiveHint(f.cognitive, t), 'eye'),
                new MetricItem('Time', f.time.notation, f.time.label, 'watch'),
                new MetricItem('Space', f.space.notation, f.space.label, 'database'),
                new MetricItem('Size', `${f.lineCount} lines`, `${f.parameterCount} parameters, nesting ${f.maxNesting}`, 'symbol-ruler'),
            ];
            for (const s of f.suggestions) {
                items.push(new SuggestionItem(s, f, element.uri));
            }
            return items;
        }
        return [];
    }

    dispose(): void {
        this.emitter.dispose();
        for (const s of this.subscriptions) {
            s.dispose();
        }
    }
}
