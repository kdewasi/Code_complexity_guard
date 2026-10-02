import { set } from './spec';
import { argumentsFromField, calleeFromFunctionField, countParameters, field, makeSpec } from './base';

export const rust = makeSpec({
    id: 'rust',
    name: 'Rust',
    wasmFile: 'tree-sitter-rust.wasm',
    lineComment: '//',
    functionNodes: set('function_item'),
    lambdaNodes: set('closure_expression'),
    classNodes: set('impl_item', 'trait_item', 'mod_item'),
    getClassName: (n) => (n.type === 'impl_item' ? field(n, 'type')?.text : field(n, 'name')?.text),
    getFunctionKind: (n) => (n.parent?.type === 'declaration_list' && n.parent.parent?.type === 'impl_item' ? 'method' : 'function'),
    getParameterCount: (n) => countParameters(field(n, 'parameters'), set('self', '&self', '&mut self', 'mut self')),
    loopNodes: set('for_expression', 'while_expression', 'loop_expression'),
    getLoopInfo: (n) => {
        if (n.type === 'for_expression') {
            const value = field(n, 'value');
            return { kind: 'foreach', variables: [field(n, 'pattern')?.text ?? ''], iterable: value?.text, condition: value, body: field(n, 'body') };
        }
        if (n.type === 'while_expression') {
            return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
        }
        return { kind: 'loop', variables: [], body: field(n, 'body') };
    },
    ifNodes: set('if_expression'),
    elseNodes: set('else_clause'),
    switchNodes: set('match_expression'),
    caseNodes: set('match_arm'),
    isDefaultCase: (n) => field(n, 'pattern')?.text.trim() === '_',
    catchNodes: set(),
    binaryNodes: set('binary_expression'),
    booleanOperators: set('&&', '||'),
    callNodes: set('call_expression', 'macro_invocation'),
    getCallee: (n) => {
        if (n.type === 'macro_invocation') {
            const m = field(n, 'macro')?.text ?? '';
            return { name: `${m}!`, full: `${m}!` };
        }
        const fn = field(n, 'function');
        if (fn && fn.type === 'generic_function') {
            const inner = field(fn, 'function');
            return inner ? calleeFromFunctionField(fn) ?? { name: inner.text, full: inner.text } : undefined;
        }
        return calleeFromFunctionField(n);
    },
    getArguments: (n) => (n.type === 'macro_invocation' ? [] : argumentsFromField(n)),
    throwNodes: set(),
    returnNodes: set('return_expression'),
    assignmentNodes: set('assignment_expression', 'compound_assignment_expr', 'let_declaration'),
    collectionLiteralNodes: set('array_expression'),
    stringLiteralNodes: set('string_literal', 'raw_string_literal'),
    subscriptNodes: set('index_expression'),
    memberNodes: set('field_expression'),
    identifierNodes: set('identifier', 'field_identifier'),
    numberLiteralNodes: set('integer_literal', 'float_literal'),
    decoratorNodes: set('attribute_item'),
    iteratorMethods: set('iter', 'iter_mut', 'into_iter', 'map', 'filter', 'for_each', 'fold', 'any', 'all', 'find', 'position', 'filter_map', 'flat_map', 'collect', 'sum', 'count', 'max', 'min', 'max_by', 'min_by', 'max_by_key', 'min_by_key', 'enumerate', 'zip', 'chars', 'bytes', 'lines', 'split', 'windows', 'chunks', 'rev', 'take_while', 'skip_while', 'retain', 'dedup', 'extend'),
    appendMethods: set('push', 'push_str', 'push_back', 'push_front', 'insert', 'extend', 'append', 'entry'),
    sortCalls: set('sort', 'sort_unstable', 'sort_by', 'sort_by_key', 'sort_unstable_by', 'sort_unstable_by_key'),
    linearSearchCalls: set('contains', 'position', 'find', 'any', 'iter().position', 'binary_search_'),
    copyCalls: set('clone', 'to_vec', 'to_owned', 'to_string', 'collect', 'cloned', 'copied'),
    frontMutationCalls: set('remove(0', 'insert(0,'),
    regexCompileCalls: set('Regex::new', 'RegexBuilder::new'),
    linearBuiltins: set('join', 'concat', 'sum', 'max', 'min', 'count', 'rev', 'reverse', 'extend_from_slice', 'vec!', 'iter', 'into_iter', 'extend'),
    collectionConstructors: set('Vec::new', 'Vec::with_capacity', 'HashMap::new', 'HashSet::new', 'BTreeMap::new', 'BTreeSet::new', 'VecDeque::new', 'String::new', 'String::with_capacity', 'vec!', 'HashMap::with_capacity', 'HashSet::with_capacity'),
    hashTypeNames: set('HashMap', 'HashSet', 'BTreeMap', 'BTreeSet'),
    listTypeNames: set('Vec', 'VecDeque', 'slice'),
    stringConcatIsQuadratic: false,
    selfNames: set('self', 'Self'),
    snippets: {
        membershipSet: {
            before: 'for item in &items {\n    if big_list.contains(item) {   // scans big_list every time\n        ...\n    }\n}',
            after: 'let lookup: HashSet<_> = big_list.iter().collect();   // build once\nfor item in &items {\n    if lookup.contains(item) {   // O(1)\n        ...\n    }\n}',
        },
        memoization: {
            before: 'fn fib(n: u64) -> u64 {\n    if n < 2 { return n; }\n    fib(n - 1) + fib(n - 2)\n}',
            after: 'fn fib(n: u64, memo: &mut HashMap<u64, u64>) -> u64 {\n    if n < 2 { return n; }\n    if let Some(&v) = memo.get(&n) { return v; }\n    let v = fib(n - 1, memo) + fib(n - 2, memo);\n    memo.insert(n, v);\n    v\n}',
        },
        guardClauses: {
            before: 'if let Some(user) = user {\n    if user.active {\n        if let Some(order) = order {\n            return handle(order);\n        }\n    }\n}\nNone',
            after: 'let user = user?;\nif !user.active { return None; }\nlet order = order?;\nhandle(order)',
        },
        dispatchTable: {
            before: 'if kind == "card" {\n    pay_card()\n} else if kind == "paypal" {\n    pay_paypal()\n} else if kind == "bank" {\n    pay_bank()\n} else if kind == "cash" {\n    pay_cash()\n}',
            after: 'match kind {\n    "card" => pay_card(),\n    "paypal" => pay_paypal(),\n    "bank" => pay_bank(),\n    "cash" => pay_cash(),\n    _ => {}\n}',
        },
        hoistSort: {
            before: 'for q in &queries {\n    data.sort();   // sorted again on every iteration\n    answer(&data, q);\n}',
            after: 'data.sort();       // sort once\nfor q in &queries {\n    answer(&data, q);\n}',
        },
        pairLookup: {
            before: 'for a in &left {\n    for b in &right {\n        if a.id == b.id {\n            merge(a, b);\n        }\n    }\n}',
            after: 'let by_id: HashMap<_, _> = right.iter().map(|b| (b.id, b)).collect();\nfor a in &left {\n    if let Some(b) = by_id.get(&a.id) {\n        merge(a, b);\n    }\n}',
        },
    },
});
