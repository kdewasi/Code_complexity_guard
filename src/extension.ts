/**
 * Complexity Guard — extension entry point.
 *
 * Everything runs locally: tree-sitter parsers (WebAssembly) analyse the text
 * of open files inside the extension host. No network, no shell, no API keys.
 */
import * as vscode from 'vscode';
import { getSpec } from './engine';
import { AnalysisService } from './vscode/analysisService';
import { ComplexityCodeActionProvider, ignoreFunction } from './vscode/codeActions';
import { ComplexityCodeLensProvider } from './vscode/codeLens';
import { CONFIG_SECTION, SUPPORTED_VSCODE_LANGUAGES, getSettings, languageOf } from './vscode/config';
import { DecorationManager } from './vscode/decorations';
import { DiagnosticsManager } from './vscode/diagnostics';
import { FunctionsTreeProvider } from './vscode/functionsTree';
import { ComplexityHoverProvider, buildMetricsExplanation } from './vscode/hover';
import { ReportPanel, revealLine } from './vscode/reportPanel';
import { StatusBar } from './vscode/statusBar';
import { scanWorkspace } from './vscode/workspaceScan';

const SUPPORTED_CONTEXT = 'codecomplexity.supportedLanguage';

export function activate(context: vscode.ExtensionContext): void {
    const log = vscode.window.createOutputChannel('Complexity Guard');
    const service = new AnalysisService(context.extensionPath, log);
    const decorations = new DecorationManager();
    const diagnostics = new DiagnosticsManager();
    const statusBar = new StatusBar();
    const codeLens = new ComplexityCodeLensProvider(service);
    const tree = new FunctionsTreeProvider(service);
    const selector: vscode.DocumentSelector = SUPPORTED_VSCODE_LANGUAGES.map((language) => ({ language }));

    context.subscriptions.push(
        log,
        service,
        decorations,
        diagnostics,
        statusBar,
        codeLens,
        tree,
        vscode.languages.registerCodeLensProvider(selector, codeLens),
        vscode.languages.registerHoverProvider(selector, new ComplexityHoverProvider(service)),
        vscode.languages.registerCodeActionsProvider(selector, new ComplexityCodeActionProvider(service, diagnostics), { providedCodeActionKinds: ComplexityCodeActionProvider.kinds }),
        vscode.window.registerTreeDataProvider('codecomplexity.functionsView', tree),
    );

    // ---- apply results to the UI
    context.subscriptions.push(
        service.onDidAnalyze(({ uri, result }) => {
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.toString() === uri.toString()) {
                    decorations.apply(editor, result);
                    diagnostics.update(editor.document, result);
                }
            }
            const active = vscode.window.activeTextEditor;
            if (active && active.document.uri.toString() === uri.toString()) {
                statusBar.showResult(result);
            }
            ReportPanel.instance?.refreshFile(uri, result);
        }),
    );

    const onEditor = (editor: vscode.TextEditor | undefined): void => {
        const supported = !!editor && !!languageOf(editor.document);
        void vscode.commands.executeCommand('setContext', SUPPORTED_CONTEXT, supported);
        if (!editor || !supported) {
            statusBar.showUnsupported();
            return;
        }
        const cached = service.getCached(editor.document.uri);
        if (cached) {
            decorations.apply(editor, cached);
            diagnostics.update(editor.document, cached);
            statusBar.showResult(cached);
        } else {
            statusBar.showAnalyzing();
        }
        service.schedule(editor.document, 50);
    };

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onEditor),
        vscode.window.onDidChangeVisibleTextEditors((editors) => {
            for (const e of editors) {
                const cached = service.getCached(e.document.uri);
                if (cached) {
                    decorations.apply(e, cached);
                }
            }
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!languageOf(e.document)) {
                return;
            }
            const settings = getSettings();
            if (settings.enableRealtime) {
                service.schedule(e.document);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (languageOf(doc)) {
                service.schedule(doc, 10);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            service.forget(doc.uri);
            diagnostics.clear(doc.uri);
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration(CONFIG_SECTION)) {
                return;
            }
            service.clearCache();
            codeLens.refresh();
            for (const editor of vscode.window.visibleTextEditors) {
                if (languageOf(editor.document)) {
                    service.schedule(editor.document, 10);
                } else {
                    decorations.clear(editor);
                    diagnostics.clear(editor.document.uri);
                }
            }
        }),
    );

    // ---- commands
    const analyzeActive = async (): Promise<{ editor: vscode.TextEditor; uri: vscode.Uri } | undefined> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showInformationMessage('Open a file in a supported language first (Python, Java, JavaScript, TypeScript, Go, Rust, C, C++, C#, Ruby, PHP).');
            return undefined;
        }
        if (!languageOf(editor.document)) {
            void vscode.window.showInformationMessage(`Complexity Guard does not analyse "${editor.document.languageId}" files. Supported: Python, Java, JavaScript, TypeScript, Go, Rust, C, C++, C#, Ruby, PHP.`);
            return undefined;
        }
        await service.analyzeDocument(editor.document);
        return { editor, uri: editor.document.uri };
    };

    const showReportFor = async (uri: vscode.Uri, focus?: { name: string; startLine: number; suggestionId?: string }): Promise<void> => {
        const document = await vscode.workspace.openTextDocument(uri);
        const analysis = service.getCached(uri) ?? (await service.analyzeDocument(document));
        if (!analysis) {
            void vscode.window.showInformationMessage('This file cannot be analysed (unsupported language or too large).');
            return;
        }
        ReportPanel.show(context.extensionUri, { kind: 'file', uri, analysis, focus });
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('codecomplexity.analyzeFile', async () => {
            const target = await analyzeActive();
            if (target) {
                await showReportFor(target.uri);
            }
        }),
        vscode.commands.registerCommand('codecomplexity.showReport', async () => {
            const target = await analyzeActive();
            if (target) {
                await showReportFor(target.uri);
            }
        }),
        vscode.commands.registerCommand('codecomplexity.showReportFor', async (uri: unknown) => {
            if (uri instanceof vscode.Uri) {
                await showReportFor(uri);
            }
        }),
        vscode.commands.registerCommand('codecomplexity.showSuggestionsPanel', async (uriString: unknown, functionName: unknown, startLine: unknown, suggestionId?: unknown) => {
            const uri = typeof uriString === 'string' ? safeParse(uriString) : vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                return;
            }
            const focus = typeof functionName === 'string' && typeof startLine === 'number' ? { name: functionName, startLine, suggestionId: typeof suggestionId === 'string' ? suggestionId : undefined } : undefined;
            await showReportFor(uri, focus);
        }),
        vscode.commands.registerCommand('codecomplexity.showBreakdown', async (uriString: unknown, functionName: unknown, startLine: unknown) => {
            await vscode.commands.executeCommand('codecomplexity.showSuggestionsPanel', uriString, functionName, startLine);
        }),
        vscode.commands.registerCommand('codecomplexity.ignoreWarning', async (uriString: unknown, startLine: unknown) => {
            const uri = typeof uriString === 'string' ? safeParse(uriString) : vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                return;
            }
            const document = await vscode.workspace.openTextDocument(uri);
            const languageId = languageOf(document);
            if (!languageId) {
                return;
            }
            const line = typeof startLine === 'number' ? startLine : vscode.window.activeTextEditor?.selection.active.line ?? 0;
            await ignoreFunction(uri, line, getSpec(languageId).lineComment);
        }),
        vscode.commands.registerCommand('codecomplexity.configureThreshold', async () => {
            await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Kishan-aicodeguard.codecomplexity');
        }),
        vscode.commands.registerCommand('codecomplexity.toggleCodeLens', async () => {
            const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
            const current = cfg.get<boolean>('showCodeLens', true);
            await cfg.update('showCodeLens', !current, vscode.ConfigurationTarget.Global);
            void vscode.window.showInformationMessage(`Inline complexity summaries ${!current ? 'enabled' : 'disabled'}.`);
        }),
        vscode.commands.registerCommand('codecomplexity.explainMetrics', async () => {
            const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: buildMetricsExplanation().value });
            await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
        }),
        vscode.commands.registerCommand('codecomplexity.refreshView', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && languageOf(editor.document)) {
                service.forget(editor.document.uri);
                service.schedule(editor.document, 10);
            }
            tree.refresh();
        }),
        vscode.commands.registerCommand('codecomplexity.revealLine', async (uriString: unknown, line: unknown) => {
            if (typeof uriString === 'string' && typeof line === 'number') {
                await revealLine(uriString, line);
            }
        }),
        vscode.commands.registerCommand('codecomplexity.analyzeWorkspace', async () => {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                void vscode.window.showInformationMessage('Open a folder or workspace first.');
                return;
            }
            const report = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Complexity Guard: analysing workspace', cancellable: true },
                (progress, token) => scanWorkspace(service, progress, token),
            );
            ReportPanel.show(context.extensionUri, { kind: 'workspace', report });
        }),
        vscode.commands.registerCommand('codecomplexity.reportIssue', async () => {
            await vscode.env.openExternal(vscode.Uri.parse('https://github.com/kdewasi/Code_complexity_guard/issues/new'));
        }),
    );

    log.appendLine('Complexity Guard activated (local analysis, no network access).');
    onEditor(vscode.window.activeTextEditor);
    for (const editor of vscode.window.visibleTextEditors) {
        if (languageOf(editor.document)) {
            service.schedule(editor.document, 50);
        }
    }
}

function safeParse(s: string): vscode.Uri | undefined {
    try {
        return vscode.Uri.parse(s, true);
    } catch {
        return undefined;
    }
}

export function deactivate(): void {
    // Disposables registered on the context are cleaned up by VS Code.
}
