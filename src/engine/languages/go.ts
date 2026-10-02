import { set } from './spec';
import { argumentsFromField, calleeFromFunctionField, collectIdentifiers, field, makeSpec } from './base';

export const go = makeSpec({
    id: 'go',
    name: 'Go',
    wasmFile: 'tree-sitter-go.wasm',
    lineComment: '//',
    functionNodes: set('function_declaration', 'method_declaration'),
    lambdaNodes: set('func_literal'),
    classNodes: set('type_declaration'),
    getClassName: (n) => field(n.namedChildren.find((c) => c.type === 'type_spec') ?? null, 'name')?.text,
    getFunctionKind: (n) => (n.type === 'method_declaration' ? 'method' : 'function'),
    getParameterCount: (n) => {
        const params = field(n, 'parameters');
        if (!params) {
            return 0;
        }
        let count = 0;
        for (const p of params.namedChildren) {
            if (p.type !== 'parameter_declaration' && p.type !== 'variadic_parameter_declaration') {
                continue;
            }
            const names = p.childrenForFieldName('name');
            count += Math.max(1, names.length);
        }
        return count;
    },
    loopNodes: set('for_statement'),
    getLoopInfo: (n) => {
        const clause = n.namedChildren.find((c) => c.type === 'for_clause');
        if (clause) {
            const init = field(clause, 'initializer');
            return {
                kind: 'for',
                variables: init ? collectIdentifiers(init, 1) : [],
                init,
                condition: field(clause, 'condition'),
                update: field(clause, 'update'),
                body: field(n, 'body'),
            };
        }
        const range = n.namedChildren.find((c) => c.type === 'range_clause');
        if (range) {
            const left = field(range, 'left');
            return {
                kind: 'foreach',
                variables: left ? collectIdentifiers(left, 2) : [],
                iterable: field(range, 'right')?.text,
                body: field(n, 'body'),
            };
        }
        const cond = n.namedChildren.find((c) => c.type !== 'block');
        return { kind: cond ? 'while' : 'loop', variables: [], condition: cond ?? null, body: field(n, 'body') };
    },
    ifNodes: set('if_statement'),
    switchNodes: set('expression_switch_statement', 'type_switch_statement', 'select_statement'),
    caseNodes: set('expression_case', 'type_case', 'communication_case', 'default_case'),
    isDefaultCase: (n) => n.type === 'default_case',
    catchNodes: set(),
    binaryNodes: set('binary_expression'),
    booleanOperators: set('&&', '||'),
    callNodes: set('call_expression'),
    getCallee: (n) => calleeFromFunctionField(n),
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set(),
    assignmentNodes: set('assignment_statement', 'short_var_declaration', 'var_spec'),
    getAssignment: (n) => {
        const left = field(n, 'left') ?? field(n, 'name');
        const right = field(n, 'right') ?? field(n, 'value');
        if (!left) {
            return undefined;
        }
        const op = field(n, 'operator')?.text ?? (n.type === 'short_var_declaration' ? ':=' : '=');
        return { target: left.text, operator: op, value: right };
    },
    collectionLiteralNodes: set('composite_literal'),
    stringLiteralNodes: set('interpreted_string_literal', 'raw_string_literal'),
    subscriptNodes: set('index_expression', 'slice_expression'),
    memberNodes: set('selector_expression'),
    identifierNodes: set('identifier', 'field_identifier'),
    numberLiteralNodes: set('int_literal', 'float_literal'),
    iteratorMethods: set(),
    appendMethods: set('append', 'PushBack', 'PushFront', 'Push', 'WriteString', 'WriteByte', 'Write'),
    sortCalls: set('sort.Slice', 'sort.SliceStable', 'sort.Ints', 'sort.Strings', 'sort.Sort', 'sort.Stable', 'slices.Sort', 'slices.SortFunc', 'slices.SortStableFunc', 'Sort', 'Slice', 'Ints', 'Strings'),
    linearSearchCalls: set('slices.Contains', 'slices.Index', 'slices.IndexFunc', 'strings.Contains', 'strings.Index', 'bytes.Contains', 'Contains', 'Index', 'IndexFunc'),
    copyCalls: set('copy', 'slices.Clone', 'maps.Clone', 'Clone', 'maps.Keys', 'maps.Values', 'strings.Split', 'strings.Fields'),
    frontMutationCalls: set(),
    regexCompileCalls: set('regexp.MustCompile', 'regexp.Compile', 'MustCompile', 'Compile'),
    linearBuiltins: set('copy', 'Join', 'Sum', 'Max', 'Min', 'Equal', 'Clone', 'Keys', 'Values', 'Reverse', 'slices.Max', 'slices.Min', 'slices.Equal', 'slices.Reverse', 'strings.Join'),
    collectionConstructors: set('make', 'append', 'new'),
    hashTypeNames: set('map'),
    listTypeNames: set('slice'),
    stringConcatIsQuadratic: true,
    selfNames: set(),
    snippets: {
        membershipSet: {
            before: 'for _, item := range items {\n    if slices.Contains(bigList, item) {   // scans bigList every time\n        ...\n    }\n}',
            after: 'lookup := make(map[Item]struct{}, len(bigList))   // build once\nfor _, v := range bigList {\n    lookup[v] = struct{}{}\n}\nfor _, item := range items {\n    if _, ok := lookup[item]; ok {   // O(1)\n        ...\n    }\n}',
        },
        stringBuilder: {
            before: 'result := ""\nfor _, part := range parts {\n    result += part   // copies the whole string each time\n}',
            after: 'var sb strings.Builder\nfor _, part := range parts {\n    sb.WriteString(part)\n}\nresult := sb.String()',
        },
        memoization: {
            before: 'func fib(n int) int {\n    if n < 2 {\n        return n\n    }\n    return fib(n-1) + fib(n-2)\n}',
            after: 'var memo = map[int]int{}\n\nfunc fib(n int) int {\n    if n < 2 {\n        return n\n    }\n    if v, ok := memo[n]; ok {\n        return v\n    }\n    v := fib(n-1) + fib(n-2)\n    memo[n] = v\n    return v\n}',
        },
        guardClauses: {
            before: 'if user != nil {\n    if user.Active {\n        if order != nil {\n            return handle(order)\n        }\n    }\n}\nreturn nil',
            after: 'if user == nil || !user.Active {\n    return nil\n}\nif order == nil {\n    return nil\n}\nreturn handle(order)',
        },
        dispatchTable: {
            before: 'if kind == "card" {\n    payCard()\n} else if kind == "paypal" {\n    payPaypal()\n} else if kind == "bank" {\n    payBank()\n} else if kind == "cash" {\n    payCash()\n}',
            after: 'handlers := map[string]func(){\n    "card": payCard, "paypal": payPaypal, "bank": payBank, "cash": payCash,\n}\nif h, ok := handlers[kind]; ok {\n    h()\n}\n\n// or a switch statement on kind',
        },
        hoistSort: {
            before: 'for _, q := range queries {\n    sort.Ints(data)   // sorted again on every iteration\n    answer(data, q)\n}',
            after: 'sort.Ints(data)       // sort once\nfor _, q := range queries {\n    answer(data, q)\n}',
        },
        pairLookup: {
            before: 'for _, a := range left {\n    for _, b := range right {\n        if a.ID == b.ID {\n            merge(a, b)\n        }\n    }\n}',
            after: 'byID := make(map[string]B, len(right))\nfor _, b := range right {\n    byID[b.ID] = b\n}\nfor _, a := range left {\n    if b, ok := byID[a.ID]; ok {\n        merge(a, b)\n    }\n}',
        },
    },
});
