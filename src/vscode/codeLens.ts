/**
 * One-line summary above every function. The first lens opens the report at
 * that function; a second lens appears when there are suggestions.
 */
import * as vscode from 'vscode';
import { AnalysisService } from './analysisService';
import { getSettings } from './config';
import { GRADE_EMOJI } from './format';

export class ComplexityCodeLensProvider implements vscode.CodeLensProvider {
    private readonly emitter = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this.emitter.event;

    constructor(private readonly service: AnalysisService) {
        service.onDidAnalyze(() => this.emitter.fire());
    }

    refresh(): void {
        this.emitter.fire();
    }

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        const settings = getSettings();
        if (!settings.showCodeLens) {
            return [];
        }
        const analysis = this.service.getCached(document.uri) ?? (await this.service.analyzeDocument(document, settings));
        if (!analysis || token.isCancellationRequested) {
            return [];
        }
        const lenses: vscode.CodeLens[] = [];
        for (const f of analysis.functions) {
            if (f.ignored) {
                continue;
            }
            const line = Math.min(f.nameLine, document.lineCount - 1);
            const range = new vscode.Range(line, 0, line, 0);
            const args = [document.uri.toString(), f.name, f.startLine];
            lenses.push(
                new vscode.CodeLens(range, {
                    title: `${GRADE_EMOJI[f.rating.grade]} ${f.rating.label} · cyclomatic ${f.cyclomatic} · cognitive ${f.cognitive} · time ${f.time.notation} · space ${f.space.notation}`,
                    tooltip: `${f.rating.summary}\nClick for the full breakdown.`,
                    command: 'codecomplexity.showSuggestionsPanel',
                    arguments: args,
                }),
            );
            if (f.suggestions.length > 0) {
                const top = f.suggestions[0];
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: f.suggestions.length === 1 ? `💡 ${top.title}` : `💡 ${f.suggestions.length} suggestions: ${top.title}`,
                        tooltip: top.problem,
                        command: 'codecomplexity.showSuggestionsPanel',
                        arguments: args,
                    }),
                );
            }
        }
        return lenses;
    }

    dispose(): void {
        this.emitter.dispose();
    }
}
