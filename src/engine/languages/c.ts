import type { Node } from 'web-tree-sitter';
import { LanguageId } from '../types';
import { LanguageSpec, set } from './spec';
import { argumentsFromField, calleeFromFunctionField, countParameters, field, makeSpec, threeClauseLoop } from './base';

/** Walk through pointer/reference/parenthesized declarators to the function_declarator. */
function functionDeclarator(node: Node): Node | null {
    let d = field(node, 'declarator');
    for (let i = 0; i < 6 && d; i++) {
        if (d.type === 'function_declarator') {
            return d;
        }
        d = field(d, 'declarator');
    }
    return null;
}

function cName(node: Node): string | undefined {
    const fd = functionDeclarator(node);
    if (!fd) {
        return undefined;
    }
    const inner = field(fd, 'declarator');
    if (!inner) {
        return undefined;
    }
    if (inner.type === 'qualified_identifier') {
        return inner.text.replace(/\s+/g, '');
    }
    if (inner.type === 'destructor_name') {
        return inner.text;
    }
    if (inner.type === 'operator_name') {
        return inner.text.replace(/\s+/g, '');
    }
    if (inner.type === 'template_function') {
        return field(inner, 'name')?.text;
    }
    if (inner.type === 'identifier' || inner.type === 'field_identifier') {
        return inner.text;
    }
    // Functions returning function pointers: int (*get(int k))(int)
    const nested = inner.descendantsOfType(['identifier', 'field_identifier']);
    return nested.length > 0 ? nested[0].text : inner.text;
}

const C_SNIPPETS = {
    membershipSet: {
        before: 'for (int i = 0; i < n; i++) {\n    for (int j = 0; j < m; j++) {      // linear scan for every i\n        if (a[i] == b[j]) { ... }\n    }\n}',
        after: '/* sort b once (n log n), then binary search, or use a hash table */\nqsort(b, m, sizeof *b, cmp);\nfor (int i = 0; i < n; i++) {\n    if (bsearch(&a[i], b, m, sizeof *b, cmp)) { ... }   /* log m */\n}',
    },
    memoization: {
        before: 'long fib(int n) {\n    if (n < 2) return n;\n    return fib(n - 1) + fib(n - 2);\n}',
        after: 'static long memo[100];\nlong fib(int n) {\n    if (n < 2) return n;\n    if (memo[n]) return memo[n];\n    return memo[n] = fib(n - 1) + fib(n - 2);\n}',
    },
    guardClauses: {
        before: 'if (user) {\n    if (user->active) {\n        if (order) {\n            return handle(order);\n        }\n    }\n}\nreturn NULL;',
        after: 'if (!user || !user->active) return NULL;\nif (!order) return NULL;\nreturn handle(order);',
    },
    dispatchTable: {
        before: 'if (kind == CARD) {\n    pay_card();\n} else if (kind == PAYPAL) {\n    pay_paypal();\n} else if (kind == BANK) {\n    pay_bank();\n} else if (kind == CASH) {\n    pay_cash();\n}',
        after: 'static void (*const handlers[])(void) = {\n    [CARD] = pay_card, [PAYPAL] = pay_paypal, [BANK] = pay_bank, [CASH] = pay_cash,\n};\nhandlers[kind]();\n\n/* or a switch statement */',
    },
    hoistSort: {
        before: 'for (int q = 0; q < nq; q++) {\n    qsort(data, n, sizeof *data, cmp);   /* sorted again every iteration */\n    answer(data, queries[q]);\n}',
        after: 'qsort(data, n, sizeof *data, cmp);       /* sort once */\nfor (int q = 0; q < nq; q++) {\n    answer(data, queries[q]);\n}',
    },
    pairLookup: {
        before: 'for (int i = 0; i < n; i++)\n    for (int j = 0; j < m; j++)\n        if (left[i].id == right[j].id) merge(&left[i], &right[j]);',
        after: '/* index right by id once (hash table or sorted array + bsearch) */\nqsort(right, m, sizeof *right, by_id);\nfor (int i = 0; i < n; i++) {\n    Item *b = bsearch(&left[i], right, m, sizeof *right, by_id);\n    if (b) merge(&left[i], b);\n}',
    },
};

function cFamily(id: LanguageId, name: string, wasmFile: string, extra: Partial<LanguageSpec>): LanguageSpec {
    return makeSpec({
        id,
        name,
        wasmFile,
        lineComment: '//',
        functionNodes: set('function_definition'),
        lambdaNodes: set('lambda_expression'),
        classNodes: set('struct_specifier', 'class_specifier', 'namespace_definition', 'union_specifier'),
        getFunctionName: cName,
        getFunctionKind: (n) => {
            const name = cName(n) ?? '';
            if (n.parent?.type === 'field_declaration_list') {
                const cls = n.parent.parent;
                const clsName = cls ? field(cls, 'name')?.text : undefined;
                return clsName && (name === clsName || name === `~${clsName}`) ? 'constructor' : 'method';
            }
            return name.includes('::') ? 'method' : 'function';
        },
        getParameterCount: (n) => {
            const fd = functionDeclarator(n);
            return countParameters(field(fd, 'parameters'), new Set());
        },
        getBody: (n) => field(n, 'body'),
        loopNodes: set('for_statement', 'while_statement', 'do_statement', 'for_range_loop'),
        getLoopInfo: (n) => {
            switch (n.type) {
                case 'for_statement':
                    return threeClauseLoop(n, 'initializer', 'condition', 'update');
                case 'for_range_loop':
                    return { kind: 'foreach', variables: [field(n, 'declarator')?.text ?? ''], iterable: field(n, 'right')?.text, body: field(n, 'body') };
                case 'do_statement':
                    return { kind: 'do', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
                default:
                    return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
            }
        },
        ifNodes: set('if_statement'),
        elseNodes: set('else_clause'),
        switchNodes: set('switch_statement'),
        caseNodes: set('case_statement'),
        isDefaultCase: (n) => !field(n, 'value'),
        ternaryNodes: set('conditional_expression'),
        catchNodes: set('catch_clause'),
        binaryNodes: set('binary_expression'),
        booleanOperators: set('&&', '||', 'and', 'or'),
        callNodes: set('call_expression'),
        getCallee: (n) => calleeFromFunctionField(n),
        getArguments: (n) => argumentsFromField(n),
        throwNodes: set('throw_statement'),
        assignmentNodes: set('assignment_expression', 'init_declarator'),
        getAssignment: (n) => {
            if (n.type === 'init_declarator') {
                let d = field(n, 'declarator');
                while (d && d.type !== 'identifier' && field(d, 'declarator')) {
                    d = field(d, 'declarator');
                }
                return { target: d?.text ?? '', operator: '=', value: field(n, 'value') };
            }
            return { target: field(n, 'left')?.text ?? '', operator: field(n, 'operator')?.text ?? '=', value: field(n, 'right') };
        },
        collectionLiteralNodes: set('initializer_list'),
        stringLiteralNodes: set('string_literal', 'concatenated_string', 'raw_string_literal'),
        subscriptNodes: set('subscript_expression'),
        memberNodes: set('field_expression'),
        identifierNodes: set('identifier', 'field_identifier'),
        numberLiteralNodes: set('number_literal'),
        iteratorMethods: set(),
        appendMethods: set('push_back', 'push_front', 'emplace_back', 'emplace', 'insert', 'append', 'push', 'emplace_front'),
        sortCalls: set('qsort', 'std::sort', 'sort', 'std::stable_sort', 'stable_sort', 'std::partial_sort'),
        linearSearchCalls: set('std::find', 'find', 'std::count', 'count', 'strstr', 'strchr', 'memchr', 'std::find_if', 'find_if', 'std::any_of', 'any_of'),
        copyCalls: set('memcpy', 'strcpy', 'strdup', 'std::copy', 'copy', 'strncpy', 'memmove'),
        frontMutationCalls: set('erase(', 'insert(') ,
        regexCompileCalls: set('regcomp', 'std::regex', 'regex'),
        linearBuiltins: set('strlen', 'strcat', 'memcpy', 'memset', 'memcmp', 'memmove', 'std::accumulate', 'accumulate', 'std::min_element', 'min_element', 'std::max_element', 'max_element', 'std::reverse', 'reverse', 'std::fill', 'fill', 'wcslen', 'std::distance', 'distance', 'std::count_if', 'count_if', 'std::all_of', 'all_of', 'std::none_of', 'none_of', 'std::for_each', 'for_each', 'std::transform', 'transform', 'std::copy', 'std::remove', 'std::unique', 'unique', 'std::iota', 'iota'),
        collectionConstructors: set('malloc', 'calloc', 'realloc', 'new'),
        hashTypeNames: set('unordered_map', 'unordered_set', 'std::unordered_map', 'std::unordered_set', 'map', 'set', 'std::map', 'std::set'),
        listTypeNames: set('vector', 'std::vector', 'array', 'list', 'deque'),
        stringConcatIsQuadratic: true,
        selfNames: set('this'),
        snippets: C_SNIPPETS,
        ...extra,
    });
}

export const c = cFamily('c', 'C', 'tree-sitter-c.wasm', {
    lambdaNodes: set(),
    catchNodes: set(),
    throwNodes: set(),
    booleanOperators: set('&&', '||'),
});

export const cpp = cFamily('cpp', 'C++', 'tree-sitter-cpp.wasm', {
    stringConcatIsQuadratic: false,
    snippets: {
        ...C_SNIPPETS,
        membershipSet: {
            before: 'for (const auto& item : items) {\n    if (std::find(big.begin(), big.end(), item) != big.end()) {   // linear scan\n        ...\n    }\n}',
            after: 'std::unordered_set<Item> lookup(big.begin(), big.end());   // build once\nfor (const auto& item : items) {\n    if (lookup.count(item)) {   // O(1)\n        ...\n    }\n}',
        },
        frontRemoval: {
            before: 'while (!v.empty()) {\n    auto x = v.front();\n    v.erase(v.begin());   // shifts every remaining element\n}',
            after: 'std::deque<Item> q(v.begin(), v.end());\nwhile (!q.empty()) {\n    auto x = q.front();\n    q.pop_front();   // O(1)\n}',
        },
        memoization: {
            before: 'long fib(int n) {\n    if (n < 2) return n;\n    return fib(n - 1) + fib(n - 2);\n}',
            after: 'long fib(int n) {\n    static std::unordered_map<int, long> memo;\n    if (n < 2) return n;\n    if (auto it = memo.find(n); it != memo.end()) return it->second;\n    return memo[n] = fib(n - 1) + fib(n - 2);\n}',
        },
        dispatchTable: {
            before: 'if (kind == "card") {\n    payCard();\n} else if (kind == "paypal") {\n    payPaypal();\n} else if (kind == "bank") {\n    payBank();\n} else if (kind == "cash") {\n    payCash();\n}',
            after: 'static const std::unordered_map<std::string, std::function<void()>> handlers = {\n    {"card", payCard}, {"paypal", payPaypal}, {"bank", payBank}, {"cash", payCash},\n};\nif (auto it = handlers.find(kind); it != handlers.end()) it->second();',
        },
        pairLookup: {
            before: 'for (const auto& a : left)\n    for (const auto& b : right)\n        if (a.id == b.id) merge(a, b);',
            after: 'std::unordered_map<Id, const B*> byId;\nfor (const auto& b : right) byId[b.id] = &b;\nfor (const auto& a : left) {\n    if (auto it = byId.find(a.id); it != byId.end()) merge(a, *it->second);\n}',
        },
    },
});
