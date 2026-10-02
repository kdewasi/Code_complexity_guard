import { set } from './spec';
import { argumentsFromField, field, makeSpec, splitCallee, threeClauseLoop } from './base';

export const php = makeSpec({
    id: 'php',
    name: 'PHP',
    wasmFile: 'tree-sitter-php.wasm',
    lineComment: '//',
    functionNodes: set('function_definition', 'method_declaration'),
    lambdaNodes: set('anonymous_function', 'arrow_function', 'anonymous_function_creation_expression'),
    classNodes: set('class_declaration', 'interface_declaration', 'trait_declaration', 'enum_declaration', 'namespace_definition'),
    getFunctionKind: (n) => {
        if (n.type === 'method_declaration') {
            return field(n, 'name')?.text === '__construct' ? 'constructor' : 'method';
        }
        return 'function';
    },
    loopNodes: set('for_statement', 'foreach_statement', 'while_statement', 'do_statement'),
    getLoopInfo: (n) => {
        switch (n.type) {
            case 'for_statement':
                return threeClauseLoop(n, 'initialize', 'condition', 'update');
            case 'foreach_statement': {
                const named = n.namedChildren.filter((c) => c.type !== 'compound_statement' && c.type !== 'colon_block');
                const iterable = named[0];
                const vars = named.slice(1).map((c) => c.text);
                return { kind: 'foreach', variables: vars, iterable: iterable?.text, body: field(n, 'body') };
            }
            case 'do_statement':
                return { kind: 'do', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
            default:
                return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
        }
    },
    ifNodes: set('if_statement'),
    elseIfNodes: set('else_if_clause'),
    elseNodes: set('else_clause'),
    switchNodes: set('switch_statement', 'match_expression'),
    caseNodes: set('case_statement', 'match_conditional_expression'),
    ternaryNodes: set('conditional_expression'),
    catchNodes: set('catch_clause'),
    binaryNodes: set('binary_expression'),
    booleanOperators: set('&&', '||', 'and', 'or', 'xor', '??'),
    callNodes: set('function_call_expression', 'member_call_expression', 'scoped_call_expression', 'nullsafe_member_call_expression', 'object_creation_expression'),
    getCallee: (n) => {
        if (n.type === 'object_creation_expression') {
            const t = n.namedChildren.find((c) => c.type === 'name' || c.type === 'qualified_name')?.text ?? '';
            return { name: `new ${t}`, full: `new ${t}` };
        }
        if (n.type === 'function_call_expression') {
            return splitCallee(field(n, 'function')?.text ?? '');
        }
        const name = field(n, 'name')?.text ?? '';
        const obj = field(n, 'object')?.text ?? field(n, 'scope')?.text;
        return { name, receiver: obj, full: obj ? `${obj}.${name}` : name };
    },
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set('throw_expression', 'throw_statement'),
    assignmentNodes: set('assignment_expression', 'augmented_assignment_expression'),
    collectionLiteralNodes: set('array_creation_expression'),
    stringLiteralNodes: set('string', 'encapsed_string', 'heredoc', 'nowdoc'),
    subscriptNodes: set('subscript_expression'),
    memberNodes: set('member_access_expression', 'nullsafe_member_access_expression'),
    identifierNodes: set('variable_name', 'name'),
    numberLiteralNodes: set('integer', 'float'),
    decoratorNodes: set('attribute_list'),
    iteratorMethods: set('array_map', 'array_filter', 'array_walk', 'array_reduce', 'usort', 'uasort', 'uksort', 'array_sum', 'max', 'min', 'count_', 'in_array_', 'implode', 'array_keys', 'array_values', 'array_merge', 'array_unique', 'array_reverse', 'array_slice', 'array_column'),
    appendMethods: set('array_push', 'array_unshift', 'push'),
    sortCalls: set('sort', 'rsort', 'usort', 'uasort', 'uksort', 'asort', 'arsort', 'ksort', 'krsort'),
    linearSearchCalls: set('in_array', 'array_search', 'array_key_exists_'),
    copyCalls: set('array_merge', 'array_slice', 'array_values', 'array_keys', 'array_unique', 'array_reverse', 'clone'),
    frontMutationCalls: set('array_shift', 'array_unshift'),
    regexCompileCalls: set(),
    linearBuiltins: set('implode', 'array_sum', 'array_merge', 'array_unique', 'array_reverse', 'array_keys', 'array_values', 'max', 'min', 'array_slice', 'array_column', 'array_flip', 'array_fill', 'range', 'array_combine', 'array_diff', 'array_intersect'),
    collectionConstructors: set('array', 'new ArrayObject', 'new SplStack', 'new SplQueue', 'new SplObjectStorage'),
    hashTypeNames: set(),
    listTypeNames: set(),
    stringConcatIsQuadratic: false,
    selfNames: set('$this', 'self', 'static', 'parent'),
    snippets: {
        membershipSet: {
            before: 'foreach ($items as $item) {\n    if (in_array($item, $bigList)) {   // scans $bigList every time\n        ...\n    }\n}',
            after: '$lookup = array_flip($bigList);   // build once\nforeach ($items as $item) {\n    if (isset($lookup[$item])) {   // O(1)\n        ...\n    }\n}',
        },
        frontRemoval: {
            before: 'while ($queue) {\n    $item = array_shift($queue);   // re-indexes the whole array\n}',
            after: '$queue = new SplQueue();\nforeach ($items as $i) { $queue->enqueue($i); }\nwhile (!$queue->isEmpty()) {\n    $item = $queue->dequeue();   // O(1)\n}',
        },
        memoization: {
            before: 'function fib($n) {\n    if ($n < 2) return $n;\n    return fib($n - 1) + fib($n - 2);\n}',
            after: 'function fib($n) {\n    static $memo = [];\n    if ($n < 2) return $n;\n    if (isset($memo[$n])) return $memo[$n];\n    return $memo[$n] = fib($n - 1) + fib($n - 2);\n}',
        },
        guardClauses: {
            before: 'if ($user) {\n    if ($user->active) {\n        if ($order) {\n            return handle($order);\n        }\n    }\n}\nreturn null;',
            after: 'if (!$user || !$user->active) {\n    return null;\n}\nif (!$order) {\n    return null;\n}\nreturn handle($order);',
        },
        dispatchTable: {
            before: "if ($kind === 'card') {\n    payCard();\n} elseif ($kind === 'paypal') {\n    payPaypal();\n} elseif ($kind === 'bank') {\n    payBank();\n} elseif ($kind === 'cash') {\n    payCash();\n}",
            after: "$handlers = ['card' => 'payCard', 'paypal' => 'payPaypal', 'bank' => 'payBank', 'cash' => 'payCash'];\n($handlers[$kind])();\n\n// or: match ($kind) { 'card' => payCard(), ... };",
        },
        hoistSort: {
            before: 'foreach ($queries as $q) {\n    sort($data);   // sorted again on every iteration\n    answer($data, $q);\n}',
            after: 'sort($data);       // sort once\nforeach ($queries as $q) {\n    answer($data, $q);\n}',
        },
        pairLookup: {
            before: 'foreach ($left as $a) {\n    foreach ($right as $b) {\n        if ($a->id === $b->id) {\n            merge($a, $b);\n        }\n    }\n}',
            after: '$byId = array_column($right, null, \'id\');\nforeach ($left as $a) {\n    if (isset($byId[$a->id])) {\n        merge($a, $byId[$a->id]);\n    }\n}',
        },
    },
});
