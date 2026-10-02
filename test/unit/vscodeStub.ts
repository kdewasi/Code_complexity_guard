/**
 * A minimal in-memory stand-in for the `vscode` module, just enough to
 * activate the extension and drive its providers from plain mocha tests.
 * Installed through Module._load interception (see extension.test.ts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class Position {
    constructor(public line: number, public character: number) {}
}
export class Range {
    start: Position;
    end: Position;
    constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
        if (typeof a === 'number') {
            this.start = new Position(a, b as number);
            this.end = new Position(c as number, d as number);
        } else {
            this.start = a;
            this.end = b as Position;
        }
    }
}
export class Selection extends Range {
    active: Position;
    constructor(a: Position, b: Position) {
        super(a, b);
        this.active = b;
    }
}
export class Uri {
    constructor(public scheme: string, public path: string, public authority = '') {}
    static file(p: string): Uri {
        return new Uri('file', p, '/');
    }
    static parse(s: string, _strict?: boolean): Uri {
        const m = s.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
        if (!m) {
            const m2 = s.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
            if (!m2) {
                throw new Error('bad uri ' + s);
            }
            return new Uri(m2[1], m2[2], '');
        }
        return new Uri(m[1], m[2], '/');
    }
    static joinPath(base: Uri, ...parts: string[]): Uri {
        return new Uri(base.scheme, [base.path, ...parts].join('/'), base.authority);
    }
    get fsPath(): string {
        return this.path;
    }
    toString(): string {
        return this.authority === '/' ? `${this.scheme}://${this.path}` : `${this.scheme}:${this.path}`;
    }
}
export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];
    event = (listener: (e: T) => void): { dispose(): void } => {
        this.listeners.push(listener);
        return { dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
    };
    fire(e: T): void {
        for (const l of [...this.listeners]) {
            l(e);
        }
    }
    dispose(): void {
        this.listeners = [];
    }
}
export class Disposable {
    constructor(private fn?: () => void) {}
    dispose(): void {
        this.fn?.();
    }
}
export class MarkdownString {
    value = '';
    isTrusted = false;
    supportHtml = false;
    constructor(v?: string) {
        this.value = v ?? '';
    }
    appendMarkdown(s: string): this {
        this.value += s;
        return this;
    }
}
export class ThemeIcon {
    constructor(public id: string, public color?: unknown) {}
}
export class ThemeColor {
    constructor(public id: string) {}
}
export class TreeItem {
    description?: string;
    tooltip?: string;
    iconPath?: unknown;
    command?: unknown;
    contextValue?: string;
    constructor(public label: string, public collapsibleState?: number) {}
}
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
export class Diagnostic {
    source?: string;
    code?: unknown;
    tags?: unknown[];
    constructor(public range: Range, public message: string, public severity: number) {}
}
export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
export class CodeAction {
    command?: unknown;
    diagnostics?: unknown[];
    isPreferred?: boolean;
    constructor(public title: string, public kind?: unknown) {}
}
export const CodeActionKind = { QuickFix: 'quickfix' };
export class CodeLens {
    constructor(public range: Range, public command?: any) {}
}
export class Hover {
    constructor(public contents: unknown, public range?: Range) {}
}
export const StatusBarAlignment = { Left: 1, Right: 2 };
export const OverviewRulerLane = { Right: 4 };
export const ProgressLocation = { Notification: 15 };
export const ConfigurationTarget = { Global: 1 };
export const ViewColumn = { One: 1, Two: 2, Beside: -2 };
export const TextEditorRevealType = { InCenter: 1 };
export class WorkspaceEdit {
    inserts: { uri: Uri; position: Position; text: string }[] = [];
    insert(uri: Uri, position: Position, text: string): void {
        this.inserts.push({ uri, position, text });
    }
}

// ---------------------------------------------------------------- state

export const state = {
    config: new Map<string, unknown>(),
    commands: new Map<string, (...args: any[]) => any>(),
    diagnostics: new Map<string, Diagnostic[]>(),
    decorations: new Map<string, number>(),
    statusText: '',
    messages: [] as string[],
    webviews: [] as { webview: { html: string }; title: string }[],
    context: new Map<string, unknown>(),
    opened: [] as string[],
    documents: new Map<string, TextDocument>(),
    edits: [] as WorkspaceEdit[],
};

export class TextLine {
    constructor(public lineNumber: number, public text: string) {}
    get range(): Range {
        return new Range(this.lineNumber, 0, this.lineNumber, this.text.length);
    }
}

export class TextDocument {
    version = 1;
    isDirty = false;
    private lines: string[];
    constructor(public uri: Uri, public languageId: string, text: string) {
        this.lines = text.split('\n');
    }
    get fileName(): string {
        return this.uri.path;
    }
    get lineCount(): number {
        return this.lines.length;
    }
    getText(): string {
        return this.lines.join('\n');
    }
    lineAt(i: number): TextLine {
        return new TextLine(i, this.lines[i] ?? '');
    }
    setText(text: string): void {
        this.lines = text.split('\n');
        this.version++;
    }
}

export class TextEditor {
    selection = new Selection(new Position(0, 0), new Position(0, 0));
    viewColumn = 1;
    constructor(public document: TextDocument) {}
    setDecorations(type: { id: string }, ranges: unknown[]): void {
        state.decorations.set(type.id, ranges.length);
    }
    revealRange(): void {}
}

const activeEditorEmitter = new EventEmitter<TextEditor | undefined>();
const visibleEditorsEmitter = new EventEmitter<TextEditor[]>();
const changeDocEmitter = new EventEmitter<{ document: TextDocument }>();
const saveEmitter = new EventEmitter<TextDocument>();
const closeEmitter = new EventEmitter<TextDocument>();
const configEmitter = new EventEmitter<{ affectsConfiguration(s: string): boolean }>();

let decorationCounter = 0;
export const providers: { codeLens?: any; hover?: any; codeActions?: any; tree?: any } = {};

export const window = {
    activeTextEditor: undefined as TextEditor | undefined,
    visibleTextEditors: [] as TextEditor[],
    onDidChangeActiveTextEditor: activeEditorEmitter.event,
    onDidChangeVisibleTextEditors: visibleEditorsEmitter.event,
    createOutputChannel: () => ({ appendLine: (s: string) => state.messages.push(s), show: () => undefined, dispose: () => undefined }),
    createStatusBarItem: () => {
        const item: any = { text: '', tooltip: '', show: () => (state.statusText = item.text), hide: () => (state.statusText = ''), dispose: () => undefined };
        return item;
    },
    createTextEditorDecorationType: () => ({ id: `deco${decorationCounter++}`, dispose: () => undefined }),
    registerTreeDataProvider: (_id: string, p: any) => {
        providers.tree = p;
        return new Disposable();
    },
    showInformationMessage: (m: string) => {
        state.messages.push(m);
        return Promise.resolve(undefined);
    },
    showErrorMessage: (m: string) => {
        state.messages.push(m);
        return Promise.resolve(undefined);
    },
    showTextDocument: async (doc: TextDocument) => {
        const editor = new TextEditor(doc);
        window.activeTextEditor = editor;
        return editor;
    },
    createWebviewPanel: (_id: string, title: string) => {
        const panel: any = {
            title,
            iconPath: undefined,
            webview: { html: '', cspSource: 'vscode-webview://x', onDidReceiveMessage: () => new Disposable() },
            onDidDispose: () => new Disposable(),
            reveal: () => undefined,
            dispose: () => undefined,
        };
        state.webviews.push(panel);
        return panel;
    },
    withProgress: async (_o: unknown, task: (p: any, t: any) => Promise<unknown>) => task({ report: () => undefined }, { isCancellationRequested: false }),
};

export const workspace = {
    workspaceFolders: [{ uri: Uri.file('/ws'), name: 'ws', index: 0 }],
    getConfiguration: (_section?: string) => ({
        get: (key: string, def?: unknown) => (state.config.has(key) ? state.config.get(key) : def),
        update: async (key: string, value: unknown) => {
            state.config.set(key, value);
        },
    }),
    onDidChangeTextDocument: changeDocEmitter.event,
    onDidSaveTextDocument: saveEmitter.event,
    onDidCloseTextDocument: closeEmitter.event,
    onDidChangeConfiguration: configEmitter.event,
    openTextDocument: async (arg: Uri | { language: string; content: string }) => {
        if (arg instanceof Uri) {
            const doc = state.documents.get(arg.toString());
            if (!doc) {
                throw new Error('no such document ' + arg.toString());
            }
            return doc;
        }
        const uri = new Uri('untitled', `Untitled-${state.documents.size + 1}`);
        const doc = new TextDocument(uri, arg.language, arg.content);
        state.documents.set(uri.toString(), doc);
        return doc;
    },
    applyEdit: async (edit: WorkspaceEdit) => {
        state.edits.push(edit);
        for (const ins of edit.inserts) {
            const doc = state.documents.get(ins.uri.toString());
            if (doc) {
                const lines = doc.getText().split('\n');
                lines[ins.position.line] = ins.text + lines[ins.position.line];
                doc.setText(lines.join('\n'));
                changeDocEmitter.fire({ document: doc });
            }
        }
        return true;
    },
    asRelativePath: (u: Uri) => u.path.replace(/^\/ws\//, ''),
    findFiles: async () => [...state.documents.values()].filter((d) => d.uri.scheme === 'file').map((d) => d.uri),
    fs: {
        readFile: async (uri: Uri) => {
            const doc = state.documents.get(uri.toString());
            if (!doc) {
                throw new Error('missing');
            }
            return new TextEncoder().encode(doc.getText());
        },
    },
};

export const languages = {
    registerCodeLensProvider: (_sel: unknown, p: any) => {
        providers.codeLens = p;
        return new Disposable();
    },
    registerHoverProvider: (_sel: unknown, p: any) => {
        providers.hover = p;
        return new Disposable();
    },
    registerCodeActionsProvider: (_sel: unknown, p: any) => {
        providers.codeActions = p;
        return new Disposable();
    },
    createDiagnosticCollection: () => ({
        set: (uri: Uri, d: Diagnostic[]) => state.diagnostics.set(uri.toString(), d),
        delete: (uri: Uri) => state.diagnostics.delete(uri.toString()),
        dispose: () => undefined,
    }),
};

export const commands = {
    registerCommand: (id: string, fn: (...args: any[]) => any) => {
        state.commands.set(id, fn);
        return new Disposable();
    },
    executeCommand: async (id: string, ...args: any[]) => {
        if (id === 'setContext') {
            state.context.set(args[0], args[1]);
            return undefined;
        }
        if (id === 'workbench.action.openSettings' || id === 'markdown.showPreview') {
            state.opened.push(id);
            return undefined;
        }
        const fn = state.commands.get(id);
        if (!fn) {
            throw new Error('unknown command ' + id);
        }
        return fn(...args);
    },
};

export const env = {
    openExternal: async (uri: Uri) => {
        state.opened.push(uri.toString());
        return true;
    },
};

// ---------------------------------------------------------------- test helpers

export const fire = {
    activeEditor: (e: TextEditor | undefined) => {
        window.activeTextEditor = e;
        window.visibleTextEditors = e ? [e] : [];
        activeEditorEmitter.fire(e);
    },
    changeDocument: (d: TextDocument) => changeDocEmitter.fire({ document: d }),
    save: (d: TextDocument) => saveEmitter.fire(d),
    close: (d: TextDocument) => closeEmitter.fire(d),
    config: () => configEmitter.fire({ affectsConfiguration: (s: string) => s === 'codecomplexity' }),
};

export function openDocument(path: string, languageId: string, text: string): TextDocument {
    const doc = new TextDocument(Uri.file(path), languageId, text);
    state.documents.set(doc.uri.toString(), doc);
    return doc;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
