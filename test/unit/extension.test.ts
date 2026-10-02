/**
 * Activates the real extension against an in-memory `vscode` stub and drives
 * every surface: CodeLens, hover, diagnostics, code actions, tree view,
 * report webview, ignore command, workspace scan.
 */
import * as assert from 'assert';
import * as path from 'path';
import Module = require('module');
import * as stub from './vscodeStub';

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
    if (request === 'vscode') {
        return stub;
    }
    return originalLoad.call(this, request, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const extension = require('../../src/extension') as typeof import('../../src/extension');

const PY = `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


def has_dupes(items):
    seen = []
    for x in items:
        if x in seen:
            return True
        seen.append(x)
    return False


def fine(a):
    return a + 1
`;

async function waitFor(pred: () => boolean, ms = 8000): Promise<void> {
    const start = Date.now();
    while (!pred()) {
        if (Date.now() - start > ms) {
            throw new Error('timed out waiting');
        }
        await stub.sleep(25);
    }
}

describe('Extension (stubbed VS Code host)', function () {
    this.timeout(30000);
    const extensionPath = path.resolve(__dirname, '..', '..', '..');
    const context: any = { extensionPath, extensionUri: stub.Uri.file(extensionPath), subscriptions: [] };
    let doc: stub.TextDocument;
    let editor: stub.TextEditor;

    before(async () => {
        extension.activate(context);
        doc = stub.openDocument('/ws/sample.py', 'python', PY);
        editor = new stub.TextEditor(doc);
        stub.fire.activeEditor(editor);
        await waitFor(() => stub.state.diagnostics.has(doc.uri.toString()));
    });

    it('registers every command declared in package.json', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('../../../package.json');
        for (const c of pkg.contributes.commands) {
            assert.ok(stub.state.commands.has(c.command), `command ${c.command} not registered`);
        }
        assert.strictEqual(stub.state.context.get('codecomplexity.supportedLanguage'), true);
    });

    it('produces diagnostics, decorations and a status bar entry', () => {
        const diags = stub.state.diagnostics.get(doc.uri.toString()) ?? [];
        assert.ok(diags.some((d) => d.message.includes('fib') && d.severity === stub.DiagnosticSeverity.Error));
        assert.ok(diags.some((d) => d.code === 'exponential-recursion'));
        assert.ok(diags.some((d) => d.code === 'linear-search-in-loop'));
        assert.ok(diags.every((d) => d.source === 'Complexity Guard'));
        const decorated = [...stub.state.decorations.values()].reduce((a, b) => a + b, 0);
        assert.strictEqual(decorated, 3);
        assert.ok(stub.state.statusText.includes('D'));
    });

    it('provides CodeLens with grade and Big-O', async () => {
        const lenses = await stub.providers.codeLens.provideCodeLenses(doc, { isCancellationRequested: false });
        assert.ok(lenses.length >= 4);
        const fibLens = lenses.find((l: any) => l.range.start.line === 0);
        assert.ok(fibLens.command.title.includes('O(2ⁿ)'));
        assert.ok(fibLens.command.title.includes('Poor'));
        assert.strictEqual(fibLens.command.command, 'codecomplexity.showSuggestionsPanel');
    });

    it('provides a hover with evidence and links', () => {
        const hover = stub.providers.hover.provideHover(doc, new stub.Position(6, 4));
        assert.ok(hover);
        const md = (hover.contents as stub.MarkdownString).value;
        assert.ok(md.includes('has_dupes'));
        assert.ok(md.includes('O(n²)'));
        assert.ok(md.includes('command:codecomplexity.showSuggestionsPanel'));
        assert.ok(md.includes('scans'));
        assert.strictEqual(stub.providers.hover.provideHover(doc, new stub.Position(1, 0)), undefined);
    });

    it('offers quick fixes on its diagnostics and on function lines', () => {
        const diags = stub.state.diagnostics.get(doc.uri.toString()) ?? [];
        const target = diags.find((d) => d.code === 'linear-search-in-loop')!;
        const actions = stub.providers.codeActions.provideCodeActions(doc, target.range, { diagnostics: [target] });
        assert.ok(actions.some((a: any) => a.title.includes('Show how to fix')));
        assert.ok(actions.some((a: any) => a.title.includes('Ignore')));
        assert.ok(actions.some((a: any) => a.title.includes('Configure')));
        const plain = stub.providers.codeActions.provideCodeActions(doc, new stub.Range(15, 0, 15, 0), { diagnostics: [] });
        assert.ok(plain.some((a: any) => a.title.includes('Complexity breakdown for fine')));
    });

    it('lists functions worst-first in the sidebar with metric children', () => {
        const roots = stub.providers.tree.getChildren();
        assert.strictEqual(roots.length, 3);
        assert.strictEqual(roots[0].label, 'fib');
        assert.strictEqual(roots[2].label, 'fine');
        const children = stub.providers.tree.getChildren(roots[0]);
        assert.ok(children.some((c: any) => c.label === 'Time' && c.description.startsWith('O(2ⁿ)')));
        assert.ok(children.some((c: any) => c.label === 'Recursion recomputes the same sub-problems'));
    });

    it('opens the report webview with a strict CSP and escaped content', async () => {
        await stub.commands.executeCommand('codecomplexity.showSuggestionsPanel', doc.uri.toString(), 'has_dupes', 6, 'linear-search-in-loop');
        const panel = stub.state.webviews[stub.state.webviews.length - 1];
        assert.ok(panel.webview.html.includes("default-src 'none'"));
        assert.ok(/script-src 'nonce-[A-Za-z0-9+/=]+'/.test(panel.webview.html));
        assert.ok(panel.webview.html.includes('has_dupes'));
        assert.ok(panel.webview.html.includes('class="suggestion warn focused"'));
        assert.ok(!panel.webview.html.includes('<script src='));
    });

    it('escapes hostile function names in the report', async () => {
        const evil = stub.openDocument('/ws/evil.js', 'javascript', 'function a() { return 1; }\nconst x = { "<img src=x onerror=alert(1)>": () => 1 };\n');
        await stub.commands.executeCommand('codecomplexity.showReportFor', evil.uri);
        const panel = stub.state.webviews[stub.state.webviews.length - 1];
        assert.ok(!panel.webview.html.includes('<img'));
        assert.ok(panel.webview.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    });

    it('inserts an ignore marker with the right comment syntax', async () => {
        await stub.commands.executeCommand('codecomplexity.ignoreWarning', doc.uri.toString(), 6);
        assert.ok(doc.getText().includes('# codecomplexity: ignore\ndef has_dupes'));
        await waitFor(() => (stub.state.diagnostics.get(doc.uri.toString()) ?? []).every((d) => !d.message.includes('has_dupes')));
    });

    it('re-analyses on edit and clears on close', async () => {
        doc.setText('def only(x):\n    return x\n');
        stub.fire.changeDocument(doc);
        await waitFor(() => (stub.state.diagnostics.get(doc.uri.toString()) ?? []).length === 0 && stub.state.statusText.includes('A'));
        stub.fire.close(doc);
        assert.ok(!stub.state.diagnostics.has(doc.uri.toString()));
    });

    it('ignores unsupported languages', async () => {
        const txt = stub.openDocument('/ws/notes.txt', 'plaintext', 'hello');
        stub.fire.activeEditor(new stub.TextEditor(txt));
        await stub.sleep(100);
        assert.strictEqual(stub.state.context.get('codecomplexity.supportedLanguage'), false);
        assert.ok(!stub.state.diagnostics.has(txt.uri.toString()));
    });

    it('scans the workspace', async () => {
        stub.openDocument('/ws/lib/util.ts', 'typescript', 'export function f(xs: number[]) { for (const x of xs) { if (xs.includes(x)) return x; } }\n');
        await stub.commands.executeCommand('codecomplexity.analyzeWorkspace');
        const panel = stub.state.webviews[stub.state.webviews.length - 1];
        assert.ok(panel.webview.html.includes('Hot spots'));
        assert.ok(panel.webview.html.includes('lib/util.ts'));
    });

    it('explains the metrics', async () => {
        await stub.commands.executeCommand('codecomplexity.explainMetrics');
        assert.ok(stub.state.opened.includes('markdown.showPreview'));
    });

    after(() => {
        for (const d of context.subscriptions) {
            d.dispose?.();
        }
        (Module as any)._load = originalLoad;
    });
});
