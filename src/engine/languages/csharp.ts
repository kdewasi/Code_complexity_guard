import { set } from './spec';
import { argumentsFromField, calleeFromFunctionField, field, lastNamed, makeSpec, threeClauseLoop } from './base';

export const csharp = makeSpec({
    id: 'csharp',
    name: 'C#',
    wasmFile: 'tree-sitter-c_sharp.wasm',
    lineComment: '//',
    functionNodes: set('method_declaration', 'constructor_declaration', 'local_function_statement', 'operator_declaration', 'destructor_declaration', 'conversion_operator_declaration'),
    lambdaNodes: set('lambda_expression', 'anonymous_method_expression'),
    classNodes: set('class_declaration', 'struct_declaration', 'interface_declaration', 'record_declaration', 'namespace_declaration', 'file_scoped_namespace_declaration'),
    getFunctionKind: (n) => {
        if (n.type.startsWith('constructor') || n.type.startsWith('destructor')) {
            return 'constructor';
        }
        return n.type === 'local_function_statement' ? 'function' : 'method';
    },
    loopNodes: set('for_statement', 'foreach_statement', 'while_statement', 'do_statement'),
    getLoopInfo: (n) => {
        switch (n.type) {
            case 'for_statement':
                return threeClauseLoop(n, 'initializer', 'condition', 'update');
            case 'foreach_statement':
                return { kind: 'foreach', variables: [field(n, 'left')?.text ?? ''], iterable: field(n, 'right')?.text, body: field(n, 'body') };
            case 'do_statement':
                return { kind: 'do', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
            default:
                return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
        }
    },
    ifNodes: set('if_statement'),
    switchNodes: set('switch_statement', 'switch_expression'),
    caseNodes: set('switch_section', 'switch_expression_arm'),
    isDefaultCase: (n) => {
        if (n.type === 'switch_expression_arm') {
            return n.firstNamedChild?.type === 'discard';
        }
        return n.text.trimStart().startsWith('default');
    },
    ternaryNodes: set('conditional_expression'),
    catchNodes: set('catch_clause'),
    binaryNodes: set('binary_expression'),
    booleanOperators: set('&&', '||', '??'),
    callNodes: set('invocation_expression', 'object_creation_expression'),
    getCallee: (n) => {
        if (n.type === 'object_creation_expression') {
            const t = field(n, 'type')?.text ?? '';
            return { name: `new ${t.replace(/<.*$/, '')}`, full: `new ${t}` };
        }
        return calleeFromFunctionField(n);
    },
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set('throw_statement', 'throw_expression'),
    assignmentNodes: set('assignment_expression', 'variable_declarator'),
    getAssignment: (n) => {
        if (n.type === 'variable_declarator') {
            const name = field(n, 'name');
            const value = lastNamed(n);
            return { target: name?.text ?? '', operator: '=', value: value && name && !value.equals(name) ? value : null };
        }
        return { target: field(n, 'left')?.text ?? '', operator: field(n, 'operator')?.text ?? '=', value: field(n, 'right') };
    },
    collectionLiteralNodes: set('array_creation_expression', 'initializer_expression', 'implicit_array_creation_expression', 'collection_expression'),
    stringLiteralNodes: set('string_literal', 'verbatim_string_literal', 'interpolated_string_expression', 'raw_string_literal'),
    subscriptNodes: set('element_access_expression'),
    memberNodes: set('member_access_expression'),
    numberLiteralNodes: set('integer_literal', 'real_literal'),
    decoratorNodes: set('attribute_list'),
    iteratorMethods: set('ForEach', 'Select', 'Where', 'Any', 'All', 'Aggregate', 'Sum', 'Count', 'Max', 'Min', 'Average', 'First', 'FirstOrDefault', 'Last', 'LastOrDefault', 'Single', 'SelectMany', 'OrderBy', 'OrderByDescending', 'GroupBy', 'ToList', 'ToArray', 'ToDictionary', 'ToHashSet', 'Distinct', 'Reverse', 'Skip', 'Take', 'TakeWhile', 'SkipWhile', 'Zip', 'Contains_'),
    appendMethods: set('Add', 'AddRange', 'Push', 'Enqueue', 'Append', 'AppendLine', 'Insert', 'TryAdd', 'AddFirst', 'AddLast'),
    sortCalls: set('Sort', 'OrderBy', 'OrderByDescending', 'Array.Sort', 'ThenBy'),
    linearSearchCalls: set('Contains', 'IndexOf', 'LastIndexOf', 'Exists', 'Find', 'FindIndex', 'Any', 'Remove', 'RemoveAll'),
    copyCalls: set('ToList', 'ToArray', 'Clone', 'CopyTo', 'new List', 'new HashSet', 'new Dictionary', 'ToDictionary', 'ToHashSet', 'Array.Copy', 'Copy', 'GetRange'),
    frontMutationCalls: set('RemoveAt(0', 'Insert(0,'),
    regexCompileCalls: set('new Regex', 'Regex'),
    linearBuiltins: set('Join', 'Sum', 'Max', 'Min', 'Reverse', 'Concat', 'Fill', 'SequenceEqual', 'AddRange', 'Average', 'Aggregate'),
    collectionConstructors: set('new List', 'new Dictionary', 'new HashSet', 'new Queue', 'new Stack', 'new LinkedList', 'new SortedDictionary', 'new SortedSet', 'new StringBuilder', 'new ConcurrentDictionary', 'new ArrayList'),
    hashTypeNames: set('HashSet', 'Dictionary', 'ISet', 'IDictionary', 'SortedSet', 'SortedDictionary', 'ConcurrentDictionary', 'Hashtable'),
    listTypeNames: set('List', 'IList', 'ArrayList', 'IEnumerable', 'ICollection', 'LinkedList', 'Array'),
    stringConcatIsQuadratic: true,
    selfNames: set('this', 'base'),
    snippets: {
        membershipSet: {
            before: 'foreach (var item in items)\n{\n    if (bigList.Contains(item))   // scans bigList every time\n    {\n        ...\n    }\n}',
            after: 'var lookup = new HashSet<Item>(bigList);   // build once\nforeach (var item in items)\n{\n    if (lookup.Contains(item))   // O(1)\n    {\n        ...\n    }\n}',
        },
        stringBuilder: {
            before: 'string result = "";\nforeach (var part in parts)\n{\n    result += part;   // copies the whole string each time\n}',
            after: 'var sb = new StringBuilder();\nforeach (var part in parts)\n{\n    sb.Append(part);\n}\nstring result = sb.ToString();',
        },
        frontRemoval: {
            before: 'while (list.Count > 0)\n{\n    var next = list[0];\n    list.RemoveAt(0);   // shifts every remaining element\n}',
            after: 'var queue = new Queue<Item>(list);\nwhile (queue.Count > 0)\n{\n    var next = queue.Dequeue();   // O(1)\n}',
        },
        memoization: {
            before: 'int Fib(int n)\n{\n    if (n < 2) return n;\n    return Fib(n - 1) + Fib(n - 2);\n}',
            after: 'private readonly Dictionary<int, int> _memo = new();\n\nint Fib(int n)\n{\n    if (n < 2) return n;\n    if (_memo.TryGetValue(n, out var cached)) return cached;\n    var value = Fib(n - 1) + Fib(n - 2);\n    _memo[n] = value;\n    return value;\n}',
        },
        guardClauses: {
            before: 'if (user != null)\n{\n    if (user.Active)\n    {\n        if (order != null)\n        {\n            return Handle(order);\n        }\n    }\n}\nreturn null;',
            after: 'if (user is null || !user.Active) return null;\nif (order is null) return null;\nreturn Handle(order);',
        },
        dispatchTable: {
            before: 'if (kind == "card")\n    PayCard();\nelse if (kind == "paypal")\n    PayPaypal();\nelse if (kind == "bank")\n    PayBank();\nelse if (kind == "cash")\n    PayCash();',
            after: 'var handlers = new Dictionary<string, Action>\n{\n    ["card"] = PayCard, ["paypal"] = PayPaypal, ["bank"] = PayBank, ["cash"] = PayCash,\n};\nif (handlers.TryGetValue(kind, out var handler)) handler();\n\n// or: switch (kind) { case "card": PayCard(); break; ... }',
        },
        hoistSort: {
            before: 'foreach (var q in queries)\n{\n    data.Sort();   // sorted again on every iteration\n    Answer(data, q);\n}',
            after: 'data.Sort();       // sort once\nforeach (var q in queries)\n{\n    Answer(data, q);\n}',
        },
        pairLookup: {
            before: 'foreach (var a in left)\n    foreach (var b in right)\n        if (a.Id == b.Id) Merge(a, b);',
            after: 'var byId = right.ToDictionary(b => b.Id);\nforeach (var a in left)\n{\n    if (byId.TryGetValue(a.Id, out var b)) Merge(a, b);\n}',
        },
    },
});
