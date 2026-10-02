/**
 * Gutter icons and subtle line highlights on each function's name line.
 */
import * as vscode from 'vscode';
import { FileAnalysis, Grade } from '../engine';
import { getSettings } from './config';

const COLORS: Record<Grade, { fill: string; glyph: string }> = {
    A: { fill: '#2ea043', glyph: '✓' },
    B: { fill: '#2f81f7', glyph: '✓' },
    C: { fill: '#d29922', glyph: '!' },
    D: { fill: '#f85149', glyph: '✕' },
};

function gutterIcon(grade: Grade): vscode.Uri {
    const { fill, glyph } = COLORS[grade];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${fill}"/><text x="8" y="11.5" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">${glyph}</text></svg>`;
    return vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
}

export class DecorationManager implements vscode.Disposable {
    private readonly types: Record<Grade, vscode.TextEditorDecorationType>;

    constructor() {
        this.types = {
            A: this.make('A', 'rgba(46, 160, 67, 0.08)', 'rgba(46, 160, 67, 0.6)'),
            B: this.make('B', 'rgba(47, 129, 247, 0.08)', 'rgba(47, 129, 247, 0.6)'),
            C: this.make('C', 'rgba(210, 153, 34, 0.14)', 'rgba(210, 153, 34, 0.9)'),
            D: this.make('D', 'rgba(248, 81, 73, 0.16)', 'rgba(248, 81, 73, 0.9)'),
        };
    }

    private make(grade: Grade, background: string, ruler: string): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: background,
            overviewRulerColor: ruler,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: gutterIcon(grade),
            gutterIconSize: 'contain',
        });
    }

    apply(editor: vscode.TextEditor, analysis: FileAnalysis | undefined): void {
        const settings = getSettings();
        const buckets: Record<Grade, vscode.DecorationOptions[]> = { A: [], B: [], C: [], D: [] };
        if (analysis && settings.showDecorations) {
            for (const f of analysis.functions) {
                if (f.ignored) {
                    continue;
                }
                if (!settings.decorateHealthyFunctions && (f.rating.grade === 'A' || f.rating.grade === 'B')) {
                    continue;
                }
                const line = Math.min(f.nameLine, editor.document.lineCount - 1);
                if (line < 0) {
                    continue;
                }
                buckets[f.rating.grade].push({ range: editor.document.lineAt(line).range });
            }
        }
        for (const grade of Object.keys(buckets) as Grade[]) {
            editor.setDecorations(this.types[grade], buckets[grade]);
        }
    }

    clear(editor: vscode.TextEditor): void {
        for (const t of Object.values(this.types)) {
            editor.setDecorations(t, []);
        }
    }

    dispose(): void {
        for (const t of Object.values(this.types)) {
            t.dispose();
        }
    }
}
