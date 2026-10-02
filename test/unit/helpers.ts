import * as path from 'path';
import { Analyzer, FileAnalysis, FunctionAnalysis, LanguageId, ParserManager } from '../../src/engine';

const wasmDir = path.resolve(__dirname, '..', '..', '..', 'wasm');
const parsers = new ParserManager(wasmDir);
export const analyzer = new Analyzer(parsers);

export async function analyze(language: LanguageId, source: string): Promise<FileAnalysis> {
    return analyzer.analyze(source, language);
}

export async function fn(language: LanguageId, source: string, name: string): Promise<FunctionAnalysis> {
    const result = await analyze(language, source);
    const found = result.functions.find((f) => f.name === name || f.qualifiedName === name);
    if (!found) {
        throw new Error(`function ${name} not found; got ${result.functions.map((f) => f.qualifiedName).join(', ')}`);
    }
    return found;
}

export function ids(f: FunctionAnalysis): string[] {
    return f.suggestions.map((s) => s.id);
}
