/**
 * Light-bulb actions on function lines and on our diagnostics.
 */
import * as vscode from 'vscode';
import { AnalysisService } from './analysisService';
import { DIAGNOSTIC_SOURCE, DiagnosticsManager } from './diagnostics';

export class ComplexityCodeActionProvider implements vscode.CodeActionProvider {
    static readonly kinds = [vscode.CodeActionKind.QuickFix];

    constructor(private readonly service: AnalysisService, private readonly diagnostics: DiagnosticsManager) {}

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const uri = document.uri.toString();
        const seen = new Set<string>();

        for (const diag of context.diagnostics) {
            if (diag.source !== DIAGNOSTIC_SOURCE) {
                continue;
            }
            const data = this.diagnostics.dataFor(diag);
            if (!data) {
                continue;
            }
            const key = `${data.functionName}:${data.suggestionId ?? 'grade'}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const action = new vscode.CodeAction(
                data.suggestionId ? `💡 Show how to fix: ${String(diag.code)}` : `📊 Explain why ${data.functionName} is rated this way`,
                vscode.CodeActionKind.QuickFix,
            );
            action.diagnostics = [diag];
            action.isPreferred = true;
            action.command = { command: 'codecomplexity.showSuggestionsPanel', title: 'Show', arguments: [uri, data.functionName, data.startLine, data.suggestionId] };
            actions.push(action);
        }

        const analysis = this.service.getCached(document.uri);
        if (analysis) {
            const f = analysis.functions.find((x) => range.start.line >= x.startLine && range.start.line <= x.endLine);
            if (f && !f.ignored) {
                if (actions.length === 0) {
                    const show = new vscode.CodeAction(`📊 Complexity breakdown for ${f.name} (${f.rating.grade} · ${f.time.notation})`, vscode.CodeActionKind.QuickFix);
                    show.command = { command: 'codecomplexity.showSuggestionsPanel', title: 'Show', arguments: [uri, f.name, f.startLine] };
                    actions.push(show);
                }
                if (f.rating.grade === 'C' || f.rating.grade === 'D' || f.suggestions.length > 0) {
                    const ignore = new vscode.CodeAction(`🚫 Ignore ${f.name} in complexity checks`, vscode.CodeActionKind.QuickFix);
                    ignore.command = { command: 'codecomplexity.ignoreWarning', title: 'Ignore', arguments: [uri, f.startLine] };
                    actions.push(ignore);
                }
            }
        }
        if (actions.length > 0) {
            const cfg = new vscode.CodeAction('⚙️ Configure complexity thresholds', vscode.CodeActionKind.QuickFix);
            cfg.command = { command: 'codecomplexity.configureThreshold', title: 'Configure' };
            actions.push(cfg);
        }
        return actions;
    }
}

/** Inserts the ignore marker above a function. */
export async function ignoreFunction(uri: vscode.Uri, startLine: number, lineComment: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    if (startLine < 0 || startLine >= document.lineCount) {
        return;
    }
    const target = document.lineAt(startLine);
    const indent = target.text.match(/^\s*/)?.[0] ?? '';
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(startLine, 0), `${indent}${lineComment} codecomplexity: ignore\n`);
    const ok = await vscode.workspace.applyEdit(edit);
    if (ok) {
        void vscode.window.showInformationMessage('Added an ignore marker. The function is still analysed but no longer flagged.');
    }
}
