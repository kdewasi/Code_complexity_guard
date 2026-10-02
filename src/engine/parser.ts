/**
 * Loads the tree-sitter runtime and grammar binaries from the wasm/ folder.
 *
 * Everything is read from disk as bytes (no URLs, no fetch), which works the
 * same way inside the VS Code extension host, in the CLI and in the tests.
 * Grammars are loaded lazily and cached; parsers are reused per language.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Language as LanguageType, Parser as ParserType, Tree } from 'web-tree-sitter';
import { LanguageId } from './types';
import { getSpec } from './languages';

// Loaded with require() on purpose: web-tree-sitter ships an ESM build that
// relies on import.meta.url and a CJS build that does not. Bundlers pick the
// CJS build for require(), which is the one that works inside the VS Code
// extension host, in worker threads and in the CLI.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeSitter = require('web-tree-sitter') as typeof import('web-tree-sitter');
const Parser = treeSitter.Parser;
const Language = treeSitter.Language;
type Language = LanguageType;
type Parser = ParserType;

export class ParserManager {
    private initPromise: Promise<void> | undefined;
    private readonly languages = new Map<LanguageId, Promise<Language>>();
    private readonly parsers = new Map<LanguageId, Parser>();

    constructor(private readonly wasmDir: string) {}

    /** Initialises the runtime once. Safe to call many times. */
    init(): Promise<void> {
        if (!this.initPromise) {
            const runtime = path.join(this.wasmDir, 'web-tree-sitter.wasm');
            this.initPromise = Parser.init({ wasmBinary: fs.readFileSync(runtime) }).catch((err) => {
                this.initPromise = undefined;
                throw err;
            });
        }
        return this.initPromise;
    }

    async getLanguage(id: LanguageId): Promise<Language> {
        await this.init();
        let p = this.languages.get(id);
        if (!p) {
            const file = path.join(this.wasmDir, getSpec(id).wasmFile);
            p = Language.load(fs.readFileSync(file)).catch((err) => {
                this.languages.delete(id);
                throw err;
            });
            this.languages.set(id, p);
        }
        return p;
    }

    async getParser(id: LanguageId): Promise<Parser> {
        let parser = this.parsers.get(id);
        if (!parser) {
            const language = await this.getLanguage(id);
            parser = new Parser();
            parser.setLanguage(language);
            this.parsers.set(id, parser);
        }
        return parser;
    }

    /**
     * Parses source text. The caller owns the returned tree and must call
     * `tree.delete()` when done, otherwise WebAssembly memory leaks.
     */
    async parse(id: LanguageId, source: string): Promise<Tree> {
        const parser = await this.getParser(id);
        const tree = parser.parse(source);
        if (!tree) {
            throw new Error(`Parser for ${id} returned no tree`);
        }
        return tree;
    }

    dispose(): void {
        for (const p of this.parsers.values()) {
            p.delete();
        }
        this.parsers.clear();
        this.languages.clear();
    }
}
