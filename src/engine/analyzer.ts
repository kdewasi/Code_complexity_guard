/**
 * Public entry point of the engine: source text in, FileAnalysis out.
 * Independent of VS Code so the CLI and the tests use the same code.
 */
import type { Node, Tree } from 'web-tree-sitter';
import { ONE, toBigO } from './bigo';
import { classifyRecursion, foldRecursionIntoSpace, foldRecursionIntoTime, resolveCallGraph, CallGraphEntry } from './complexity';
import { FunctionFacts } from './facts';
import { getSpec, languageFromFileName, languageFromVsCodeId } from './languages';
import { LanguageSpec } from './languages/spec';
import { lambdaName } from './languages/base';
import { ParserManager } from './parser';
import { rateFile, rateFunction } from './rating';
import { buildSuggestions } from './suggestions';
import { DEFAULT_THRESHOLDS, FileAnalysis, FileTotals, FunctionAnalysis, Grade, LanguageId, Thresholds } from './types';
import { FunctionWalker } from './walker';

export interface AnalyzeOptions {
    thresholds?: Partial<Thresholds>;
    /** Skip files larger than this many characters. */
    maxChars?: number;
}

const IGNORE_RE = /(codecomplexity|complexity-guard|complexity)\s*:\s*ignore\b/;
const IGNORE_FILE_RE = /(codecomplexity|complexity-guard|complexity)\s*:\s*ignore-file\b/;

interface Unit {
    node: Node;
    name: string;
    qualifiedName: string;
    kind: FunctionAnalysis['kind'];
}

export class Analyzer {
    constructor(private readonly parsers: ParserManager) {}

    static languageFor(vscodeLanguageId: string | undefined, fileName?: string): LanguageId | undefined {
        return (vscodeLanguageId ? languageFromVsCodeId(vscodeLanguageId) : undefined) ?? (fileName ? languageFromFileName(fileName) : undefined);
    }

    async analyze(source: string, languageId: LanguageId, options: AnalyzeOptions = {}): Promise<FileAnalysis> {
        const started = Date.now();
        const spec = getSpec(languageId);
        const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
        const lines = source.split('\n');
        if (options.maxChars && source.length > options.maxChars) {
            return emptyAnalysis(spec, lines.length, started, 0);
        }
        if (lines.slice(0, 5).some((l) => IGNORE_FILE_RE.test(l))) {
            return emptyAnalysis(spec, lines.length, started, 0);
        }
        const tree: Tree = await this.parsers.parse(languageId, source);
        try {
            const root = tree.rootNode;
            const parseErrors = countErrors(root);
            const units = collectUnits(root, spec);
            const partial: { unit: Unit; facts: FunctionFacts; entry: CallGraphEntry; recursion: ReturnType<typeof classifyRecursion> }[] = [];
            for (const unit of units) {
                const walker = new FunctionWalker(spec, unit.node, unit.name, unit.kind !== 'function');
                const facts = walker.run();
                const recursion = classifyRecursion(facts.recursionSites, facts.memoized);
                const time = foldRecursionIntoTime(facts, recursion);
                partial.push({ unit, facts, recursion, entry: { name: unit.name, facts, time } });
            }
            resolveCallGraph(partial.map((p) => p.entry));

            const functions: FunctionAnalysis[] = partial.map(({ unit, facts, recursion, entry }) => {
                const time = entry.time;
                const space = foldRecursionIntoSpace(facts, recursion);
                const suggestions = buildSuggestions({ spec, facts, recursion, time: time.term, thresholds, source: lines });
                const rating = rateFunction({
                    cyclomatic: facts.cyclomatic,
                    cognitive: facts.cognitive,
                    maxNesting: facts.maxNesting,
                    lineCount: facts.lineCount,
                    parameterCount: facts.parameterCount,
                    time: time.term,
                    timeConfidence: time.confidence,
                    suggestions,
                    thresholds,
                    name: unit.name,
                });
                const nameLine = nameLineOf(unit.node, spec);
                const calls = [...new Set(facts.calls.filter((c) => c.userCandidate).map((c) => c.name))];
                return {
                    name: unit.name,
                    qualifiedName: unit.qualifiedName,
                    kind: unit.kind,
                    startLine: facts.startLine,
                    endLine: facts.endLine,
                    nameLine,
                    lineCount: facts.lineCount,
                    parameterCount: facts.parameterCount,
                    cyclomatic: facts.cyclomatic,
                    cognitive: facts.cognitive,
                    maxNesting: facts.maxNesting,
                    decisionPoints: facts.decisionPoints,
                    time: toBigO(time.term, time.evidence, time.confidence),
                    space: toBigO(space.term, space.evidence, space.confidence, true),
                    recursion,
                    calls,
                    suggestions,
                    rating,
                    ignored: isIgnored(lines, unit.node.startPosition.row, nameLine),
                };
            });
            functions.sort((a, b) => a.startLine - b.startLine);
            const totals = computeTotals(functions);
            return {
                languageId,
                languageName: spec.name,
                functions,
                parseErrors,
                totals,
                fileRating: rateFile(functions),
                durationMs: Date.now() - started,
                lineCount: lines.length,
            };
        } finally {
            tree.delete();
        }
    }
}

function emptyAnalysis(spec: LanguageSpec, lineCount: number, started: number, parseErrors: number): FileAnalysis {
    return {
        languageId: spec.id,
        languageName: spec.name,
        functions: [],
        parseErrors,
        totals: computeTotals([]),
        fileRating: rateFile([]),
        durationMs: Date.now() - started,
        lineCount,
    };
}

function countErrors(root: Node): number {
    if (!root.hasError) {
        return 0;
    }
    let n = 0;
    const stack: Node[] = [root];
    while (stack.length) {
        const node = stack.pop() as Node;
        if (node.isError || node.isMissing) {
            n++;
            continue;
        }
        if (!node.hasError) {
            continue;
        }
        for (const c of node.children) {
            stack.push(c);
        }
        if (n > 50) {
            break;
        }
    }
    return n;
}

function collectUnits(root: Node, spec: LanguageSpec): Unit[] {
    const units: Unit[] = [];
    const classStack: string[] = [];
    const visit = (node: Node): void => {
        const type = node.type;
        if (spec.commentNodes.has(type)) {
            return;
        }
        let pushedClass = false;
        if (spec.classNodes.has(type)) {
            const cn = spec.getClassName(node);
            if (cn) {
                classStack.push(cn);
                pushedClass = true;
            }
        }
        let name: string | undefined;
        let kind: FunctionAnalysis['kind'] | undefined;
        if (spec.functionNodes.has(type)) {
            if (hasBody(node, spec)) {
                name = spec.getFunctionName(node) ?? '(anonymous)';
                kind = spec.getFunctionKind(node);
            }
        } else if (spec.lambdaNodes.has(type)) {
            const ln = lambdaName(node);
            if (ln) {
                name = ln;
                kind = 'function';
            }
        }
        if (name && kind) {
            const qualified = classStack.length && !name.includes('::') && !name.includes('.') ? `${classStack[classStack.length - 1]}.${name}` : name;
            units.push({ node, name, qualifiedName: qualified, kind });
        }
        for (const c of node.namedChildren) {
            visit(c);
        }
        if (pushedClass) {
            classStack.pop();
        }
    };
    visit(root);
    return units;
}

function hasBody(node: Node, spec: LanguageSpec): boolean {
    if (spec.id === 'python' || spec.id === 'ruby') {
        return true;
    }
    return !!spec.getBody(node);
}

function nameLineOf(node: Node, spec: LanguageSpec): number {
    if (spec.getNameLine) {
        return spec.getNameLine(node);
    }
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
        return nameNode.startPosition.row;
    }
    const decl = node.childForFieldName('declarator');
    if (decl) {
        return decl.startPosition.row;
    }
    return node.startPosition.row;
}

function isIgnored(lines: string[], startLine: number, nameLine: number): boolean {
    const from = Math.max(0, startLine - 3);
    for (let i = from; i <= Math.min(nameLine + 1, lines.length - 1); i++) {
        if (IGNORE_RE.test(lines[i])) {
            return true;
        }
    }
    return false;
}

function computeTotals(functions: FunctionAnalysis[]): FileTotals {
    const counted = functions.filter((f) => !f.ignored);
    const gradeCounts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
    let worstTime: FunctionAnalysis['time'] | null = null;
    let worstSpace: FunctionAnalysis['space'] | null = null;
    let sumCyc = 0;
    let sumCog = 0;
    let maxCyc = 0;
    let maxCog = 0;
    let suggestionCount = 0;
    for (const f of counted) {
        gradeCounts[f.rating.grade] += 1;
        sumCyc += f.cyclomatic;
        sumCog += f.cognitive;
        maxCyc = Math.max(maxCyc, f.cyclomatic);
        maxCog = Math.max(maxCog, f.cognitive);
        suggestionCount += f.suggestions.length;
        if (!worstTime || f.time.rank > worstTime.rank) {
            worstTime = f.time;
        }
        if (!worstSpace || f.space.rank > worstSpace.rank) {
            worstSpace = f.space;
        }
    }
    const n = counted.length;
    return {
        functionCount: n,
        avgCyclomatic: n ? Math.round((sumCyc / n) * 10) / 10 : 0,
        maxCyclomatic: maxCyc,
        avgCognitive: n ? Math.round((sumCog / n) * 10) / 10 : 0,
        maxCognitive: maxCog,
        worstTime,
        worstSpace,
        gradeCounts,
        suggestionCount,
    };
}

export { ONE };
