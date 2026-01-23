import * as vscode from 'vscode';
import * as pythonRunner from './pythonRunner';

/**
 * Provides code actions (light bulb quick fixes) for complex functions
 */
export class ComplexityCodeActionProvider implements vscode.CodeActionProvider {
    private analysisResults = new WeakMap<vscode.TextDocument, pythonRunner.AnalysisResult>();

    /**
     * Set analysis results for a document
     */
    setAnalysisResults(document: vscode.TextDocument, results: pythonRunner.AnalysisResult): void {
        this.analysisResults.set(document, results);
    }

    /**
     * Provide code actions for the current cursor position
     */
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Get analysis results for this document
        const results = this.analysisResults.get(document);
        if (!results) {
            return actions;
        }

        // Find function at cursor position
        const func = this.findFunctionAtLine(results, range.start.line + 1);
        if (!func) {
            return actions;
        }

        // Check if function has ignore comment
        if (this.hasIgnoreComment(document, func.line)) {
            return actions;
        }

        // Only show actions for functions with complexity > 8
        const config = vscode.workspace.getConfiguration('codecomplexity');
        const warningThreshold = config.get<number>('warningThreshold', 8);

        if (func.complexity <= warningThreshold) {
            return actions;
        }

        // Action 1: Show Refactoring Suggestions
        const suggestAction = new vscode.CodeAction(
            `💡 Show Refactoring Suggestions (Complexity: ${func.complexity})`,
            vscode.CodeActionKind.QuickFix
        );
        suggestAction.command = {
            command: 'codecomplexity.showSuggestionsPanel',
            title: 'Show Suggestions',
            arguments: [document.uri.fsPath, func.name]
        };
        suggestAction.isPreferred = true;
        actions.push(suggestAction);

        // Action 2: View Complexity Breakdown
        const breakdownAction = new vscode.CodeAction(
            '📊 View Complexity Breakdown',
            vscode.CodeActionKind.QuickFix
        );
        breakdownAction.command = {
            command: 'codecomplexity.showBreakdown',
            title: 'View Breakdown',
            arguments: [func]
        };
        actions.push(breakdownAction);

        // Action 3: Ignore This Warning
        const ignoreAction = new vscode.CodeAction(
            '🚫 Ignore This Warning',
            vscode.CodeActionKind.QuickFix
        );
        ignoreAction.command = {
            command: 'codecomplexity.ignoreWarning',
            title: 'Ignore Warning',
            arguments: [document, func.line]
        };
        actions.push(ignoreAction);

        // Action 4: Configure Threshold
        const configAction = new vscode.CodeAction(
            '⚙️ Configure Complexity Threshold',
            vscode.CodeActionKind.QuickFix
        );
        configAction.command = {
            command: 'codecomplexity.configureThreshold',
            title: 'Configure Threshold'
        };
        actions.push(configAction);

        return actions;
    }

    /**
     * Find function at a specific line
     */
    private findFunctionAtLine(
        results: pythonRunner.AnalysisResult,
        line: number
    ): pythonRunner.FunctionComplexity | undefined {
        return results.functions.find(f => f.line === line);
    }

    /**
     * Check if a function has an ignore comment
     */
    private hasIgnoreComment(document: vscode.TextDocument, functionLine: number): boolean {
        // Check the line before the function definition
        const lineIndex = functionLine - 2; // -1 for 0-index, -1 for line before

        if (lineIndex < 0 || lineIndex >= document.lineCount) {
            return false;
        }

        const line = document.lineAt(lineIndex);
        return line.text.includes('# codecomplexity: ignore');
    }
}

/**
 * Command: Show breakdown in output channel
 */
export async function showBreakdown(
    func: pythonRunner.FunctionComplexity,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    outputChannel.show();
    outputChannel.appendLine('\n' + '='.repeat(80));
    outputChannel.appendLine(`📊 COMPLEXITY BREAKDOWN: ${func.name}`);
    outputChannel.appendLine('='.repeat(80));
    outputChannel.appendLine(`\nFunction: ${func.name}`);
    outputChannel.appendLine(`Line: ${func.line}`);
    outputChannel.appendLine(`Complexity: ${func.complexity}`);
    outputChannel.appendLine(`\nDecision Points: ${func.decision_points.length}`);

    if (func.decision_points.length > 0) {
        // Group by type
        const typeCount: { [key: string]: number } = {};
        for (const dp of func.decision_points) {
            typeCount[dp.type] = (typeCount[dp.type] || 0) + 1;
        }

        outputChannel.appendLine('\nBreakdown by Type:');
        for (const [type, count] of Object.entries(typeCount)) {
            outputChannel.appendLine(`  - ${type}: ${count}`);
        }

        outputChannel.appendLine('\nDetailed Decision Points:');
        for (const dp of func.decision_points) {
            outputChannel.appendLine(`  Line ${dp.line}: ${dp.description}`);
        }
    }

    outputChannel.appendLine('\n' + '='.repeat(80));
}

/**
 * Command: Add ignore comment
 */
export async function ignoreWarning(
    document: vscode.TextDocument,
    functionLine: number
): Promise<void> {
    const edit = new vscode.WorkspaceEdit();

    // Insert comment on the line before the function
    const lineIndex = functionLine - 1; // Convert to 0-indexed
    const insertPosition = new vscode.Position(lineIndex - 1, 0);

    // Get indentation of function line
    const functionLineText = document.lineAt(lineIndex);
    const indent = functionLineText.text.match(/^\s*/)?.[0] || '';

    edit.insert(document.uri, insertPosition, `${indent}# codecomplexity: ignore\n`);

    await vscode.workspace.applyEdit(edit);
    await document.save();

    vscode.window.showInformationMessage('Added ignore comment. Function will be skipped in future analyses.');
}

/**
 * Command: Open settings to threshold configuration
 */
export async function configureThreshold(): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'codecomplexity.warningThreshold'
    );
}
