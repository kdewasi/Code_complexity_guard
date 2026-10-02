import type { Node } from 'web-tree-sitter';
import { set } from './spec';
import { argumentsFromField, field, makeSpec } from './base';

export const RUBY_ITERATORS = set(
    'each', 'each_with_index', 'each_with_object', 'each_index', 'each_char', 'each_line', 'each_slice', 'each_cons', 'each_pair',
    'each_key', 'each_value', 'each_entry', 'map', 'map!', 'collect', 'collect!', 'flat_map', 'select', 'select!', 'filter', 'filter!',
    'reject', 'reject!', 'find', 'detect', 'find_all', 'find_index', 'index', 'inject', 'reduce', 'sum', 'count', 'any?', 'all?',
    'none?', 'one?', 'times', 'upto', 'downto', 'step', 'loop', 'min_by', 'max_by', 'sort_by', 'sort_by!', 'group_by', 'partition',
    'take_while', 'drop_while', 'zip', 'cycle', 'reverse_each', 'delete_if', 'keep_if', 'filter_map', 'tally', 'uniq', 'include?',
    'min', 'max', 'sort', 'sort!', 'reverse', 'join', 'flatten', 'compact', 'each_char', 'chars', 'split', 'scan', 'gsub', 'sub',
);

export const ruby = makeSpec({
    id: 'ruby',
    name: 'Ruby',
    wasmFile: 'tree-sitter-ruby.wasm',
    lineComment: '#',
    functionNodes: set('method', 'singleton_method'),
    lambdaNodes: set('lambda'),
    classNodes: set('class', 'module', 'singleton_class'),
    getFunctionKind: (n) => {
        const name = field(n, 'name')?.text;
        if (name === 'initialize') {
            return 'constructor';
        }
        return n.parent?.type === 'body_statement' ? 'method' : 'function';
    },
    getBody: (n) => field(n, 'body'),
    loopNodes: set('for', 'while', 'until', 'while_modifier', 'until_modifier'),
    getLoopInfo: (n) => {
        if (n.type === 'for') {
            const inNode = n.namedChildren.find((c) => c.type === 'in');
            return { kind: 'foreach', variables: [field(n, 'pattern')?.text ?? n.firstNamedChild?.text ?? ''], iterable: inNode?.firstNamedChild?.text, condition: inNode?.firstNamedChild ?? null, body: field(n, 'body') };
        }
        return { kind: 'while', variables: [], condition: field(n, 'condition'), body: field(n, 'body') };
    },
    ifNodes: set('if', 'unless', 'if_modifier', 'unless_modifier'),
    elseIfNodes: set('elsif'),
    elseNodes: set('else'),
    switchNodes: set('case', 'case_match'),
    caseNodes: set('when', 'in_clause'),
    ternaryNodes: set('conditional'),
    catchNodes: set('rescue', 'rescue_modifier'),
    binaryNodes: set('binary'),
    booleanOperators: set('&&', '||', 'and', 'or'),
    callNodes: set('call', 'method_call'),
    getCallee: (n) => {
        const method = field(n, 'method')?.text ?? '';
        const receiver = field(n, 'receiver')?.text;
        return { name: method, receiver, full: receiver ? `${receiver}.${method}` : method };
    },
    getArguments: (n) => argumentsFromField(n),
    throwNodes: set(),
    returnNodes: set('return'),
    assignmentNodes: set('assignment', 'operator_assignment'),
    collectionLiteralNodes: set('array', 'hash'),
    stringLiteralNodes: set('string', 'heredoc_body', 'string_array', 'symbol_array'),
    subscriptNodes: set('element_reference'),
    memberNodes: set(),
    identifierNodes: set('identifier', 'constant', 'instance_variable', 'class_variable', 'global_variable'),
    numberLiteralNodes: set('integer', 'float'),
    iteratorMethods: RUBY_ITERATORS,
    appendMethods: set('push', 'append', 'unshift', 'concat', 'store', 'merge!', 'insert', '<<'),
    sortCalls: set('sort', 'sort!', 'sort_by', 'sort_by!', 'min', 'max'),
    linearSearchCalls: set('include?', 'index', 'find_index', 'count', 'member?', 'find', 'detect', 'delete'),
    copyCalls: set('dup', 'clone', 'to_a', 'to_h', 'flatten', 'compact', 'uniq', 'reverse', 'sort', 'map', 'select'),
    frontMutationCalls: set(),
    regexCompileCalls: set('Regexp.new'),
    linearBuiltins: set('join', 'reverse', 'sum', 'min', 'max', 'count', 'flatten', 'compact', 'uniq', 'to_a', 'to_h', 'keys', 'values', 'tally', 'zip'),
    collectionConstructors: set('Array.new', 'Hash.new', 'Set.new', 'String.new', 'Hash', 'Array', 'Set'),
    hashTypeNames: set('Hash', 'Set'),
    listTypeNames: set('Array'),
    stringConcatIsQuadratic: true,
    selfNames: set('self'),
    snippets: {
        membershipSet: {
            before: 'items.each do |item|\n  if big_list.include?(item)   # scans big_list every time\n    ...\n  end\nend',
            after: "require 'set'\nlookup = big_list.to_set   # build once\nitems.each do |item|\n  if lookup.include?(item)   # O(1)\n    ...\n  end\nend",
        },
        stringBuilder: {
            before: 'result = ""\nparts.each do |part|\n  result += part   # allocates a new string each time\nend',
            after: 'result = parts.join   # one pass\n# or append in place: result << part',
        },
        memoization: {
            before: 'def fib(n)\n  return n if n < 2\n  fib(n - 1) + fib(n - 2)\nend',
            after: 'def fib(n, memo = {})\n  return n if n < 2\n  memo[n] ||= fib(n - 1, memo) + fib(n - 2, memo)\nend',
        },
        guardClauses: {
            before: 'if user\n  if user.active?\n    if order\n      return handle(order)\n    end\n  end\nend\nnil',
            after: 'return nil unless user&.active?\nreturn nil unless order\nhandle(order)',
        },
        dispatchTable: {
            before: "if kind == 'card'\n  pay_card\nelsif kind == 'paypal'\n  pay_paypal\nelsif kind == 'bank'\n  pay_bank\nelsif kind == 'cash'\n  pay_cash\nend",
            after: "HANDLERS = {\n  'card' => :pay_card, 'paypal' => :pay_paypal, 'bank' => :pay_bank, 'cash' => :pay_cash\n}.freeze\nsend(HANDLERS.fetch(kind))\n\n# or a case/when statement",
        },
        hoistSort: {
            before: 'queries.each do |q|\n  data.sort!   # sorted again on every iteration\n  answer(data, q)\nend',
            after: 'data.sort!     # sort once\nqueries.each do |q|\n  answer(data, q)\nend',
        },
        pairLookup: {
            before: 'left.each do |a|\n  right.each do |b|\n    merge(a, b) if a.id == b.id\n  end\nend',
            after: 'by_id = right.index_by(&:id)   # or right.to_h { |b| [b.id, b] }\nleft.each do |a|\n  b = by_id[a.id]\n  merge(a, b) if b\nend',
        },
    },
});

/** A Ruby call with an attached block ({ } or do ... end). */
export function rubyBlockOf(node: Node): Node | null {
    return field(node, 'block');
}
