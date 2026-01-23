import * as vscode from 'vscode';
import * as pythonRunner from './pythonRunner';

/**
 * Manages the suggestion panel webview
 */
export class SuggestionPanel {
    private static currentPanel: SuggestionPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;

        // Handle panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Show or create the suggestion panel
     */
    public static async show(filepath: string, functionName: string): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel already exists, reveal it
        if (SuggestionPanel.currentPanel) {
            SuggestionPanel.currentPanel.panel.reveal(column);
        } else {
            // Create new panel
            const panel = vscode.window.createWebviewPanel(
                'complexitySuggestions',
                'Refactoring Suggestions',
                column || vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            SuggestionPanel.currentPanel = new SuggestionPanel(panel);
        }

        // Load suggestions
        await SuggestionPanel.currentPanel.loadSuggestions(filepath, functionName);
    }

    /**
     * Load and display suggestions
     */
    private async loadSuggestions(filepath: string, functionName: string): Promise<void> {
        this.panel.webview.html = this.getLoadingHtml(functionName);

        try {
            // Analyze file to get results
            const results = await pythonRunner.analyzePythonFile(filepath);

            // Find the function
            const func = results.functions.find(f => f.name === functionName);

            if (!func) {
                this.panel.webview.html = this.getErrorHtml(`Function '${functionName}' not found`);
                return;
            }

            // For now, we'll show the complexity breakdown
            // In the future, we can call getSuggestions when it's implemented
            this.panel.webview.html = this.getSuggestionsHtml(func, results);

        } catch (error: any) {
            this.panel.webview.html = this.getErrorHtml(error.message);
        }
    }

    /**
     * Get loading HTML
     */
    private getLoadingHtml(functionName: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refactoring Suggestions</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .loading {
            text-align: center;
            padding: 40px;
        }
    </style>
</head>
<body>
    <div class="loading">
        <h2>⏳ Analyzing ${functionName}...</h2>
        <p>Please wait while we generate refactoring suggestions.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Get error HTML
     */
    private getErrorHtml(message: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .error {
            color: var(--vscode-errorForeground);
            padding: 20px;
            border: 1px solid var(--vscode-errorBorder);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="error">
        <h2>❌ Error</h2>
        <p>${message}</p>
    </div>
</body>
</html>`;
    }

    /**
     * Get suggestions HTML
     */
    private getSuggestionsHtml(
        func: pythonRunner.FunctionComplexity,
        results: pythonRunner.AnalysisResult
    ): string {
        // Determine severity
        let severity = '✅ GOOD';
        let severityColor = 'var(--vscode-testing-iconPassed)';

        if (func.complexity > 15) {
            severity = '🔴 CRITICAL';
            severityColor = 'var(--vscode-errorForeground)';
        } else if (func.complexity > 8) {
            severity = '🟡 WARNING';
            severityColor = 'var(--vscode-editorWarning-foreground)';
        }

        // Group decision points by type
        const typeCount: { [key: string]: number } = {};
        for (const dp of func.decision_points) {
            typeCount[dp.type] = (typeCount[dp.type] || 0) + 1;
        }

        const breakdownHtml = Object.entries(typeCount)
            .map(([type, count]) => `<li><strong>${type}:</strong> ${count}</li>`)
            .join('');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refactoring Suggestions</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .header {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .metric {
            display: inline-block;
            margin-right: 30px;
        }
        .metric-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
        }
        .severity {
            color: ${severityColor};
            font-weight: bold;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        ul {
            margin: 10px 0;
        }
        li {
            margin: 5px 0;
        }
        .recommendation {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 15px 0;
        }
        .code {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h1>📊 Refactoring Suggestions</h1>
    
    <div class="header">
        <div class="metric">
            <div class="metric-label">Function</div>
            <div class="metric-value code">${func.name}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Complexity</div>
            <div class="metric-value">${func.complexity}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Status</div>
            <div class="metric-value severity">${severity}</div>
        </div>
    </div>
    
    <div class="section">
        <h2>🔍 Complexity Breakdown</h2>
        <p><strong>Total Decision Points:</strong> ${func.decision_points.length}</p>
        <ul>
            ${breakdownHtml}
        </ul>
    </div>
    
    <div class="section">
        <h2>💡 General Recommendations</h2>
        ${func.complexity > 15 ? `
            <div class="recommendation">
                <strong>🔴 Critical Complexity Detected</strong>
                <p>This function has very high complexity (${func.complexity}). Consider these refactoring strategies:</p>
                <ul>
                    <li>Extract nested logic into separate functions</li>
                    <li>Use early returns to reduce nesting</li>
                    <li>Consider the Strategy or Command pattern for complex conditionals</li>
                    <li>Break the function into smaller, single-purpose functions</li>
                </ul>
            </div>
        ` : func.complexity > 8 ? `
            <div class="recommendation">
                <strong>🟡 Moderate Complexity</strong>
                <p>This function could benefit from simplification:</p>
                <ul>
                    <li>Look for opportunities to extract helper functions</li>
                    <li>Consider reducing nesting levels</li>
                    <li>Review if all branches are necessary</li>
                </ul>
            </div>
        ` : `
            <div class="recommendation">
                <strong>✅ Good Complexity</strong>
                <p>This function has acceptable complexity. No immediate refactoring needed.</p>
            </div>
        `}
    </div>
    
    <div class="section">
        <h2>📝 Decision Points Detail</h2>
        <ul>
            ${func.decision_points.map(dp =>
            `<li>Line ${dp.line}: ${dp.description}</li>`
        ).join('')}
        </ul>
    </div>
    
    <div style="margin-top: 30px;">
        <p><em>💡 Tip: Use the CLI command for detailed pattern-based suggestions:</em></p>
        <p class="code">codecomplexity suggest &lt;file&gt; --function ${func.name}</p>
    </div>
</body>
</html>`;
    }

    /**
     * Dispose the panel
     */
    public dispose(): void {
        SuggestionPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
