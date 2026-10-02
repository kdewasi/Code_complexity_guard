/**
 * Per-language description of the tree-sitter grammar: which node types are
 * functions, loops, branches, calls, and so on. The generic walker in
 * ../walker.ts drives everything from these specs, so adding a language means
 * adding one spec file (and its .wasm grammar) and nothing else.
 */
import type { Node } from 'web-tree-sitter';
import { LanguageId } from '../types';

export interface CalleeInfo {
    /** The last identifier of the call target, e.g. "sort" in "xs.sort(...)". */
    name: string;
    /** Source text of the receiver / object part, e.g. "xs" in "xs.sort(...)". */
    receiver?: string;
    /** Whole call target as written, e.g. "Collections.sort". */
    full: string;
}

export interface LoopInfo {
    /** Variable(s) driving the loop, when it is possible to tell. */
    variables: string[];
    /** Source text of the iterated collection or range, when applicable. */
    iterable?: string;
    /** The three-clause for-loop pieces when present. */
    init?: Node | null;
    condition?: Node | null;
    update?: Node | null;
    /** Body node (statement block). */
    body?: Node | null;
    kind: 'for' | 'foreach' | 'while' | 'do' | 'loop' | 'comprehension' | 'iterator';
}

export interface LanguageSpec {
    id: LanguageId;
    name: string;
    wasmFile: string;
    /** How a line comment starts, used when generating snippets and ignore hints. */
    lineComment: string;

    /** Named function-like definitions that become their own analysis units. */
    functionNodes: Set<string>;
    /** Anonymous function-like nodes that are analysed inside their parent. */
    lambdaNodes: Set<string>;
    /** Class / struct / impl / module nodes used to build qualified names. */
    classNodes: Set<string>;

    getFunctionName(node: Node): string | undefined;
    getClassName(node: Node): string | undefined;
    getParameterCount(node: Node): number;
    getFunctionKind(node: Node): 'function' | 'method' | 'constructor';
    /** Node that holds the executable statements (used for validation-chain detection). */
    getBody(node: Node): Node | null;
    /** Line containing the name (defaults to node.startPosition.row). */
    getNameLine?(node: Node): number;

    loopNodes: Set<string>;
    getLoopInfo(node: Node): LoopInfo;

    ifNodes: Set<string>;
    /** else-if clauses that do not increase nesting (elif_clause, else_if_clause, elsif). */
    elseIfNodes: Set<string>;
    elseNodes: Set<string>;
    getIfCondition(node: Node): Node | null;

    switchNodes: Set<string>;
    caseNodes: Set<string>;
    isDefaultCase(node: Node): boolean;

    ternaryNodes: Set<string>;
    catchNodes: Set<string>;
    /** Node types that may be boolean operators; getOperator decides. */
    binaryNodes: Set<string>;
    booleanOperators: Set<string>;
    getOperator(node: Node): string | undefined;

    callNodes: Set<string>;
    getCallee(node: Node): CalleeInfo | undefined;
    getArguments(node: Node): Node[];

    /** Nodes that raise/throw. */
    throwNodes: Set<string>;
    returnNodes: Set<string>;

    /** Assignment-ish nodes (incl. augmented) and how to read them. */
    assignmentNodes: Set<string>;
    getAssignment(node: Node): { target: string; operator: string; value: Node | null } | undefined;

    /** Literal collection constructors ([], {}, new ArrayList...). */
    collectionLiteralNodes: Set<string>;
    stringLiteralNodes: Set<string>;
    /** Subscript / index expressions (a[i]). */
    subscriptNodes: Set<string>;
    /** Member access (a.b) – used for structural recursion detection. */
    memberNodes: Set<string>;
    identifierNodes: Set<string>;
    numberLiteralNodes: Set<string>;
    /** Comment node types. */
    commentNodes: Set<string>;
    /** Decorator / attribute nodes used to detect memoization. */
    decoratorNodes: Set<string>;

    /** Method names that iterate a collection with a callback (forEach, map, each ...). */
    iteratorMethods: Set<string>;
    /** Method names that append to a collection. */
    appendMethods: Set<string>;
    /** Call names that sort (n log n). */
    sortCalls: Set<string>;
    /** Call names that perform a linear scan (contains, indexOf ...). */
    linearSearchCalls: Set<string>;
    /** Call names that copy a collection (linear). */
    copyCalls: Set<string>;
    /** Call names that remove/insert at the front of an array-backed list. */
    frontMutationCalls: Set<string>;
    /** Call names that compile a regular expression. */
    regexCompileCalls: Set<string>;
    /** Builtins that are linear in the size of their argument (min, max, sum, strlen ...). */
    linearBuiltins: Set<string>;
    /** Collection constructors that build a new collection (set(), list(), new HashSet ...). */
    collectionConstructors: Set<string>;
    /** Names of hash-based types; a variable created from these has O(1) membership. */
    hashTypeNames: Set<string>;
    /** Names of list/array types with O(n) membership. */
    listTypeNames: Set<string>;
    /** Python-style membership operator in a comparison ("in", "not in"). */
    membershipOperators: Set<string>;
    /** Whether `+=` on a string variable is a quadratic pattern in this language. */
    stringConcatIsQuadratic: boolean;
    /** Keywords/identifiers to ignore as loop variables (self, this). */
    selfNames: Set<string>;

    /** Snippet templates for suggestions. */
    snippets: SnippetSet;
}

export interface SnippetSet {
    membershipSet: { before: string; after: string };
    stringBuilder?: { before: string; after: string };
    frontRemoval?: { before: string; after: string };
    memoization: { before: string; after: string };
    guardClauses: { before: string; after: string };
    dispatchTable: { before: string; after: string };
    hoistSort: { before: string; after: string };
    pairLookup: { before: string; after: string };
}

export function set(...items: string[]): Set<string> {
    return new Set(items);
}

/** Text of the first identifier-ish child, used by several specs. */
export function firstChildText(node: Node, types: string[]): string | undefined {
    for (const c of node.namedChildren) {
        if (types.includes(c.type)) {
            return c.text;
        }
    }
    return undefined;
}

export function countNamed(node: Node | null, skip: Set<string> = new Set()): number {
    if (!node) {
        return 0;
    }
    let n = 0;
    for (const c of node.namedChildren) {
        if (c.type === 'comment' || c.type.includes('comment')) {
            continue;
        }
        if (skip.has(c.text)) {
            continue;
        }
        n++;
    }
    return n;
}
