import { set } from './spec';
import { argumentsFromField, field, makeSpec, threeClauseLoop } from './base';

export const java = makeSpec({
    id: 'java',
    name: 'Java',
    wasmFile: 'tree-sitter-java.wasm',
    lineComment: '//',
    functionNodes: set('method_declaration', 'constructor_declaration', 'compact_constructor_declaration'),
    lambdaNodes: set('lambda_expression'),
    classNodes: set('class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'),
    getFunctionKind: (n) => (n.type.includes('constructor') ? 'constructor' : 'method'),
    loopNodes: set('for_statement', 'enhanced_for_statement', 'while_statement', 'do_statement'),
    getLoopInfo: (n) => {
        switch (n.type) {
            case 'for_statement':
                return threeClauseLoop(n, 'init', 'condition', 'update');
            case 'enhanced_for_statement':
                return { kind: 'foreach', variables: [field(n, 'name')?.text ?? ''], iterable: field(n, 'value')?.text, body: field(n, 'body') };
            case 'do_statement':
                return { kind: 'do', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
            default:
                return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
        }
    },
    ifNodes: set('if_statement'),
    switchNodes: set('switch_expression', 'switch_statement'),
    caseNodes: set('switch_label'),
    isDefaultCase: (n) => n.namedChildCount === 0 || n.text.trim().startsWith('default'),
    ternaryNodes: set('ternary_expression'),
    catchNodes: set('catch_clause'),
    binaryNodes: set('binary_expression'),
    booleanOperators: set('&&', '||'),
    callNodes: set('method_invocation', 'object_creation_expression'),
    getCallee: (n) => {
        if (n.type === 'object_creation_expression') {
            const t = field(n, 'type')?.text ?? '';
            return { name: `new ${t.replace(/<.*$/, '')}`, full: `new ${t}` };
        }
        const name = field(n, 'name')?.text ?? '';
        const obj = field(n, 'object')?.text;
        return { name, receiver: obj, full: obj ? `${obj}.${name}` : name };
    },
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set('throw_statement'),
    assignmentNodes: set('assignment_expression', 'variable_declarator'),
    collectionLiteralNodes: set('array_initializer', 'array_creation_expression'),
    stringLiteralNodes: set('string_literal'),
    subscriptNodes: set('array_access'),
    memberNodes: set('field_access'),
    numberLiteralNodes: set('decimal_integer_literal', 'hex_integer_literal', 'octal_integer_literal', 'binary_integer_literal', 'decimal_floating_point_literal'),
    decoratorNodes: set('annotation', 'marker_annotation'),
    iteratorMethods: set('forEach', 'map', 'filter', 'reduce', 'anyMatch', 'allMatch', 'noneMatch', 'flatMap', 'collect', 'mapToInt', 'mapToObj', 'mapToLong', 'mapToDouble', 'peek', 'sorted', 'distinct', 'removeIf', 'replaceAll', 'stream', 'parallelStream', 'count', 'sum', 'max', 'min', 'average', 'toList', 'findFirst', 'findAny'),
    appendMethods: set('add', 'addAll', 'put', 'putAll', 'push', 'offer', 'append', 'addFirst', 'addLast', 'offerLast', 'offerFirst', 'putIfAbsent', 'merge', 'computeIfAbsent'),
    sortCalls: set('sort', 'Collections.sort', 'Arrays.sort', 'sorted', 'parallelSort'),
    linearSearchCalls: set('contains', 'indexOf', 'lastIndexOf', 'containsAll', 'remove', 'removeAll', 'retainAll', 'containsValue'),
    copyCalls: set('new ArrayList', 'new LinkedList', 'new HashSet', 'new HashMap', 'new TreeMap', 'new TreeSet', 'copyOf', 'clone', 'toArray', 'asList', 'toList', 'copyOfRange', 'arraycopy', 'subList'),
    frontMutationCalls: set('remove(0', 'add(0,'),
    regexCompileCalls: set('Pattern.compile', 'compile'),
    linearBuiltins: set('join', 'fill', 'max', 'min', 'sum', 'reverse', 'frequency', 'addAll', 'containsAll', 'removeAll', 'retainAll', 'nCopies', 'shuffle', 'binarySearch_'),
    collectionConstructors: set('new ArrayList', 'new LinkedList', 'new HashMap', 'new HashSet', 'new TreeMap', 'new TreeSet', 'new ArrayDeque', 'new LinkedHashMap', 'new LinkedHashSet', 'new StringBuilder', 'new StringBuffer', 'new PriorityQueue', 'new Stack', 'new Vector', 'new ConcurrentHashMap', 'new CopyOnWriteArrayList'),
    hashTypeNames: set('HashSet', 'HashMap', 'Set', 'Map', 'TreeSet', 'TreeMap', 'LinkedHashSet', 'LinkedHashMap', 'ConcurrentHashMap', 'EnumSet', 'EnumMap', 'Hashtable'),
    listTypeNames: set('ArrayList', 'List', 'LinkedList', 'Vector', 'Stack', 'Collection', 'Iterable', 'CopyOnWriteArrayList'),
    stringConcatIsQuadratic: true,
    selfNames: set('this', 'super'),
    snippets: {
        membershipSet: {
            before: 'for (Item item : items) {\n    if (bigList.contains(item)) {   // scans bigList every time\n        ...\n    }\n}',
            after: 'Set<Item> lookup = new HashSet<>(bigList);   // build once\nfor (Item item : items) {\n    if (lookup.contains(item)) {         // O(1)\n        ...\n    }\n}',
        },
        stringBuilder: {
            before: 'String result = "";\nfor (String part : parts) {\n    result += part;     // copies the whole string each time\n}',
            after: 'StringBuilder sb = new StringBuilder();\nfor (String part : parts) {\n    sb.append(part);\n}\nString result = sb.toString();',
        },
        frontRemoval: {
            before: 'while (!list.isEmpty()) {\n    Item next = list.remove(0);   // shifts every remaining element\n}',
            after: 'Deque<Item> queue = new ArrayDeque<>(list);\nwhile (!queue.isEmpty()) {\n    Item next = queue.pollFirst();   // O(1)\n}',
        },
        memoization: {
            before: 'int fib(int n) {\n    if (n < 2) return n;\n    return fib(n - 1) + fib(n - 2);\n}',
            after: 'Map<Integer, Integer> memo = new HashMap<>();\n\nint fib(int n) {\n    if (n < 2) return n;\n    Integer cached = memo.get(n);\n    if (cached != null) return cached;\n    int value = fib(n - 1) + fib(n - 2);\n    memo.put(n, value);\n    return value;\n}',
        },
        guardClauses: {
            before: 'if (user != null) {\n    if (user.isActive()) {\n        if (order != null) {\n            return handle(order);\n        }\n    }\n}\nreturn null;',
            after: 'if (user == null || !user.isActive()) return null;\nif (order == null) return null;\nreturn handle(order);',
        },
        dispatchTable: {
            before: 'if (kind.equals("card")) {\n    payCard();\n} else if (kind.equals("paypal")) {\n    payPaypal();\n} else if (kind.equals("bank")) {\n    payBank();\n} else if (kind.equals("cash")) {\n    payCash();\n}',
            after: 'Map<String, Runnable> handlers = Map.of(\n    "card", this::payCard,\n    "paypal", this::payPaypal,\n    "bank", this::payBank,\n    "cash", this::payCash);\nhandlers.get(kind).run();\n\n// or a switch: switch (kind) { case "card" -> payCard(); ... }',
        },
        hoistSort: {
            before: 'for (Query q : queries) {\n    Collections.sort(data);   // sorted again on every iteration\n    answer(data, q);\n}',
            after: 'Collections.sort(data);       // sort once\nfor (Query q : queries) {\n    answer(data, q);\n}',
        },
        pairLookup: {
            before: 'for (A a : left) {\n    for (B b : right) {\n        if (a.getId().equals(b.getId())) {\n            merge(a, b);\n        }\n    }\n}',
            after: 'Map<String, B> byId = new HashMap<>();\nfor (B b : right) byId.put(b.getId(), b);\nfor (A a : left) {\n    B b = byId.get(a.getId());\n    if (b != null) merge(a, b);\n}',
        },
    },
});
