import type { Node } from 'web-tree-sitter';
import { set } from './spec';
import { argumentsFromField, calleeFromFunctionField, countParameters, field, makeSpec } from './base';

export const python = makeSpec({
    id: 'python',
    name: 'Python',
    wasmFile: 'tree-sitter-python.wasm',
    lineComment: '#',
    functionNodes: set('function_definition'),
    lambdaNodes: set('lambda'),
    classNodes: set('class_definition'),
    getFunctionKind: (n) => {
        const name = field(n, 'name')?.text ?? '';
        if (name === '__init__') {
            return 'constructor';
        }
        const holder = n.parent?.type === 'decorated_definition' ? n.parent : n;
        return holder.parent?.type === 'block' && holder.parent.parent?.type === 'class_definition' ? 'method' : 'function';
    },
    getParameterCount: (n) => countParameters(field(n, 'parameters'), set('self', 'cls')),
    loopNodes: set('for_statement', 'while_statement', 'for_in_clause'),
    getLoopInfo: (n) => {
        if (n.type === 'for_statement' || n.type === 'for_in_clause') {
            const right = field(n, 'right');
            return {
                kind: n.type === 'for_statement' ? 'foreach' : 'comprehension',
                variables: [field(n, 'left')?.text ?? ''],
                iterable: right?.text,
                condition: right,
                body: field(n, 'body'),
            };
        }
        return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
    },
    ifNodes: set('if_statement'),
    elseIfNodes: set('elif_clause'),
    elseNodes: set('else_clause'),
    switchNodes: set('match_statement'),
    caseNodes: set('case_clause'),
    isDefaultCase: (n) => {
        const pats = n.namedChildren.filter((c) => c.type === 'case_pattern');
        return pats.length === 1 && pats[0].text.trim() === '_';
    },
    ternaryNodes: set('conditional_expression'),
    catchNodes: set('except_clause', 'except_group_clause'),
    binaryNodes: set('boolean_operator', 'binary_operator'),
    booleanOperators: set('and', 'or'),
    callNodes: set('call'),
    getCallee: (n) => calleeFromFunctionField(n),
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set('raise_statement'),
    assignmentNodes: set('assignment', 'augmented_assignment'),
    collectionLiteralNodes: set('list', 'dictionary', 'set', 'list_comprehension', 'set_comprehension', 'dictionary_comprehension', 'generator_expression'),
    stringLiteralNodes: set('string', 'concatenated_string'),
    subscriptNodes: set('subscript'),
    memberNodes: set('attribute'),
    numberLiteralNodes: set('integer', 'float'),
    decoratorNodes: set('decorator'),
    iteratorMethods: set('map', 'filter', 'reduce', 'sum', 'any', 'all', 'min', 'max', 'enumerate', 'zip', 'sorted', 'reversed', 'join', 'functools.reduce'),
    appendMethods: set('append', 'extend', 'add', 'insert', 'update', 'appendleft', 'setdefault'),
    sortCalls: set('sort', 'sorted'),
    linearSearchCalls: set('index', 'count', 'remove'),
    copyCalls: set('list', 'tuple', 'set', 'dict', 'copy', 'deepcopy', 'sorted', 'reversed', 'frozenset'),
    frontMutationCalls: set('pop(0)', 'insert(0'),
    regexCompileCalls: set('re.compile', 'compile'),
    linearBuiltins: set('sum', 'min', 'max', 'any', 'all', 'sorted', 'reversed', 'join', 'list', 'tuple', 'set', 'dict', 'extend', 'zip', 'enumerate', 'filter', 'map', 'reduce'),
    collectionConstructors: set('list', 'dict', 'set', 'tuple', 'defaultdict', 'OrderedDict', 'Counter', 'deque', 'frozenset', 'collections.defaultdict', 'collections.deque', 'collections.Counter', 'collections.OrderedDict'),
    hashTypeNames: set('set', 'dict', 'defaultdict', 'OrderedDict', 'Counter', 'frozenset', 'collections.defaultdict', 'collections.Counter', 'collections.OrderedDict'),
    listTypeNames: set('list', 'tuple', 'deque'),
    membershipOperators: set('in', 'not in'),
    stringConcatIsQuadratic: true,
    selfNames: set('self', 'cls'),
    snippets: {
        membershipSet: {
            before: 'for item in items:\n    if item in big_list:      # scans big_list every time\n        ...',
            after: 'lookup = set(big_list)      # build once\nfor item in items:\n    if item in lookup:        # instant check\n        ...',
        },
        stringBuilder: {
            before: 'result = ""\nfor part in parts:\n    result += part      # copies the whole string each time',
            after: 'result = "".join(parts)   # one pass',
        },
        frontRemoval: {
            before: 'while queue:\n    item = queue.pop(0)   # shifts every remaining element',
            after: 'from collections import deque\nqueue = deque(queue)\nwhile queue:\n    item = queue.popleft()   # O(1)',
        },
        memoization: {
            before: 'def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)',
            after: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)',
        },
        guardClauses: {
            before: 'def process(user, order):\n    if user:\n        if user.active:\n            if order:\n                return handle(order)\n    return None',
            after: 'def process(user, order):\n    if not user or not user.active:\n        return None\n    if not order:\n        return None\n    return handle(order)',
        },
        dispatchTable: {
            before: "if kind == 'card':\n    pay_card()\nelif kind == 'paypal':\n    pay_paypal()\nelif kind == 'bank':\n    pay_bank()\nelif kind == 'cash':\n    pay_cash()",
            after: "HANDLERS = {\n    'card': pay_card,\n    'paypal': pay_paypal,\n    'bank': pay_bank,\n    'cash': pay_cash,\n}\nHANDLERS[kind]()",
        },
        hoistSort: {
            before: 'for q in queries:\n    data.sort()        # sorted again on every iteration\n    answer(data, q)',
            after: 'data.sort()            # sort once\nfor q in queries:\n    answer(data, q)',
        },
        pairLookup: {
            before: 'for a in left:\n    for b in right:\n        if a.id == b.id:\n            merge(a, b)',
            after: 'by_id = {b.id: b for b in right}\nfor a in left:\n    b = by_id.get(a.id)\n    if b is not None:\n        merge(a, b)',
        },
    },
});

/** True when an `except` clause body does nothing (pass / ellipsis only). */
export function isEmptyExcept(node: Node): boolean {
    const block = node.namedChildren.find((c) => c.type === 'block');
    if (!block) {
        return false;
    }
    return block.namedChildren.every((c) => c.type === 'pass_statement' || c.type === 'comment' || (c.type === 'expression_statement' && c.text === '...'));
}
