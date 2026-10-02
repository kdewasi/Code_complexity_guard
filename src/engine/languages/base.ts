/**
 * Shared helpers and sensible defaults for language specs.
 */
import type { Node } from 'web-tree-sitter';
import { CalleeInfo, LanguageSpec, LoopInfo, SnippetSet, set } from './spec';

export function field(node: Node | null | undefined, name: string): Node | null {
    return node ? node.childForFieldName(name) : null;
}

export function text(node: Node | null | undefined): string {
    return node ? node.text : '';
}

export function firstNamedOfType(node: Node | null | undefined, types: Iterable<string>): Node | null {
    if (!node) {
        return null;
    }
    const wanted = types instanceof Set ? types : new Set(types);
    for (const c of node.namedChildren) {
        if (wanted.has(c.type)) {
            return c;
        }
    }
    return null;
}

export function lastNamed(node: Node | null | undefined): Node | null {
    if (!node || node.namedChildCount === 0) {
        return null;
    }
    return node.namedChild(node.namedChildCount - 1);
}

/** Operator token of a binary/assignment node: the `operator` field or the first anonymous child. */
export function genericOperator(node: Node): string | undefined {
    const op = node.childForFieldName('operator');
    if (op) {
        return op.type === 'operator' || op.isNamed ? op.text : op.type;
    }
    for (const c of node.children) {
        if (!c.isNamed) {
            return c.type;
        }
    }
    return undefined;
}

/** Split a call target like "a.b.c", "A::b", "p->q" into receiver and name. */
export function splitCallee(full: string): CalleeInfo {
    const cleaned = full.replace(/\s+/g, '');
    const m = cleaned.match(/^(.*?)(?:\.|::|->|\?\.)([^.:>?]+)$/);
    if (m) {
        return { name: m[2], receiver: m[1], full: cleaned };
    }
    return { name: cleaned, full: cleaned };
}

/** Callee for grammars that use a `function` field (Python, JS, Go, Rust, C, C++, C#, PHP). */
export function calleeFromFunctionField(node: Node, fieldName = 'function'): CalleeInfo | undefined {
    const fn = node.childForFieldName(fieldName);
    if (!fn) {
        return undefined;
    }
    return splitCallee(fn.text);
}

/** Arguments for grammars with an `arguments` field; unwraps `argument` wrapper nodes. */
export function argumentsFromField(node: Node, fieldName = 'arguments'): Node[] {
    const args = node.childForFieldName(fieldName);
    if (!args) {
        return [];
    }
    const out: Node[] = [];
    for (const c of args.namedChildren) {
        if (c.type === 'argument' && c.namedChildCount > 0) {
            out.push(c.namedChild(c.namedChildCount - 1) as Node);
        } else if (c.type !== 'comment') {
            out.push(c);
        }
    }
    return out;
}

/** Count parameters: named children of the parameter list minus self/this and comments. */
export function countParameters(params: Node | null, selfNames: Set<string>): number {
    if (!params) {
        return 0;
    }
    let n = 0;
    for (const c of params.namedChildren) {
        if (c.type.includes('comment')) {
            continue;
        }
        const name = c.childForFieldName('name')?.text ?? c.childForFieldName('pattern')?.text ?? c.text;
        if (selfNames.has(name.trim())) {
            continue;
        }
        n++;
    }
    return n;
}

export function threeClauseLoop(node: Node, init: string, cond: string, update: string, body = 'body'): LoopInfo {
    const initNode = field(node, init);
    const variables: string[] = [];
    if (initNode) {
        for (const id of collectIdentifiers(initNode, 1)) {
            variables.push(id);
        }
    }
    return {
        kind: 'for',
        variables,
        init: initNode,
        condition: field(node, cond),
        update: field(node, update),
        body: field(node, body),
    };
}

/** Identifier-like texts found in a node, up to `max` (left-most first). */
export function collectIdentifiers(node: Node, max = 8): string[] {
    const out: string[] = [];
    const visit = (n: Node): void => {
        if (out.length >= max) {
            return;
        }
        if (n.namedChildCount === 0) {
            if (/^[A-Za-z_$@][\w$?!]*$/.test(n.text) && !KEYWORDS.has(n.text)) {
                out.push(n.text);
            }
            return;
        }
        for (const c of n.namedChildren) {
            visit(c);
        }
    };
    visit(node);
    return out;
}

/**
 * Parent node types that give an anonymous function a name
 * (`const f = () => {}`, `let g = |x| x`, `h := func() {}` ...): parent type → field holding the name.
 */
const LAMBDA_NAME_PARENTS: Record<string, string> = {
    variable_declarator: 'name',
    assignment_expression: 'left',
    assignment: 'left',
    assignment_statement: 'left',
    short_var_declaration: 'left',
    let_declaration: 'pattern',
    init_declarator: 'declarator',
    pair: 'key',
    public_field_definition: 'name',
    property_signature: 'name',
    var_spec: 'name',
    field_declaration: 'name',
};

/** Name under which an anonymous function was stored, if any. */
export function lambdaName(node: Node): string | undefined {
    const parent = node.parent;
    if (!parent) {
        return undefined;
    }
    if (parent.type === 'export_statement') {
        return 'default';
    }
    const fieldName = LAMBDA_NAME_PARENTS[parent.type];
    if (!fieldName) {
        return undefined;
    }
    const value = parent.childForFieldName('value') ?? parent.childForFieldName('right');
    if (value && !value.equals(node)) {
        return undefined;
    }
    if (!value && !lastNamed(parent)?.equals(node)) {
        return undefined;
    }
    const nameNode = parent.childForFieldName(fieldName);
    const name = nameNode?.text.replace(/\s+/g, ' ').trim();
    return name && name.length <= 80 ? name : undefined;
}

const KEYWORDS = set(
    'int', 'long', 'float', 'double', 'char', 'short', 'auto', 'var', 'let', 'const', 'size_t', 'string', 'bool',
    'boolean', 'byte', 'true', 'false', 'null', 'nil', 'None', 'True', 'False', 'mut', 'usize', 'i32', 'i64', 'u32', 'u64',
);

export const EMPTY: Set<string> = new Set();

export const DEFAULT_SNIPPETS: SnippetSet = {
    membershipSet: {
        before: 'for item in items:\n    if item in big_list:      # scans big_list every time\n        ...',
        after: 'lookup = set(big_list)      # build once\nfor item in items:\n    if item in lookup:        # instant check\n        ...',
    },
    memoization: {
        before: 'def fib(n):\n    if n < 2: return n\n    return fib(n - 1) + fib(n - 2)',
        after: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2: return n\n    return fib(n - 1) + fib(n - 2)',
    },
    guardClauses: {
        before: 'if user:\n    if user.active:\n        if order:\n            process(order)',
        after: 'if not user or not user.active:\n    return\nif not order:\n    return\nprocess(order)',
    },
    dispatchTable: {
        before: "if kind == 'a':\n    handle_a()\nelif kind == 'b':\n    handle_b()\nelif kind == 'c':\n    handle_c()",
        after: "handlers = {'a': handle_a, 'b': handle_b, 'c': handle_c}\nhandlers[kind]()",
    },
    hoistSort: {
        before: 'for q in queries:\n    data.sort()        # sorted again on every iteration\n    use(data, q)',
        after: 'data.sort()            # sort once\nfor q in queries:\n    use(data, q)',
    },
    pairLookup: {
        before: 'for a in left:\n    for b in right:\n        if a.id == b.id:\n            merge(a, b)',
        after: 'by_id = {b.id: b for b in right}\nfor a in left:\n    b = by_id.get(a.id)\n    if b:\n        merge(a, b)',
    },
};

/**
 * Builds a complete spec from the fields a language actually needs to set.
 * Everything not provided falls back to an empty set or a generic helper.
 */
export function makeSpec(partial: Partial<LanguageSpec> & Pick<LanguageSpec, 'id' | 'name' | 'wasmFile' | 'lineComment'>): LanguageSpec {
    const selfNames = partial.selfNames ?? set('self', 'this', 'cls');
    const base: LanguageSpec = {
        id: partial.id,
        name: partial.name,
        wasmFile: partial.wasmFile,
        lineComment: partial.lineComment,
        functionNodes: EMPTY,
        lambdaNodes: EMPTY,
        classNodes: EMPTY,
        getFunctionName: (n) => field(n, 'name')?.text,
        getClassName: (n) => field(n, 'name')?.text,
        getParameterCount: (n) => countParameters(field(n, 'parameters'), selfNames),
        getFunctionKind: () => 'function',
        getBody: (n) => field(n, 'body'),
        loopNodes: EMPTY,
        getLoopInfo: (n) => ({ kind: 'loop', variables: [], body: field(n, 'body') }),
        ifNodes: EMPTY,
        elseIfNodes: EMPTY,
        elseNodes: EMPTY,
        getIfCondition: (n) => field(n, 'condition'),
        switchNodes: EMPTY,
        caseNodes: EMPTY,
        isDefaultCase: () => false,
        ternaryNodes: EMPTY,
        catchNodes: EMPTY,
        binaryNodes: EMPTY,
        booleanOperators: set('&&', '||', 'and', 'or', '??'),
        getOperator: genericOperator,
        callNodes: EMPTY,
        getCallee: (n) => calleeFromFunctionField(n),
        getArguments: (n) => argumentsFromField(n),
        throwNodes: EMPTY,
        returnNodes: set('return_statement'),
        assignmentNodes: EMPTY,
        getAssignment: (n) => {
            const left = field(n, 'left') ?? field(n, 'name') ?? field(n, 'pattern') ?? field(n, 'declarator');
            const right = field(n, 'right') ?? field(n, 'value');
            if (!left) {
                return undefined;
            }
            return { target: left.text, operator: genericOperator(n) ?? '=', value: right };
        },
        collectionLiteralNodes: EMPTY,
        stringLiteralNodes: EMPTY,
        subscriptNodes: EMPTY,
        memberNodes: EMPTY,
        identifierNodes: set('identifier'),
        numberLiteralNodes: EMPTY,
        commentNodes: set('comment', 'line_comment', 'block_comment'),
        decoratorNodes: EMPTY,
        iteratorMethods: EMPTY,
        appendMethods: EMPTY,
        sortCalls: EMPTY,
        linearSearchCalls: EMPTY,
        copyCalls: EMPTY,
        frontMutationCalls: EMPTY,
        regexCompileCalls: EMPTY,
        linearBuiltins: EMPTY,
        collectionConstructors: EMPTY,
        hashTypeNames: EMPTY,
        listTypeNames: EMPTY,
        membershipOperators: EMPTY,
        stringConcatIsQuadratic: false,
        selfNames,
        snippets: DEFAULT_SNIPPETS,
    };
    return { ...base, ...partial, selfNames };
}
