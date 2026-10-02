/**
 * Shared result types for the analysis engine.
 *
 * Everything here is plain data (no tree-sitter objects), so results can be
 * cached, serialized to JSON for the CLI, and posted to webviews safely.
 * All line numbers are 0-based unless the field name says otherwise.
 */

export type LanguageId =
    | 'python'
    | 'java'
    | 'javascript'
    | 'typescript'
    | 'tsx'
    | 'go'
    | 'rust'
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'ruby'
    | 'php';

export type Grade = 'A' | 'B' | 'C' | 'D';

export type Confidence = 'high' | 'medium' | 'low';

/** A single piece of evidence pointing at a line of code. */
export interface Evidence {
    line: number;
    text: string;
}

/** One control-flow construct that contributed to the complexity numbers. */
export interface DecisionPoint {
    line: number;
    kind: string;
    description: string;
    /** Cognitive-complexity nesting level at this point (0 = top level of the function). */
    nesting: number;
    cyclomaticIncrement: number;
    cognitiveIncrement: number;
}

/** An asymptotic bound, e.g. O(n log n). */
export interface BigO {
    /** Human notation such as "O(n²)". */
    notation: string;
    /** Short word such as "quadratic". */
    label: string;
    /** One plain-language sentence describing what the growth means in practice. */
    plain: string;
    /** Sortable growth rank (0 = constant, higher = slower). */
    rank: number;
    confidence: Confidence;
    evidence: Evidence[];
}

export interface RecursionInfo {
    isRecursive: boolean;
    /** Number of distinct self-call sites. */
    callSites: number;
    /** How the input appears to shrink on each call. */
    reduction: 'linear' | 'halving' | 'structural' | 'unknown' | 'none';
    memoized: boolean;
    lines: number[];
}

export type SuggestionSeverity = 'info' | 'warning' | 'critical';
export type SuggestionCategory = 'performance' | 'readability' | 'structure';

export interface Suggestion {
    id: string;
    title: string;
    severity: SuggestionSeverity;
    category: SuggestionCategory;
    line: number;
    endLine: number;
    /** Plain-language explanation of what is wrong and why it matters. */
    problem: string;
    /** What to do instead. */
    fix: string;
    /** Expected effect, e.g. "O(n²) → O(n)". */
    impact?: string;
    before?: string;
    after?: string;
}

export interface Rating {
    grade: Grade;
    /** "Excellent", "Good", "Needs attention" or "Poor". */
    label: string;
    /** One sentence verdict. */
    summary: string;
    /** Reasons in plain language. */
    reasons: string[];
}

export interface FunctionAnalysis {
    name: string;
    /** Name with enclosing class/namespace, e.g. "OrderService.process". */
    qualifiedName: string;
    kind: 'function' | 'method' | 'constructor' | 'lambda';
    startLine: number;
    endLine: number;
    /** Line that carries the function name (where CodeLens and decorations go). */
    nameLine: number;
    lineCount: number;
    parameterCount: number;
    cyclomatic: number;
    cognitive: number;
    maxNesting: number;
    decisionPoints: DecisionPoint[];
    time: BigO;
    space: BigO;
    recursion: RecursionInfo;
    /** Names of same-file functions this function calls. */
    calls: string[];
    suggestions: Suggestion[];
    rating: Rating;
    ignored: boolean;
}

export interface FileTotals {
    functionCount: number;
    avgCyclomatic: number;
    maxCyclomatic: number;
    avgCognitive: number;
    maxCognitive: number;
    worstTime: BigO | null;
    worstSpace: BigO | null;
    gradeCounts: Record<Grade, number>;
    suggestionCount: number;
}

export interface FileAnalysis {
    languageId: LanguageId;
    languageName: string;
    functions: FunctionAnalysis[];
    /** Number of syntax-error nodes tree-sitter reported; metrics are still produced. */
    parseErrors: number;
    totals: FileTotals;
    fileRating: Rating;
    durationMs: number;
    lineCount: number;
}

export interface Thresholds {
    cyclomaticWarning: number;
    cyclomaticCritical: number;
    cognitiveWarning: number;
    cognitiveCritical: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
    cyclomaticWarning: 8,
    cyclomaticCritical: 15,
    cognitiveWarning: 15,
    cognitiveCritical: 25,
};
