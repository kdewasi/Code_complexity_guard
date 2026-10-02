/**
 * Plain-data facts collected while walking one function body.
 * No tree-sitter nodes are kept here, so a tree can be deleted right after the walk.
 */
import { Term } from './bigo';
import { Confidence, DecisionPoint, Evidence } from './types';

export interface LoopFact {
    index: number;
    line: number;
    endLine: number;
    kind: string;
    /** Growth contributed by this loop alone. */
    factor: Term;
    /** Why the factor was chosen, e.g. "iterates over `items`". */
    reason: string;
    confidence: Confidence;
    /** Number of enclosing loops (0 = outermost). */
    depth: number;
    parent: number;
    variables: string[];
    iterable?: string;
    /** First line of the loop as written, trimmed. */
    header: string;
}

export interface CallFact {
    line: number;
    name: string;
    receiver?: string;
    full: string;
    argsText: string[];
    /** Product of the enclosing loop factors. */
    factor: Term;
    enclosingLoops: number[];
    /** True when the call could be to another function defined in the same file. */
    userCandidate: boolean;
    text: string;
}

export interface RecursionSite {
    line: number;
    argsText: string[];
    receiverKind: 'none' | 'self' | 'member';
    /** An argument is the variable of an enclosing loop (recursing over children/parts). */
    viaLoopVariable: boolean;
}

export interface WorstCase {
    term: Term;
    evidence: Evidence[];
    confidence: Confidence;
}

export interface IfChainFact {
    line: number;
    endLine: number;
    branches: number;
    variable?: string;
}

export interface PairSearchFact {
    line: number;
    outerLoop: number;
    innerLoop: number;
}

export interface LocatedFact {
    line: number;
    endLine: number;
    factor: Term;
    enclosingLoops: number[];
    detail: string;
}

export interface FunctionFacts {
    name: string;
    cyclomatic: number;
    cognitive: number;
    maxNesting: number;
    decisionPoints: DecisionPoint[];
    loops: LoopFact[];
    calls: CallFact[];
    recursionSites: RecursionSite[];
    memoized: boolean;
    time: WorstCase;
    space: WorstCase;
    membershipScans: LocatedFact[];
    stringConcats: LocatedFact[];
    sortsInLoops: LocatedFact[];
    frontMutations: LocatedFact[];
    copiesInLoops: LocatedFact[];
    regexInLoops: LocatedFact[];
    /** Linear-cost calls evaluated in a loop condition (e.g. `i < strlen(s)`). */
    linearCallsInCondition: LocatedFact[];
    pairSearches: PairSearchFact[];
    ifChains: IfChainFact[];
    validationChain: { count: number; line: number; endLine: number } | null;
    complexConditions: { line: number; operators: number }[];
    emptyCatches: { line: number }[];
    lineCount: number;
    parameterCount: number;
    startLine: number;
    endLine: number;
}
