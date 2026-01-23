import * as vscode from 'vscode';
import * as pythonRunner from './pythonRunner';

/**
 * Manages decorations for complexity visualization
 */
export class DecorationManager {
    private goodDecoration: vscode.TextEditorDecorationType;
    private warningDecoration: vscode.TextEditorDecorationType;
    private criticalDecoration: vscode.TextEditorDecorationType;

    // Cache for analysis results
    private cache = new WeakMap<vscode.TextDocument, pythonRunner.AnalysisResult>();

    constructor() {
        this.goodDecoration = this.createGoodDecoration();
        this.warningDecoration = this.createWarningDecoration();
        this.criticalDecoration = this.createCriticalDecoration();
    }

    /**
     * Create decoration for good complexity (≤8)
     */
    private createGoodDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 255, 0, 0.05)',
            border: '1px solid rgba(0, 200, 0, 0.3)',
            borderRadius: '3px',
            overviewRulerColor: 'green',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: this.createGutterIcon('✓', 'green'),
            gutterIconSize: 'contain'
        });
    }

    /**
     * Create decoration for warning complexity (9-15)
     */
    private createWarningDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            border: '1px solid rgba(255, 140, 0, 0.5)',
            borderRadius: '3px',
            overviewRulerColor: 'orange',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: this.createGutterIcon('⚠', 'orange'),
            gutterIconSize: 'contain'
        });
    }

    /**
     * Create decoration for critical complexity (>15)
     */
    private createCriticalDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            borderRadius: '3px',
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: this.createGutterIcon('✗', 'red'),
            gutterIconSize: 'contain'
        });
    }

    /**
     * Create a simple SVG icon for gutter
     */
    private createGutterIcon(symbol: string, color: string): vscode.Uri {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="${color}" opacity="0.8"/>
                <text x="8" y="12" font-size="10" fill="white" text-anchor="middle" font-weight="bold">${symbol}</text>
            </svg>
        `;

        const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
        return vscode.Uri.parse(dataUri);
    }

    /**
     * Update decorations for a document
     */
    async updateDecorations(
        editor: vscode.TextEditor,
        analysisResult: pythonRunner.AnalysisResult
    ): Promise<void> {
        // Clear existing decorations
        this.clearDecorations(editor);

        // Get configuration thresholds
        const config = vscode.workspace.getConfiguration('codecomplexity');
        const warningThreshold = config.get<number>('warningThreshold', 8);
        const criticalThreshold = config.get<number>('criticalThreshold', 15);

        // Group functions by severity
        const goodFunctions: pythonRunner.FunctionComplexity[] = [];
        const warningFunctions: pythonRunner.FunctionComplexity[] = [];
        const criticalFunctions: pythonRunner.FunctionComplexity[] = [];

        for (const func of analysisResult.functions) {
            if (func.complexity > criticalThreshold) {
                criticalFunctions.push(func);
            } else if (func.complexity > warningThreshold) {
                warningFunctions.push(func);
            } else {
                goodFunctions.push(func);
            }
        }

        // Create decorations for each severity level
        const goodDecorations = this.createDecorationsForFunctions(goodFunctions, editor.document);
        const warningDecorations = this.createDecorationsForFunctions(warningFunctions, editor.document);
        const criticalDecorations = this.createDecorationsForFunctions(criticalFunctions, editor.document);

        // Apply decorations
        editor.setDecorations(this.goodDecoration, goodDecorations);
        editor.setDecorations(this.warningDecoration, warningDecorations);
        editor.setDecorations(this.criticalDecoration, criticalDecorations);
    }

    /**
     * Create decoration options for a list of functions
     */
    private createDecorationsForFunctions(
        functions: pythonRunner.FunctionComplexity[],
        document: vscode.TextDocument
    ): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];

        for (const func of functions) {
            const line = func.line - 1; // Convert to 0-indexed

            // Ensure line is within document bounds
            if (line < 0 || line >= document.lineCount) {
                continue;
            }

            const lineText = document.lineAt(line);
            const range = new vscode.Range(line, 0, line, lineText.text.length);

            // Create hover message
            const hoverMessage = this.createHoverMessage(func);

            decorations.push({
                range,
                hoverMessage
            });
        }

        return decorations;
    }

    /**
     * Create hover message for a function
     */
    private createHoverMessage(func: pythonRunner.FunctionComplexity): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        // Function header
        md.appendMarkdown(`### 📊 ${func.name}\n\n`);
        md.appendMarkdown(`**Complexity:** ${func.complexity}\n\n`);

        // Breakdown by decision point type
        if (func.decision_points.length > 0) {
            md.appendMarkdown(`**Decision Points:** ${func.decision_points.length}\n\n`);

            // Group by type
            const typeCount: { [key: string]: number } = {};
            for (const dp of func.decision_points) {
                typeCount[dp.type] = (typeCount[dp.type] || 0) + 1;
            }

            md.appendMarkdown(`**Breakdown:**\n`);
            for (const [type, count] of Object.entries(typeCount)) {
                md.appendMarkdown(`- ${type}: ${count}\n`);
            }
        }

        // Severity indicator
        if (func.complexity > 15) {
            md.appendMarkdown(`\n🔴 **CRITICAL** - Consider refactoring`);
        } else if (func.complexity > 8) {
            md.appendMarkdown(`\n🟡 **WARNING** - Review for simplification`);
        } else {
            md.appendMarkdown(`\n✅ **GOOD** - Maintainable complexity`);
        }

        return md;
    }

    /**
     * Clear all decorations from an editor
     */
    clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.goodDecoration, []);
        editor.setDecorations(this.warningDecoration, []);
        editor.setDecorations(this.criticalDecoration, []);
    }

    /**
     * Get cached analysis result
     */
    getCachedResult(document: vscode.TextDocument): pythonRunner.AnalysisResult | undefined {
        return this.cache.get(document);
    }

    /**
     * Cache analysis result
     */
    cacheResult(document: vscode.TextDocument, result: pythonRunner.AnalysisResult): void {
        this.cache.set(document, result);
    }

    /**
     * Clear cache for a document
     */
    clearCache(document: vscode.TextDocument): void {
        this.cache.delete(document);
    }

    /**
     * Dispose all decorations
     */
    dispose(): void {
        this.goodDecoration.dispose();
        this.warningDecoration.dispose();
        this.criticalDecoration.dispose();
    }
}
