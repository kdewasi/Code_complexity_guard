/**
 * Problems-panel entries: one per function that needs attention, plus one per
 * suggestion. Each diagnostic carries the data code actions need.
 */
import * as vscode from 'vscode';
import { FileAnalysis } from '../engine';
import { getSettings } from './config';
import { severityOf } from './format';

export const DIAGNOSTIC_SOURCE = 'Complexity Guard';

export interface DiagnosticData {
    functionName: string;
    startLine: number;
    suggestionId?: string;
}

export class DiagnosticsManager implements vscode.Disposable {
    private readonly collection = vscode.languages.createDiagnosticCollection('codecomplexity');
    private readonly data = new WeakMap<vscode.Diagnostic, DiagnosticData>();

    update(document: vscode.TextDocument, analysis: FileAnalysis | undefined): void {
        const settings = getSettings();
        if (!analysis || !settings.showDiagnostics) {
            this.collection.delete(document.uri);
            return;
        }
        const out: vscode.Diagnostic[] = [];
        const lineRange = (line: number): vscode.Range => {
            const l = Math.max(0, Math.min(line, document.lineCount - 1));
            return document.lineAt(l).range;
        };
        for (const f of analysis.functions) {
            if (f.ignored) {
                continue;
            }
            if (f.rating.grade === 'C' || f.rating.grade === 'D') {
                const d = new vscode.Diagnostic(
                    lineRange(f.nameLine),
                    `${f.qualifiedName}: ${f.rating.summary} (cyclomatic ${f.cyclomatic}, cognitive ${f.cognitive}, ${f.time.notation} time)`,
                    f.rating.grade === 'D' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
                );
                d.source = DIAGNOSTIC_SOURCE;
                d.code = { value: `grade-${f.rating.grade}`, target: vscode.Uri.parse('https://github.com/kdewasi/Code_complexity_guard#understanding-the-numbers') };
                this.data.set(d, { functionName: f.name, startLine: f.startLine });
                out.push(d);
            }
            for (const s of f.suggestions) {
                const d = new vscode.Diagnostic(lineRange(s.line), `${s.title}${s.impact ? ` (${s.impact})` : ''}: ${s.fix}`, severityOf(s.severity));
                d.source = DIAGNOSTIC_SOURCE;
                d.code = s.id;
                if (s.severity === 'info') {
                    d.tags = [];
                }
                this.data.set(d, { functionName: f.name, startLine: f.startLine, suggestionId: s.id });
                out.push(d);
            }
        }
        this.collection.set(document.uri, out);
    }

    dataFor(diagnostic: vscode.Diagnostic): DiagnosticData | undefined {
        return this.data.get(diagnostic);
    }

    clear(uri: vscode.Uri): void {
        this.collection.delete(uri);
    }

    dispose(): void {
        this.collection.dispose();
    }
}
