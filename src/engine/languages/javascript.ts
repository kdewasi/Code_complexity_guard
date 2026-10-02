import { LanguageId } from '../types';
import { LanguageSpec, set } from './spec';
import { argumentsFromField, calleeFromFunctionField, field, makeSpec, threeClauseLoop } from './base';

const JS_SNIPPETS = {
    membershipSet: {
        before: 'for (const item of items) {\n  if (bigList.includes(item)) {   // scans bigList every time\n    ...\n  }\n}',
        after: 'const lookup = new Set(bigList);   // build once\nfor (const item of items) {\n  if (lookup.has(item)) {          // O(1)\n    ...\n  }\n}',
    },
    frontRemoval: {
        before: 'while (queue.length) {\n  const item = queue.shift();   // shifts every remaining element\n}',
        after: 'let head = 0;\nwhile (head < queue.length) {\n  const item = queue[head++];   // O(1), no shifting\n}',
    },
    memoization: {
        before: 'function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}',
        after: 'const memo = new Map();\nfunction fib(n) {\n  if (n < 2) return n;\n  if (memo.has(n)) return memo.get(n);\n  const value = fib(n - 1) + fib(n - 2);\n  memo.set(n, value);\n  return value;\n}',
    },
    guardClauses: {
        before: 'if (user) {\n  if (user.active) {\n    if (order) {\n      return handle(order);\n    }\n  }\n}\nreturn null;',
        after: 'if (!user || !user.active) return null;\nif (!order) return null;\nreturn handle(order);',
    },
    dispatchTable: {
        before: "if (kind === 'card') {\n  payCard();\n} else if (kind === 'paypal') {\n  payPaypal();\n} else if (kind === 'bank') {\n  payBank();\n} else if (kind === 'cash') {\n  payCash();\n}",
        after: "const handlers = { card: payCard, paypal: payPaypal, bank: payBank, cash: payCash };\nhandlers[kind]?.();",
    },
    hoistSort: {
        before: 'for (const q of queries) {\n  data.sort();        // sorted again on every iteration\n  answer(data, q);\n}',
        after: 'data.sort();          // sort once\nfor (const q of queries) {\n  answer(data, q);\n}',
    },
    pairLookup: {
        before: 'for (const a of left) {\n  for (const b of right) {\n    if (a.id === b.id) merge(a, b);\n  }\n}',
        after: 'const byId = new Map(right.map(b => [b.id, b]));\nfor (const a of left) {\n  const b = byId.get(a.id);\n  if (b) merge(a, b);\n}',
    },
};

function jsSpec(id: LanguageId, name: string, wasmFile: string): LanguageSpec {
    return makeSpec({
        id,
        name,
        wasmFile,
        lineComment: '//',
        functionNodes: set('function_declaration', 'generator_function_declaration', 'method_definition'),
        lambdaNodes: set('arrow_function', 'function_expression', 'generator_function', 'function'),
        classNodes: set('class_declaration', 'class', 'abstract_class_declaration', 'internal_module'),
        getFunctionName: (n) => field(n, 'name')?.text,
        getFunctionKind: (n) => {
            if (n.type === 'method_definition') {
                return field(n, 'name')?.text === 'constructor' ? 'constructor' : 'method';
            }
            return 'function';
        },
        loopNodes: set('for_statement', 'for_in_statement', 'while_statement', 'do_statement'),
        getLoopInfo: (n) => {
            switch (n.type) {
                case 'for_statement':
                    return threeClauseLoop(n, 'initializer', 'condition', 'increment');
                case 'for_in_statement':
                    return { kind: 'foreach', variables: [field(n, 'left')?.text ?? ''], iterable: field(n, 'right')?.text, body: field(n, 'body') };
                case 'do_statement':
                    return { kind: 'do', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
                default:
                    return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
            }
        },
        ifNodes: set('if_statement'),
        elseNodes: set('else_clause'),
        switchNodes: set('switch_statement'),
        caseNodes: set('switch_case'),
        ternaryNodes: set('ternary_expression'),
        catchNodes: set('catch_clause'),
        binaryNodes: set('binary_expression'),
        booleanOperators: set('&&', '||', '??'),
        callNodes: set('call_expression', 'new_expression'),
        getCallee: (n) => {
            if (n.type === 'new_expression') {
                const c = field(n, 'constructor')?.text ?? '';
                return { name: `new ${c}`, full: `new ${c}` };
            }
            return calleeFromFunctionField(n);
        },
        getArguments: (n) => argumentsFromField(n),
        throwNodes: set('throw_statement'),
        assignmentNodes: set('assignment_expression', 'augmented_assignment_expression', 'variable_declarator'),
        collectionLiteralNodes: set('array', 'object'),
        stringLiteralNodes: set('string', 'template_string'),
        subscriptNodes: set('subscript_expression'),
        memberNodes: set('member_expression'),
        identifierNodes: set('identifier', 'property_identifier', 'shorthand_property_identifier', 'private_property_identifier'),
        numberLiteralNodes: set('number'),
        decoratorNodes: set('decorator'),
        iteratorMethods: set('forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'sort', 'toSorted', 'entries', 'keys', 'values', 'from'),
        appendMethods: set('push', 'unshift', 'add', 'set', 'splice', 'concat'),
        sortCalls: set('sort', 'toSorted'),
        linearSearchCalls: set('includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex', 'some', 'every', 'filter'),
        copyCalls: set('slice', 'from', 'assign', 'concat', 'structuredClone', 'parse', 'stringify', 'toSorted', 'toReversed', 'reverse'),
        frontMutationCalls: set('shift', 'unshift', 'splice(0'),
        regexCompileCalls: set('new RegExp', 'RegExp'),
        linearBuiltins: set('join', 'reverse', 'fill', 'from', 'assign', 'stringify', 'keys', 'values', 'entries', 'flat', 'concat'),
        collectionConstructors: set('new Array', 'new Set', 'new Map', 'new WeakMap', 'new WeakSet', 'Array', 'from', 'new Object'),
        hashTypeNames: set('Set', 'Map', 'WeakMap', 'WeakSet', 'Object'),
        listTypeNames: set('Array'),
        stringConcatIsQuadratic: false,
        selfNames: set('this', 'self', 'super'),
        snippets: JS_SNIPPETS,
    });
}

export const javascript = jsSpec('javascript', 'JavaScript', 'tree-sitter-javascript.wasm');
export const typescript = jsSpec('typescript', 'TypeScript', 'tree-sitter-typescript.wasm');
export const tsx = jsSpec('tsx', 'TSX', 'tree-sitter-tsx.wasm');
