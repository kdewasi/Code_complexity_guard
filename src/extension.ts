import * as vscode from 'vscode';
import * as pythonRunner from './pythonRunner';
import { DecorationManager } from './decorationManager';
import { ComplexityCodeActionProvider, showBreakdown, ignoreWarning, configureThreshold } from './codeActionProvider';
import { SuggestionPanel } from './suggestionPanel';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let decorationManager: DecorationManager;
let codeActionProvider: ComplexityCodeActionProvider;
let diagnosticCollection: vscode.DiagnosticCollection;
let analysisTimeout: NodeJS.Timeout | undefined;

/**
 * This method is called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Quality Guard extension is now active!');

    // Create output channel
    outputChannel = vscode.window.createOutputChannel('AI Code Quality Guard');
    context.subscriptions.push(outputChannel);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'codecomplexity.analyzeFile';
    statusBarItem.tooltip = 'Click to analyze file complexity';
    context.subscriptions.push(statusBarItem);

    // Create decoration manager
    decorationManager = new DecorationManager();
    context.subscriptions.push(decorationManager);

    // Create code action provider
    codeActionProvider = new ComplexityCodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', codeActionProvider, {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // Create diagnostic collection
    diagnosticCollection = vscode.languages.createDiagnosticCollection('complexity');
    context.subscriptions.push(diagnosticCollection);

    // Check Python setup on activation
    checkPythonSetupOnActivation();

    // Register command: Analyze File
    let analyzeCommand = vscode.commands.registerCommand('codecomplexity.analyzeFile', async () => {
        await analyzeCurrentFile();
    });

    // Register command: Suggest Refactoring
    let suggestCommand = vscode.commands.registerCommand('codecomplexity.suggestRefactoring', async () => {
        await suggestRefactoring();
    });

    // Register command: Install Package
    let installCommand = vscode.commands.registerCommand('codecomplexity.installPackage', async () => {
        await installPackage();
    });

    // Register command: Show Suggestions Panel
    let showSuggestionsCommand = vscode.commands.registerCommand(
        'codecomplexity.showSuggestionsPanel',
        async (filepath: string, functionName: string) => {
            await SuggestionPanel.show(filepath, functionName);
        }
    );

    // Register command: Show Breakdown
    let showBreakdownCommand = vscode.commands.registerCommand(
        'codecomplexity.showBreakdown',
        async (func: pythonRunner.FunctionComplexity) => {
            await showBreakdown(func, outputChannel);
        }
    );

    // Register command: Ignore Warning
    let ignoreWarningCommand = vscode.commands.registerCommand(
        'codecomplexity.ignoreWarning',
        async (document: vscode.TextDocument, functionLine: number) => {
            await ignoreWarning(document, functionLine);
        }
    );

    // Register command: Configure Threshold
    let configureThresholdCommand = vscode.commands.registerCommand(
        'codecomplexity.configureThreshold',
        async () => {
            await configureThreshold();
        }
    );

    // Register command: Report Issue
    let reportIssueCommand = vscode.commands.registerCommand('codecomplexity.reportIssue', async () => {
        const url = 'https://github.com/kdewasi/Code_complexity_guard/issues/new?labels=bug&template=bug_report.md';
        await vscode.env.openExternal(vscode.Uri.parse(url));
    });

    // Listen to active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'python') {
            scheduleAnalysis(editor.document, editor);
        } else {
            statusBarItem.hide();
        }
    });

    // Listen to document saves for real-time analysis
    vscode.workspace.onDidSaveTextDocument(document => {
        const config = vscode.workspace.getConfiguration('codecomplexity');
        const enableRealtime = config.get<boolean>('enableRealtime', true);

        if (enableRealtime && document.languageId === 'python') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document) {
                // Clear cache on save
                decorationManager.clearCache(document);
                scheduleAnalysis(document, editor);
            }
        }
    });

    // Listen to configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codecomplexity')) {
            // Re-analyze current file with new settings
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'python') {
                decorationManager.clearCache(editor.document);
                scheduleAnalysis(editor.document, editor);
            }
        }
    });

    // Analyze current editor on activation
    if (vscode.window.activeTextEditor?.document.languageId === 'python') {
        scheduleAnalysis(
            vscode.window.activeTextEditor.document,
            vscode.window.activeTextEditor
        );
    }

    context.subscriptions.push(analyzeCommand);
    context.subscriptions.push(suggestCommand);
    context.subscriptions.push(installCommand);
    context.subscriptions.push(showSuggestionsCommand);
    context.subscriptions.push(showBreakdownCommand);
    context.subscriptions.push(ignoreWarningCommand);
    context.subscriptions.push(configureThresholdCommand);
}

/**
 * Schedule analysis with debouncing
 */
function scheduleAnalysis(document: vscode.TextDocument, editor: vscode.TextEditor) {
    // Clear existing timeout
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }

    // Check if we have cached result
    const cached = decorationManager.getCachedResult(document);
    if (cached && !document.isDirty) {
        // Use cached result immediately
        updateStatusBarWithResult(cached);
        decorationManager.updateDecorations(editor, cached);
        codeActionProvider.setAnalysisResults(document, cached);
        updateDiagnostics(document, cached);
        return;
    }

    // Show analyzing status
    statusBarItem.text = '⏳ Analyzing...';
    statusBarItem.show();

    // Schedule analysis after 500ms of inactivity
    analysisTimeout = setTimeout(async () => {
        await analyzeDocument(document, editor);
    }, 500);
}

/**
 * Analyze a document and update decorations
 */
async function analyzeDocument(document: vscode.TextDocument, editor: vscode.TextEditor) {
    try {
        const result = await pythonRunner.analyzePythonFile(document.uri.fsPath);

        // Cache the result
        decorationManager.cacheResult(document, result);

        // Update status bar
        updateStatusBarWithResult(result);

        // Update decorations
        await decorationManager.updateDecorations(editor, result);

        // Update code action provider with results
        codeActionProvider.setAnalysisResults(document, result);

        // Update diagnostics
        updateDiagnostics(document, result);

    } catch (error: any) {
        // Silently fail for background analysis
        statusBarItem.text = '⚠️ Complexity: N/A';
        statusBarItem.show();

        // Log error to output channel
        outputChannel.appendLine(`Analysis failed: ${error.message}`);
    }
}

/**
 * Update diagnostics for a document
 */
function updateDiagnostics(document: vscode.TextDocument, result: pythonRunner.AnalysisResult): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const config = vscode.workspace.getConfiguration('codecomplexity');
    const warningThreshold = config.get<number>('warningThreshold', 8);
    const criticalThreshold = config.get<number>('criticalThreshold', 15);

    for (const func of result.functions) {
        // Skip if has ignore comment
        const lineIndex = func.line - 2;
        if (lineIndex >= 0 && lineIndex < document.lineCount) {
            const line = document.lineAt(lineIndex);
            if (line.text.includes('# codecomplexity: ignore')) {
                continue;
            }
        }

        if (func.complexity > warningThreshold) {
            const line = func.line - 1; // Convert to 0-indexed
            const range = document.lineAt(line).range;

            let severity = vscode.DiagnosticSeverity.Warning;
            let message = `Function '${func.name}' has moderate complexity (${func.complexity}). Consider refactoring.`;

            if (func.complexity > criticalThreshold) {
                severity = vscode.DiagnosticSeverity.Error;
                message = `Function '${func.name}' has high complexity (${func.complexity}). Refactoring strongly recommended.`;
            }

            const diagnostic = new vscode.Diagnostic(range, message, severity);
            diagnostic.source = 'codecomplexity';
            diagnostic.code = 'high-complexity';
            diagnostics.push(diagnostic);
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Check Python setup and show warnings if needed
 */
async function checkPythonSetupOnActivation() {
    outputChannel.appendLine('Checking Python setup...');

    try {
        const setup = await pythonRunner.checkPythonSetup();

        if (!setup.valid) {
            outputChannel.appendLine(`❌ Python setup failed: ${setup.error}`);
            vscode.window.showErrorMessage(`Python setup failed: ${setup.error}. Is Python installed?`);
        } else {
            outputChannel.appendLine(`✓ Python found: ${setup.pythonPath}`);
            if (setup.usingBundled) {
                outputChannel.appendLine(`✓ Using bundled Code Complexity engine`);
            } else {
                outputChannel.appendLine(`✓ codecomplexity package installed (Global)`);
            }
            vscode.window.showInformationMessage('AI Code Quality Guard ready!');
        }
    } catch (error: any) {
        outputChannel.appendLine(`❌ Setup check failed: ${error.message}`);
    }
}

/**
 * Install codecomplexity package
 */
async function installPackage() {
    outputChannel.appendLine('Installing codecomplexity package...');

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing codecomplexity package...',
            cancellable: false
        }, async () => {
            await pythonRunner.installCodeComplexity();
        });

        outputChannel.appendLine('✓ Package installed successfully');
        vscode.window.showInformationMessage('codecomplexity package installed successfully!');
    } catch (error: any) {
        outputChannel.appendLine(`❌ Installation failed: ${error.message}`);
        vscode.window.showErrorMessage(`Failed to install package: ${error.message}`);
    }
}

/**
 * Analyze the current Python file
 */
async function analyzeCurrentFile() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;

    if (document.languageId !== 'python') {
        vscode.window.showErrorMessage('This command only works with Python files');
        return;
    }

    // Save file if modified
    if (document.isDirty) {
        await document.save();
    }

    const filepath = document.uri.fsPath;

    outputChannel.show();
    outputChannel.appendLine(`\n${'='.repeat(80)}`);
    outputChannel.appendLine(`Analyzing: ${filepath}`);
    outputChannel.appendLine('='.repeat(80));

    try {
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing file complexity...',
            cancellable: false
        }, async () => {
            return await pythonRunner.analyzePythonFile(filepath);
        });

        // Display results
        displayAnalysisResults(result);

        // Update status bar
        updateStatusBarWithResult(result);

        // Update decorations
        await decorationManager.updateDecorations(editor, result);

        // Cache result
        decorationManager.cacheResult(document, result);

        // Update code action provider
        codeActionProvider.setAnalysisResults(document, result);

        // Update diagnostics
        updateDiagnostics(document, result);

    } catch (error: any) {
        outputChannel.appendLine(`\n❌ Error: ${error.message}`);
        vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
    }
}

/**
 * Display analysis results in output channel
 */
function displayAnalysisResults(result: pythonRunner.AnalysisResult) {
    outputChannel.appendLine(`\nFile: ${result.file}`);
    outputChannel.appendLine(`Total Functions: ${result.functions.length}`);
    outputChannel.appendLine(`Average Complexity: ${result.avg_complexity.toFixed(2)}`);
    outputChannel.appendLine(`Maximum Complexity: ${result.max_complexity}`);

    // Categorize functions
    const critical = result.functions.filter(f => f.complexity > 15);
    const warning = result.functions.filter(f => f.complexity >= 9 && f.complexity <= 15);
    const good = result.functions.filter(f => f.complexity < 9);

    if (critical.length > 0) {
        outputChannel.appendLine(`\n🔴 CRITICAL (Complexity > 15): ${critical.length} function(s)`);
        critical.forEach(func => {
            outputChannel.appendLine(`  Line ${func.line}: ${func.name} - Complexity: ${func.complexity}`);
        });
    }

    if (warning.length > 0) {
        outputChannel.appendLine(`\n🟡 WARNING (Complexity 9-15): ${warning.length} function(s)`);
        warning.forEach(func => {
            outputChannel.appendLine(`  Line ${func.line}: ${func.name} - Complexity: ${func.complexity}`);
        });
    }

    if (good.length > 0) {
        outputChannel.appendLine(`\n✅ GOOD (Complexity < 9): ${good.length} function(s)`);
        good.forEach(func => {
            outputChannel.appendLine(`  Line ${func.line}: ${func.name} - Complexity: ${func.complexity}`);
        });
    }

    outputChannel.appendLine('\n' + '='.repeat(80));
}

/**
 * Update status bar with analysis result
 */
function updateStatusBarWithResult(result: pythonRunner.AnalysisResult) {
    const avgComplexity = result.avg_complexity;
    const maxComplexity = result.max_complexity;

    let color: string;
    let icon: string;

    if (maxComplexity > 15) {
        color = 'statusBarItem.errorBackground';
        icon = '🔴';
    } else if (avgComplexity > 8) {
        color = 'statusBarItem.warningBackground';
        icon = '🟡';
    } else {
        color = 'statusBarItem.background';
        icon = '✅';
    }

    statusBarItem.text = `${icon} Complexity: ${avgComplexity.toFixed(1)}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(color);
    statusBarItem.show();
}

/**
 * Get refactoring suggestions for current function
 */
async function suggestRefactoring() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;

    if (document.languageId !== 'python') {
        vscode.window.showErrorMessage('This command only works with Python files');
        return;
    }

    // For now, show a message that this feature is coming soon
    vscode.window.showInformationMessage(
        'Refactoring suggestions feature coming soon! Use the CLI command for now: codecomplexity suggest <file> --function <name>'
    );
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
    console.log('AI Code Quality Guard extension is now deactivated');

    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }

    if (outputChannel) {
        outputChannel.dispose();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }

    if (decorationManager) {
        decorationManager.dispose();
    }

    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}
