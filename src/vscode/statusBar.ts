import * as vscode from 'vscode';
import { FileAnalysis } from '../engine';

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem('codecomplexity.status', vscode.StatusBarAlignment.Right, 100);
        this.item.name = 'Complexity Guard';
        this.item.command = 'codecomplexity.showReport';
    }

    showAnalyzing(): void {
        this.item.text = '$(sync~spin) Complexity';
        this.item.tooltip = 'Analysing…';
        this.item.backgroundColor = undefined;
        this.item.show();
    }

    showResult(analysis: FileAnalysis): void {
        const g = analysis.fileRating.grade;
        const counts = analysis.totals.gradeCounts;
        const issues = counts.C + counts.D;
        const icon = g === 'D' ? '$(error)' : g === 'C' ? '$(warning)' : '$(pass)';
        this.item.text = `${icon} ${g} · ${issues === 0 ? 'all clear' : `${issues} to review`}`;
        this.item.tooltip = new vscode.MarkdownString(
            `**Complexity Guard** — ${analysis.fileRating.label}\n\n${analysis.fileRating.summary}\n\n` +
                `${analysis.totals.functionCount} functions · avg cyclomatic ${analysis.totals.avgCyclomatic} · worst time ${analysis.totals.worstTime?.notation ?? 'O(1)'}\n\nClick to open the report.`,
        );
        this.item.backgroundColor = g === 'D' ? new vscode.ThemeColor('statusBarItem.errorBackground') : g === 'C' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
        this.item.show();
    }

    showUnsupported(): void {
        this.item.hide();
    }

    dispose(): void {
        this.item.dispose();
    }
}
