/**
 * Walks one function body and collects FunctionFacts:
 *   - cyclomatic complexity (McCabe): 1 + decision points
 *   - cognitive complexity (SonarSource rules): increments plus nesting penalties
 *   - loop structure with per-loop growth factors (n, log n, √n, constant)
 *   - calls with the loop factor at the call site (for library costs and the call graph)
 *   - recursion sites, allocation and append sites (for space), pattern facts (for suggestions)
 */
import type { Node } from 'web-tree-sitter';
import { Confidence, DecisionPoint, Evidence } from './types';
import { EXPONENTIAL, LINEAR, LOG_N, N_LOG_N, ONE, SQRT_N, Term, factorWord, isConstant, multiply, notation, rank } from './bigo';
import { LanguageSpec } from './languages/spec';
import { collectIdentifiers, field, lambdaName } from './languages/base';
import { CallFact, FunctionFacts, LocatedFact, LoopFact, RecursionSite, WorstCase } from './facts';

const COMPREHENSION_TYPES = new Set(['list_comprehension', 'set_comprehension', 'dictionary_comprehension', 'generator_expression']);
const PAREN_TYPES = new Set(['parenthesized_expression', 'condition_clause']);
const JUMP_TYPES = new Set(['break_statement', 'continue_statement', 'break_expression', 'continue_expression']);
const GOTO_TYPES = new Set(['goto_statement']);
const UPDATE_TYPES = new Set(['update_expression', 'inc_statement', 'dec_statement', 'postfix_unary_expression', 'prefix_unary_expression', 'unary_expression']);
const DECLARATION_TYPES = new Set(['declaration', 'local_variable_declaration', 'variable_declaration', 'field_declaration', 'var_declaration', 'parameter_declaration']);
/** Variable names that almost always denote hash-based lookups when nothing else is known. */
const HASH_LIKE_NAME = /^(memo|cache|cached|seen|visited|dp|lookup|lookups|table|index|map|dict|set|hash|registry|known|by_?[a-z]+|counts?|freq|frequency|frequencies|graph|adj|adjacency|parents?|positions?|ids|keys)$/i;
const MULTIPLICATIVE_OPS = new Set(['*=', '/=', '//=', '>>=', '<<=', '**=']);
const MEMBER_CHAIN = /[.\->\[]/;

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Canonical variable name: strips sigils ($x, @x, &x, *x) and surrounding whitespace. */
function normVar(name: string): string {
    return name.trim().replace(/^[$@&*]+/, '');
}

function firstLine(text: string, max = 70): string {
    const line = text.split('\n')[0].trim();
    return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

export class FunctionWalker {
    private cyclomatic = 1;
    private cognitive = 0;
    private nesting = 0;
    private controlDepth = 0;
    private maxNesting = 0;
    private readonly decisionPoints: DecisionPoint[] = [];
    private readonly loops: LoopFact[] = [];
    private readonly loopStack: number[] = [];
    private readonly calls: CallFact[] = [];
    private readonly recursionSites: RecursionSite[] = [];
    private time: WorstCase = { term: ONE, evidence: [], confidence: 'high' };
    private space: WorstCase = { term: ONE, evidence: [], confidence: 'high' };
    private readonly membershipScans: LocatedFact[] = [];
    private readonly stringConcats: LocatedFact[] = [];
    private readonly sortsInLoops: LocatedFact[] = [];
    private readonly frontMutations: LocatedFact[] = [];
    private readonly copiesInLoops: LocatedFact[] = [];
    private readonly regexInLoops: LocatedFact[] = [];
    private readonly linearCallsInCondition: LocatedFact[] = [];
    private inLoopCondition = false;
    private readonly pairSearches: FunctionFacts['pairSearches'] = [];
    private readonly ifChains: FunctionFacts['ifChains'] = [];
    private readonly complexConditions: FunctionFacts['complexConditions'] = [];
    private readonly emptyCatches: FunctionFacts['emptyCatches'] = [];
    private readonly stringVars = new Set<string>();
    private readonly hashVars = new Set<string>();
    private readonly listVars = new Set<string>();
    private readonly paramNames = new Set<string>();
    private inBoolean = false;
    private storedContext = 0;
    private readonly fnText: string;

    constructor(
        private readonly spec: LanguageSpec,
        private readonly fn: Node,
        private readonly fnName: string,
        private readonly isMethod: boolean,
    ) {
        this.fnText = fn.text;
    }

    run(): FunctionFacts {
        const spec = this.spec;
        const params = field(this.fn, 'parameters') ?? field(this.fn, 'declarator');
        if (params) {
            for (const id of collectIdentifiers(params, 32)) {
                this.paramNames.add(normVar(id));
            }
            this.seedTypedParams(params);
        }
        for (const c of this.fn.namedChildren) {
            if (c.type.includes('comment')) {
                continue;
            }
            if (c.equals(params as Node)) {
                continue;
            }
            this.visit(c);
        }
        const body = spec.getBody(this.fn) ?? this.fn;
        const validationChain = this.findValidationChain(body);
        return {
            name: this.fnName,
            cyclomatic: this.cyclomatic,
            cognitive: this.cognitive,
            maxNesting: this.maxNesting,
            decisionPoints: this.decisionPoints,
            loops: this.loops,
            calls: this.calls,
            recursionSites: this.recursionSites,
            memoized: this.detectMemoization(),
            time: this.time,
            space: this.space,
            membershipScans: this.membershipScans,
            stringConcats: this.stringConcats,
            sortsInLoops: this.sortsInLoops,
            frontMutations: this.frontMutations,
            copiesInLoops: this.copiesInLoops,
            regexInLoops: this.regexInLoops,
            linearCallsInCondition: this.linearCallsInCondition,
            pairSearches: this.pairSearches,
            ifChains: this.ifChains,
            validationChain,
            complexConditions: this.complexConditions,
            emptyCatches: this.emptyCatches,
            lineCount: this.fn.endPosition.row - this.fn.startPosition.row + 1,
            parameterCount: spec.getParameterCount(this.fn),
            startLine: this.fn.startPosition.row,
            endLine: this.fn.endPosition.row,
        };
    }

    // ------------------------------------------------------------------ dispatch

    private visit(node: Node): void {
        const spec = this.spec;
        const type = node.type;
        if (spec.commentNodes.has(type)) {
            return;
        }
        if (spec.functionNodes.has(type) && !node.equals(this.fn)) {
            return; // nested named function: analysed as its own unit
        }
        if (spec.lambdaNodes.has(type) && !node.equals(this.fn)) {
            if (lambdaName(node)) {
                return; // stored under a name: its own unit
            }
            this.withNesting(() => this.visitChildren(node), true);
            return;
        }
        if (spec.ifNodes.has(type)) {
            this.visitIf(node, false);
            return;
        }
        if (COMPREHENSION_TYPES.has(type) && spec.id === 'python') {
            this.visitComprehension(node);
            return;
        }
        if (spec.loopNodes.has(type)) {
            this.visitLoop(node);
            return;
        }
        if (spec.switchNodes.has(type)) {
            this.visitSwitch(node);
            return;
        }
        if (spec.caseNodes.has(type)) {
            if (!spec.isDefaultCase(node)) {
                this.cyclomatic += 1;
                this.addDecision(node, 'case', 'case branch', 1, 0);
            }
            const guard = field(node, 'condition');
            if (guard) {
                this.visit(guard);
            }
            this.visitChildren(node, guard ? [guard] : []);
            return;
        }
        if (spec.ternaryNodes.has(type)) {
            this.cyclomatic += 1;
            this.cognitive += 1 + this.nesting;
            this.addDecision(node, 'ternary', 'conditional expression (?:)', 1, 1 + this.nesting);
            this.withNesting(() => this.visitChildren(node));
            return;
        }
        if (spec.catchNodes.has(type)) {
            this.cyclomatic += 1;
            this.cognitive += 1 + this.nesting;
            this.addDecision(node, 'catch', 'exception handler', 1, 1 + this.nesting);
            if (this.isEmptyHandler(node)) {
                this.emptyCatches.push({ line: node.startPosition.row });
            }
            this.withNesting(() => this.visitChildren(node));
            return;
        }
        if (spec.binaryNodes.has(type)) {
            const op = spec.getOperator(node);
            if (op && spec.booleanOperators.has(op)) {
                this.visitBooleanOp(node);
                return;
            }
            this.checkListMultiply(node);
            if (spec.id === 'ruby' && op === '<<' && this.loopStack.length > 0) {
                this.proposeSpace(this.currentFactor(), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 40)}\` appends one entry per iteration` }]), 'medium');
            }
            this.visitChildren(node);
            return;
        }
        if (GOTO_TYPES.has(type) || (JUMP_TYPES.has(type) && node.namedChildCount > 0)) {
            this.cognitive += 1;
            this.addDecision(node, 'jump', 'jump to label', 0, 1);
            this.visitChildren(node);
            return;
        }
        if (spec.callNodes.has(type)) {
            this.visitCall(node);
            return;
        }
        if (spec.assignmentNodes.has(type)) {
            this.visitAssignment(node);
            this.visitChildren(node);
            return;
        }
        if (type === 'comparison_operator' && spec.membershipOperators.size > 0) {
            this.checkPythonMembership(node);
            this.visitChildren(node);
            return;
        }
        if (spec.subscriptNodes.has(type) && spec.id === 'python') {
            const sub = field(node, 'subscript');
            // xs[:k] / xs[k:] copy up to n elements; xs[a:b] copies a bounded window.
            if (sub && sub.type === 'slice' && sub.namedChildCount < 2) {
                this.linearCost(node, `\`${firstLine(node.text, 30)}\` copies up to n elements`, LINEAR, true);
            }
            this.visitChildren(node);
            return;
        }
        if (type === 'spread_element') {
            this.linearCost(node, 'spread copy', LINEAR, true);
            this.visitChildren(node);
            return;
        }
        if (spec.collectionLiteralNodes.has(type) && !COMPREHENSION_TYPES.has(type)) {
            this.visitCollectionLiteral(node);
            return;
        }
        if (DECLARATION_TYPES.has(type)) {
            this.visitDeclaration(node);
            // fall through to normal child visiting
        }
        if (type === 'try_statement' || type === 'begin' || type === 'try_expression') {
            this.controlDepth += 1;
            this.maxNesting = Math.max(this.maxNesting, this.controlDepth);
            this.visitChildren(node);
            this.controlDepth -= 1;
            return;
        }
        this.visitChildren(node);
    }

    private visitChildren(node: Node, skip: Node[] = []): void {
        for (const c of node.namedChildren) {
            if (skip.some((s) => s.equals(c))) {
                continue;
            }
            this.visit(c);
        }
    }

    private withNesting(fn: () => void, lambda = false): void {
        this.nesting += 1;
        this.controlDepth += 1;
        if (!lambda) {
            this.maxNesting = Math.max(this.maxNesting, this.controlDepth);
        }
        try {
            fn();
        } finally {
            this.nesting -= 1;
            this.controlDepth -= 1;
        }
    }

    private addDecision(node: Node, kind: string, description: string, cyc: number, cog: number): void {
        this.decisionPoints.push({
            line: node.startPosition.row,
            kind,
            description,
            nesting: this.nesting,
            cyclomaticIncrement: cyc,
            cognitiveIncrement: cog,
        });
    }

    // ------------------------------------------------------------------ branches

    private visitIf(node: Node, asElseIf: boolean): void {
        const spec = this.spec;
        this.cyclomatic += 1;
        const cog = 1 + (asElseIf ? 0 : this.nesting);
        this.cognitive += cog;
        this.addDecision(node, asElseIf ? 'else-if' : 'if', asElseIf ? 'else-if branch' : `${node.type.startsWith('unless') ? 'unless' : 'if'} statement`, 1, cog);

        const condition = spec.getIfCondition(node);
        const consequence = field(node, 'consequence') ?? field(node, 'body');
        const alternatives = node.childrenForFieldName('alternative');
        if (condition) {
            this.inspectCondition(condition);
            this.visit(condition);
        }
        if (!asElseIf) {
            this.recordIfChain(node, condition);
        }
        const handled: Node[] = [];
        if (condition) {
            handled.push(condition);
        }
        if (consequence) {
            handled.push(consequence);
            this.withNesting(() => this.visit(consequence));
        }
        for (const alt of alternatives) {
            handled.push(alt);
            this.visitAlternative(alt);
        }
        // Anything else (rare grammar shapes) is treated as nested body.
        const rest = node.namedChildren.filter((c) => !handled.some((h) => h.equals(c)) && !spec.commentNodes.has(c.type));
        if (rest.length > 0) {
            this.withNesting(() => rest.forEach((r) => this.visit(r)));
        }
    }

    private visitAlternative(alt: Node): void {
        const spec = this.spec;
        if (spec.ifNodes.has(alt.type)) {
            this.visitIf(alt, true);
            return;
        }
        if (spec.elseIfNodes.has(alt.type)) {
            this.cyclomatic += 1;
            this.cognitive += 1;
            this.addDecision(alt, 'else-if', 'else-if branch', 1, 1);
            const condition = field(alt, 'condition');
            const consequence = field(alt, 'consequence') ?? field(alt, 'body');
            const nested = alt.childrenForFieldName('alternative');
            if (condition) {
                this.inspectCondition(condition);
                this.visit(condition);
            }
            if (consequence) {
                this.withNesting(() => this.visit(consequence));
            }
            for (const n of nested) {
                this.visitAlternative(n);
            }
            const rest = alt.namedChildren.filter((c) => !c.equals(condition as Node) && !c.equals(consequence as Node) && !nested.some((x) => x.equals(c)));
            if (rest.length > 0 && !consequence) {
                this.withNesting(() => rest.forEach((r) => this.visit(r)));
            }
            return;
        }
        if (spec.elseNodes.has(alt.type)) {
            const inner = alt.namedChildren.filter((c) => !spec.commentNodes.has(c.type));
            if (inner.length === 1 && spec.ifNodes.has(inner[0].type)) {
                this.visitIf(inner[0], true);
                return;
            }
            this.cognitive += 1;
            this.addDecision(alt, 'else', 'else branch', 0, 1);
            this.withNesting(() => inner.forEach((c) => this.visit(c)));
            return;
        }
        // Plain block as the else body (Java, Go, C#).
        this.cognitive += 1;
        this.addDecision(alt, 'else', 'else branch', 0, 1);
        this.withNesting(() => this.visit(alt));
    }

    private recordIfChain(node: Node, condition: Node | null): void {
        let branches = 1;
        const variables: (string | undefined)[] = [this.comparedVariable(condition)];
        let current: Node | null = node;
        let last: Node = node;
        const spec = this.spec;
        while (current) {
            const alts: Node[] = current.childrenForFieldName('alternative');
            let next: Node | null = null;
            for (const alt of alts) {
                if (spec.ifNodes.has(alt.type)) {
                    next = alt;
                } else if (spec.elseIfNodes.has(alt.type)) {
                    branches += 1;
                    variables.push(this.comparedVariable(field(alt, 'condition')));
                    last = alt;
                    next = alt;
                } else if (spec.elseNodes.has(alt.type)) {
                    const inner = alt.namedChildren.filter((c) => !spec.commentNodes.has(c.type));
                    if (inner.length === 1 && spec.ifNodes.has(inner[0].type)) {
                        next = inner[0];
                    }
                }
            }
            if (next && spec.ifNodes.has(next.type)) {
                branches += 1;
                variables.push(this.comparedVariable(spec.getIfCondition(next)));
                last = next;
            }
            current = next;
        }
        if (branches >= 3) {
            const defined = variables.filter((v): v is string => !!v);
            const same = defined.length === variables.length && defined.every((v) => v === defined[0]);
            this.ifChains.push({ line: node.startPosition.row, endLine: last.endPosition.row, branches, variable: same ? defined[0] : undefined });
        }
    }

    private comparedVariable(condition: Node | null): string | undefined {
        if (!condition) {
            return undefined;
        }
        const text = condition.text.replace(/^\(+|\)+$/g, '').trim();
        const m = text.match(/^([\w$@.>\-:]+?)\s*(?:===|==|\.equals\(|\.Equals\(|\beq\?|\bis\b|\bequals\b|strcmp\(|=== )/);
        return m ? m[1] : undefined;
    }

    private inspectCondition(condition: Node): void {
        let ops = 0;
        const spec = this.spec;
        const visit = (n: Node): void => {
            if (spec.binaryNodes.has(n.type)) {
                const op = spec.getOperator(n);
                if (op && spec.booleanOperators.has(op)) {
                    ops += 1;
                }
            }
            for (const c of n.namedChildren) {
                visit(c);
            }
        };
        visit(condition);
        if (ops >= 4) {
            this.complexConditions.push({ line: condition.startPosition.row, operators: ops });
        }
        this.checkPairSearch(condition);
    }

    private visitBooleanOp(node: Node): void {
        const spec = this.spec;
        this.cyclomatic += 1;
        if (!this.inBoolean) {
            const ops: string[] = [];
            const flatten = (n: Node): void => {
                if (spec.binaryNodes.has(n.type)) {
                    const op = spec.getOperator(n);
                    if (op && spec.booleanOperators.has(op)) {
                        const left = field(n, 'left');
                        const right = field(n, 'right');
                        if (left) {
                            flatten(left);
                        }
                        ops.push(op);
                        if (right) {
                            flatten(right);
                        }
                        return;
                    }
                }
                if (PAREN_TYPES.has(n.type) && n.namedChildCount === 1) {
                    flatten(n.namedChild(0) as Node);
                }
            };
            flatten(node);
            let runs = 0;
            for (let i = 0; i < ops.length; i++) {
                if (i === 0 || ops[i] !== ops[i - 1]) {
                    runs += 1;
                }
            }
            this.cognitive += runs;
            this.addDecision(node, 'boolean', `${ops.length} boolean operator${ops.length === 1 ? '' : 's'} (${runs} sequence${runs === 1 ? '' : 's'})`, 1, runs);
            this.inBoolean = true;
            try {
                this.visitChildren(node);
            } finally {
                this.inBoolean = false;
            }
            return;
        }
        this.addDecision(node, 'boolean', 'boolean operator', 1, 0);
        this.visitChildren(node);
    }

    private visitSwitch(node: Node): void {
        this.cognitive += 1 + this.nesting;
        this.addDecision(node, 'switch', 'switch / match', 0, 1 + this.nesting);
        const value = field(node, 'value') ?? field(node, 'condition');
        if (value) {
            this.visit(value);
        }
        this.withNesting(() => this.visitChildren(node, value ? [value] : []));
    }

    // ------------------------------------------------------------------ loops

    private visitLoop(node: Node): void {
        const spec = this.spec;
        const info = spec.getLoopInfo(node);
        const { factor, reason, confidence } = this.inferLoopFactor(node, info);
        // Parts evaluated once, before the loop starts.
        if (info.init) {
            this.visit(info.init);
        }
        if ((info.kind === 'foreach' || info.kind === 'comprehension') && info.condition) {
            this.visit(info.condition);
        }
        const loop = this.pushLoop(node, info.kind, factor, reason, confidence, info.variables, info.iterable);
        this.cyclomatic += 1;
        this.cognitive += 1 + this.nesting;
        this.addDecision(node, 'loop', `${info.kind} loop`, 1, 1 + this.nesting);
        this.withNesting(() => {
            if (info.condition && info.kind !== 'foreach' && info.kind !== 'comprehension') {
                this.inspectCondition(info.condition);
                this.inLoopCondition = true;
                try {
                    this.visit(info.condition);
                } finally {
                    this.inLoopCondition = false;
                }
            }
            if (info.update) {
                this.visit(info.update);
            }
            const skip = [info.init, info.condition, info.update].filter((n): n is Node => !!n);
            this.visitChildren(node, skip);
        });
        this.popLoop(loop);
    }

    private visitComprehension(node: Node): void {
        const clauses = node.namedChildren.filter((c) => c.type === 'for_in_clause');
        const ifs = node.namedChildren.filter((c) => c.type === 'if_clause');
        const body = node.namedChildren.filter((c) => c.type !== 'for_in_clause' && c.type !== 'if_clause');
        // The result is a new collection with up to n entries.
        this.allocation(node, 'comprehension result', LINEAR);
        const pushed: number[] = [];
        for (const clause of clauses) {
            const info = this.spec.getLoopInfo(clause);
            if (info.condition) {
                this.visit(info.condition);
            }
            const { factor, reason, confidence } = this.inferLoopFactor(clause, info);
            pushed.push(this.pushLoop(clause, 'comprehension', factor, reason, confidence, info.variables, info.iterable));
            this.cyclomatic += 1;
            this.cognitive += 1 + this.nesting;
            this.addDecision(clause, 'loop', 'comprehension loop', 1, 1 + this.nesting);
            this.nesting += 1;
        }
        for (const i of ifs) {
            this.cyclomatic += 1;
            this.addDecision(i, 'if', 'comprehension filter', 1, 0);
            this.visitChildren(i);
        }
        this.storedContext += 1;
        for (const b of body) {
            this.visit(b);
        }
        this.storedContext -= 1;
        for (let i = pushed.length - 1; i >= 0; i--) {
            this.nesting -= 1;
            this.popLoop(pushed[i]);
        }
    }

    private pushLoop(node: Node, kind: string, factor: Term, reason: string, confidence: Confidence, variables: string[], iterable?: string): number {
        const index = this.loops.length;
        const loop: LoopFact = {
            index,
            line: node.startPosition.row,
            endLine: node.endPosition.row,
            kind,
            factor,
            reason,
            confidence,
            depth: this.loopStack.length,
            parent: this.loopStack.length ? this.loopStack[this.loopStack.length - 1] : -1,
            variables: variables.filter((v) => v),
            iterable,
            header: firstLine(node.text),
        };
        this.loops.push(loop);
        this.loopStack.push(index);
        this.proposeTime(this.currentFactor(), this.loopEvidence(), confidence);
        return index;
    }

    private popLoop(index: number): void {
        const top = this.loopStack.pop();
        if (top !== index) {
            throw new Error('loop stack mismatch');
        }
    }

    private currentFactor(): Term {
        let t = ONE;
        for (const i of this.loopStack) {
            t = multiply(t, this.loops[i].factor);
        }
        return t;
    }

    private loopEvidence(extra: Evidence[] = []): Evidence[] {
        const ev: Evidence[] = [];
        for (const i of this.loopStack) {
            const l = this.loops[i];
            ev.push({ line: l.line, text: `\`${l.header}\` runs ${factorWord(l.factor)}: ${l.reason}` });
        }
        return ev.concat(extra);
    }

    private proposeTime(term: Term, evidence: Evidence[], confidence: Confidence): void {
        if (rank(term) > rank(this.time.term)) {
            this.time = { term, evidence, confidence };
        } else if (rank(term) === rank(this.time.term) && this.time.evidence.length === 0 && evidence.length > 0) {
            this.time = { term, evidence, confidence };
        }
    }

    private proposeSpace(term: Term, evidence: Evidence[], confidence: Confidence): void {
        if (rank(term) > rank(this.space.term)) {
            this.space = { term, evidence, confidence };
        }
    }

    private inferLoopFactor(node: Node, info: ReturnType<LanguageSpec['getLoopInfo']>): { factor: Term; reason: string; confidence: Confidence } {
        const iterable = (info.iterable ?? '').trim();
        if (info.kind === 'foreach' || info.kind === 'comprehension') {
            const rangeLit = iterable.match(/^(?:x?range|\.\.|)\(?\s*(\d+)\s*\)?$/);
            if (rangeLit) {
                return { factor: ONE, reason: `fixed range of ${rangeLit[1]}`, confidence: 'high' };
            }
            if (/^range\(\s*\d+\s*,\s*\d+(\s*,\s*-?\d+)?\s*\)$/.test(iterable) || /^\d+\.\.=?\d+$/.test(iterable) || /^\(\d+\.\.=?\d+\)$/.test(iterable)) {
                return { factor: ONE, reason: 'fixed numeric range', confidence: 'high' };
            }
            if (/^[\[{(].*[\]})]$/.test(iterable) && !/\.\.|range/.test(iterable) && iterable.length < 200 && !/\bfor\b/.test(iterable)) {
                return { factor: ONE, reason: 'fixed list of values written in the code', confidence: 'high' };
            }
            return { factor: LINEAR, reason: iterable ? `iterates over \`${firstLine(iterable, 40)}\`` : 'iterates over a collection', confidence: 'high' };
        }
        if (info.kind === 'iterator') {
            return { factor: LINEAR, reason: 'the callback runs once per element', confidence: 'high' };
        }
        if (info.kind === 'loop') {
            return { factor: LINEAR, reason: 'runs until a break; assumed once per element', confidence: 'low' };
        }
        const vars = info.variables.length ? info.variables : info.condition ? collectIdentifiers(info.condition, 3).filter((v) => !this.spec.selfNames.has(v)) : [];
        const condText = info.condition?.text ?? '';
        // Square-root loops: while (i * i <= n)
        if (vars.some((v) => new RegExp(`\\b${escapeRegExp(v)}\\s*\\*\\s*${escapeRegExp(v)}\\b`).test(condText))) {
            return { factor: SQRT_N, reason: `stops when \`${vars[0]}\` squared passes the bound`, confidence: 'medium' };
        }
        if (info.kind === 'for') {
            const updateText = info.update?.text ?? '';
            if (updateText) {
                if (this.isMultiplicativeUpdate(updateText, vars)) {
                    return { factor: LOG_N, reason: `\`${firstLine(updateText, 30)}\` multiplies or divides the loop variable each step`, confidence: 'high' };
                }
            }
            if (!info.condition && !info.update) {
                return { factor: LINEAR, reason: 'no condition: runs until a break (assumed once per element)', confidence: 'low' };
            }
            if (this.isLiteralBound(condText, vars)) {
                return { factor: ONE, reason: `bounded by the constant in \`${firstLine(condText, 30)}\``, confidence: 'high' };
            }
            return { factor: LINEAR, reason: `\`${firstLine(condText || updateText, 40)}\` advances one step at a time`, confidence: condText ? 'high' : 'medium' };
        }
        // while / do-while: look for how the condition variables change in the body.
        const body = info.body ?? node;
        const updates = this.collectUpdates(body, vars);
        if (updates.some((u) => u.kind === 'multiplicative')) {
            return { factor: LOG_N, reason: `\`${updates.find((u) => u.kind === 'multiplicative')?.text}\` halves or doubles the loop variable each step`, confidence: 'high' };
        }
        if (this.looksLikeBinarySearch(body, vars)) {
            return { factor: LOG_N, reason: 'binary search: the search range halves each step', confidence: 'high' };
        }
        if (updates.some((u) => u.kind === 'additive')) {
            return { factor: LINEAR, reason: `\`${updates.find((u) => u.kind === 'additive')?.text}\` moves one step at a time`, confidence: 'high' };
        }
        if (updates.some((u) => u.kind === 'consume')) {
            return { factor: LINEAR, reason: 'consumes one element per step', confidence: 'medium' };
        }
        if (/^\(?\s*(true|True|1|!0)\s*\)?$/.test(condText)) {
            return { factor: LINEAR, reason: 'runs until a break (assumed once per element)', confidence: 'low' };
        }
        if (this.isLiteralBound(condText, vars)) {
            return { factor: ONE, reason: `bounded by the constant in \`${firstLine(condText, 30)}\``, confidence: 'medium' };
        }
        return { factor: LINEAR, reason: `\`${firstLine(condText, 40)}\` is assumed to advance one step per iteration`, confidence: 'low' };
    }

    private isLiteralBound(condText: string, vars: string[]): boolean {
        for (const v of vars) {
            const re = new RegExp(`^\\(?\\s*${escapeRegExp(v)}\\s*(<|<=|>|>=|!=|!==)\\s*-?\\d+(\\.\\d+)?\\s*\\)?$`);
            if (re.test(condText.trim())) {
                return true;
            }
        }
        return false;
    }

    private isMultiplicativeUpdate(text: string, vars: string[]): boolean {
        const t = text.replace(/\s+/g, '');
        for (const v of vars.length ? vars : ['\\w+']) {
            const e = vars.length ? escapeRegExp(v) : v;
            if (new RegExp(`^${e}(\\*=|/=|//=|>>=|<<=)`).test(t)) {
                return true;
            }
            if (new RegExp(`^${e}=\\(?${e}(\\*|/|//|>>|<<)`).test(t) || new RegExp(`^${e}=[\\w.()]+\\*${e}`).test(t)) {
                return true;
            }
        }
        return false;
    }

    private collectUpdates(body: Node, vars: string[]): { kind: 'multiplicative' | 'additive' | 'consume'; text: string }[] {
        const out: { kind: 'multiplicative' | 'additive' | 'consume'; text: string }[] = [];
        const spec = this.spec;
        const varSet = new Set(vars);
        const visit = (n: Node): void => {
            if (spec.assignmentNodes.has(n.type)) {
                const a = spec.getAssignment(n);
                if (a) {
                    const target = a.target.replace(/\s+/g, '');
                    if (varSet.has(target)) {
                        const valueText = (a.value?.text ?? '').replace(/\s+/g, '');
                        if (MULTIPLICATIVE_OPS.has(a.operator) || new RegExp(`^\\(?${escapeRegExp(target)}(\\*|/|//|>>|<<)`).test(valueText) || new RegExp(`^[\\w.()]+\\*${escapeRegExp(target)}$`).test(valueText)) {
                            out.push({ kind: 'multiplicative', text: firstLine(n.text, 30) });
                        } else if (a.operator === '+=' || a.operator === '-=' || new RegExp(`^\\(?${escapeRegExp(target)}(\\+|-)`).test(valueText) || /\.(pop|shift|next|popleft|poll|remove|dequeue)\(/.test(valueText) || /^\w+\[\d+:\]/.test(valueText)) {
                            out.push({ kind: 'additive', text: firstLine(n.text, 30) });
                        } else if (/\.(next|tail|parent|left|right)\b/.test(valueText)) {
                            out.push({ kind: 'additive', text: firstLine(n.text, 30) });
                        }
                    }
                }
            } else if (UPDATE_TYPES.has(n.type)) {
                const ids = collectIdentifiers(n, 1);
                if (ids.length && varSet.has(ids[0]) && /\+\+|--/.test(n.text)) {
                    out.push({ kind: 'additive', text: firstLine(n.text, 30) });
                }
            } else if (spec.callNodes.has(n.type)) {
                const callee = spec.getCallee(n);
                if (callee && /^(pop|popleft|shift|poll|pollFirst|pollLast|dequeue|remove|removeFirst|pop_front|pop_back|next|Dequeue|Pop|TryDequeue|take|get|Take|Next|__next__|read|readline|recv)$/.test(callee.name) && callee.receiver && varSet.has(callee.receiver)) {
                    out.push({ kind: 'consume', text: firstLine(n.text, 30) });
                }
            }
            for (const c of n.namedChildren) {
                visit(c);
            }
        };
        visit(body);
        return out;
    }

    private looksLikeBinarySearch(body: Node, vars: string[]): boolean {
        const text = body.text;
        const hasMid = /\b(mid|middle|m|pivot|half)\w*\s*(=|:=)\s*[^;\n]*(\/\/?\s*2|>>\s*1|\/\s*2\b)/.test(text);
        if (!hasMid) {
            return false;
        }
        return vars.some((v) => new RegExp(`\\b${escapeRegExp(v)}\\s*=\\s*(mid|middle|m|pivot|half)\\w*\\s*([+-]\\s*1)?\\s*[;\\n]`).test(text));
    }

    // ------------------------------------------------------------------ calls

    private visitCall(node: Node): void {
        const spec = this.spec;
        const callee = spec.getCallee(node);
        const args = spec.getArguments(node);
        const block = spec.id === 'ruby' ? field(node, 'block') : null;
        const line = node.startPosition.row;
        const factor = this.currentFactor();
        const savedBoolean = this.inBoolean;
        this.inBoolean = false;
        try {
            if (!callee) {
                this.visitChildren(node);
                return;
            }
            const name = callee.name;
            const argsText = args.map((a) => a.text);
            this.calls.push({
                line,
                name,
                receiver: callee.receiver,
                full: callee.full,
                argsText,
                factor,
                enclosingLoops: [...this.loopStack],
                userCandidate: !callee.receiver || spec.selfNames.has(callee.receiver) || spec.selfNames.has(callee.receiver.split(/[.\->:]/)[0]),
                text: firstLine(node.text, 60),
            });
            const isSelfCall = this.checkRecursion(callee, argsText, line);
            // Calls on self/this are user methods, never library calls.
            const isUserMethod = isSelfCall || (!!callee.receiver && spec.selfNames.has(callee.receiver));

            const callbackArgs = args.filter((a) => spec.lambdaNodes.has(a.type) || (spec.id === 'ruby' && (a.type === 'block' || a.type === 'do_block')));
            const hasCallback = callbackArgs.length > 0 || !!block;
            const isIterator = !isUserMethod && spec.iteratorMethods.has(name) && (hasCallback || !!callee.receiver || spec.id === 'python');
            const isSort = !isUserMethod && (spec.sortCalls.has(name) || spec.sortCalls.has(callee.full));

            // Receiver / callee expression is evaluated once, outside the callback loop.
            const fnNode = field(node, 'function') ?? field(node, 'receiver') ?? field(node, 'object');
            if (fnNode) {
                this.visit(fnNode);
            }

            if (isUserMethod) {
                // nothing: cost comes from the call graph
            } else if (isSort) {
                this.linearCost(node, `\`${firstLine(callee.full, 30)}(...)\` sorts: about n log n steps`, N_LOG_N, spec.id === 'python' && name === 'sorted');
                if (this.loopStack.length > 0) {
                    this.sortsInLoops.push(this.located(node, `${callee.full}(...)`));
                }
            } else if (spec.regexCompileCalls.has(name) || spec.regexCompileCalls.has(callee.full)) {
                if (this.loopStack.length > 0) {
                    this.regexInLoops.push(this.located(node, callee.full));
                }
            } else if (this.isFrontMutation(callee, argsText)) {
                this.linearCost(node, `\`${firstLine(node.text, 30)}\` shifts every remaining element: n steps`, LINEAR, false);
                if (this.loopStack.length > 0) {
                    this.frontMutations.push(this.located(node, firstLine(node.text, 40)));
                }
            } else if (spec.linearSearchCalls.has(name) || spec.linearSearchCalls.has(callee.full)) {
                const container = callee.receiver ?? (argsText.length > 1 ? argsText[1] : argsText[0]) ?? '';
                if (!this.isHashContainer(container)) {
                    this.linearCost(node, `\`${firstLine(node.text, 36)}\` scans the whole collection: n steps`, LINEAR, false);
                    if (this.loopStack.length > 0) {
                        this.membershipScans.push(this.located(node, container));
                    }
                }
            } else if (spec.copyCalls.has(name) || spec.copyCalls.has(callee.full)) {
                const copies = argsText.length > 0 || !!callee.receiver;
                // slice(a, b) / GetRange(a, n) / subList(a, b) copy a bounded window, not the whole collection.
                const bounded = /^(slice|subList|GetRange|substring|substr|copyOfRange)$/.test(name) && argsText.length >= 2;
                if (copies && !bounded && !this.isCapacityOnly(name, argsText)) {
                    this.linearCost(node, `\`${firstLine(node.text, 36)}\` copies a collection: n steps and n memory`, LINEAR, true);
                    if (this.loopStack.length > 0) {
                        this.copiesInLoops.push(this.located(node, firstLine(node.text, 40)));
                    }
                }
            } else if (spec.collectionConstructors.has(name) || spec.collectionConstructors.has(callee.full)) {
                this.allocationFromCall(node, callee.full, argsText);
            } else if (spec.appendMethods.has(name)) {
                this.appendSite(node, args);
            } else if (isIterator && !hasCallback) {
                this.linearCost(node, `\`${firstLine(node.text, 36)}\` walks the whole collection: n steps`, LINEAR, this.producesCollection(name));
            } else if (spec.linearBuiltins.has(name) || spec.linearBuiltins.has(callee.full)) {
                this.linearCost(node, `\`${firstLine(node.text, 36)}\` is linear in the size of its input`, LINEAR, false);
                if (this.inLoopCondition && this.loopStack.length > 0) {
                    this.linearCallsInCondition.push(this.located(node, firstLine(node.text, 40)));
                }
            }

            if (isIterator && hasCallback) {
                const callbackParams: string[] = [];
                for (const cb of callbackArgs.concat(block ? [block] : [])) {
                    const p = field(cb, 'parameters') ?? field(cb, 'parameter');
                    if (p) {
                        callbackParams.push(...collectIdentifiers(p, 4));
                    }
                }
                const literalReceiver = /^\d+$/.test((callee.receiver ?? '').trim());
                const loopIndex = this.pushLoop(
                    node,
                    'iterator',
                    literalReceiver ? ONE : LINEAR,
                    literalReceiver ? `runs a fixed ${callee.receiver} times` : `\`${name}\` calls the callback once per element`,
                    'high',
                    callbackParams,
                    callee.receiver,
                );
                // A callback with a statement body reads like a loop body; count it as one.
                const blockBodied = !!block || callbackArgs.some((cb) => {
                    const body = field(cb, 'body');
                    return !!body && /block|compound_statement|body_statement/.test(body.type);
                });
                if (blockBodied) {
                    this.cyclomatic += 1;
                    this.cognitive += 1 + this.nesting;
                    this.addDecision(node, 'loop', `\`${name}\` block (runs once per element)`, 1, 1 + this.nesting);
                }
                const savedCondition = this.inLoopCondition;
                this.inLoopCondition = false;
                // Lambda arguments add their own nesting level; Ruby blocks do not.
                for (const a of args) {
                    this.visit(a);
                }
                if (block) {
                    this.withNesting(() => this.visit(block));
                }
                this.inLoopCondition = savedCondition;
                this.popLoop(loopIndex);
                if (this.producesCollection(name)) {
                    this.allocation(node, `\`${name}\` builds a new collection`, LINEAR);
                }
                return;
            }
            for (const a of args) {
                this.visit(a);
            }
            if (block) {
                this.visit(block);
            }
            // Visit anything else (e.g. type arguments) without double-visiting handled parts.
            const handled = [fnNode, field(node, 'arguments'), block].filter((n): n is Node => !!n);
            this.visitChildren(node, handled.concat(args));
        } finally {
            this.inBoolean = savedBoolean;
        }
    }

    private isFrontMutation(callee: { name: string; full: string }, argsText: string[]): boolean {
        const spec = this.spec;
        for (const pattern of spec.frontMutationCalls) {
            const m = pattern.match(/^([\w]+)\((.*)$/);
            if (m) {
                if (callee.name === m[1] && argsText.length > 0 && argsText[0].replace(/\s/g, '') === m[2].replace(/[,)]$/, '')) {
                    return true;
                }
            } else if (callee.name === pattern && (pattern === 'shift' || pattern === 'unshift' || pattern === 'array_shift' || pattern === 'array_unshift')) {
                return true;
            }
        }
        return false;
    }

    private isCapacityOnly(name: string, argsText: string[]): boolean {
        return /^new /.test(name) && argsText.length === 1 && /^\d+$/.test(argsText[0]);
    }

    private producesCollection(name: string): boolean {
        return /^(map|filter|sorted|reversed|list|collect|toList|ToList|ToArray|Select|Where|OrderBy|flatMap|flat_map|filter_map|select|reject|collect|to_a|array_map|array_filter|zip|enumerate|sort_by|group_by|GroupBy|Distinct|distinct|chunks|windows|cloned|copied|entries|keys|values|from|toSorted|toReversed|concat|slice|Skip|Take|Reverse|ToDictionary|ToHashSet|partition|uniq|compact|flatten|tally)$/.test(name);
    }

    private isHashContainer(container: string): boolean {
        const base = normVar(container.split(/[.\->\[(]/)[0]);
        if (this.hashVars.has(base)) {
            return true;
        }
        if (this.listVars.has(base) || this.stringVars.has(base)) {
            return false;
        }
        // Unknown origin: fall back to what the name usually means.
        const last = container.split(/[.\->]/).pop()?.replace(/[()\[\]]/g, '').trim() ?? base;
        return HASH_LIKE_NAME.test(base) || HASH_LIKE_NAME.test(last);
    }

    /** Typed declarations (C/C++/Java/C#/Go): remember which locals are hash or list typed. */
    private visitDeclaration(node: Node): void {
        const spec = this.spec;
        const typeText = (field(node, 'type')?.text ?? '').replace(/<.*$/, '').replace(/^(const|static|final|readonly|var)\s+/, '').replace(/^std::/, '').trim();
        if (!typeText) {
            return;
        }
        const names: string[] = [];
        for (const d of node.childrenForFieldName('declarator').concat(node.childrenForFieldName('name'))) {
            let cur: Node | null = d;
            for (let i = 0; i < 6 && cur; i++) {
                if (spec.identifierNodes.has(cur.type) || cur.type === 'identifier') {
                    names.push(cur.text);
                    break;
                }
                const next: Node | null = field(cur, 'declarator') ?? field(cur, 'name') ?? cur.namedChildren.find((c) => spec.identifierNodes.has(c.type)) ?? null;
                if (!next) {
                    break;
                }
                cur = next;
            }
        }
        for (const c of node.namedChildren) {
            if (c.type === 'variable_declarator') {
                const n = field(c, 'name');
                if (n) {
                    names.push(n.text);
                }
            }
        }
        if (names.length === 0) {
            return;
        }
        const isHash = [...spec.hashTypeNames].some((h) => typeText === h || typeText.endsWith('.' + h) || typeText.endsWith('::' + h) || typeText.startsWith(h + '[') || typeText === `map[` || (spec.id === 'go' && typeText.startsWith('map[')));
        const isList = [...spec.listTypeNames].some((l) => typeText === l || typeText.endsWith('.' + l) || typeText.endsWith('::' + l) || typeText.endsWith('[]'));
        for (const raw of names) {
            const n = normVar(raw);
            if (isHash) {
                this.hashVars.add(n);
            } else if (isList) {
                this.listVars.add(n);
            } else if (/^(String|string|str|char\*)$/.test(typeText)) {
                this.stringVars.add(n);
            }
        }
    }

    private located(node: Node, detail: string): LocatedFact {
        return {
            line: node.startPosition.row,
            endLine: node.endPosition.row,
            factor: this.currentFactor(),
            enclosingLoops: [...this.loopStack],
            detail,
        };
    }

    /** A call or operation that costs `cost` each time it runs. */
    private linearCost(node: Node, why: string, cost: Term, allocates: boolean): void {
        const total = multiply(this.currentFactor(), cost);
        const ev = this.loopEvidence([{ line: node.startPosition.row, text: why }]);
        this.proposeTime(total, ev, 'medium');
        if (allocates) {
            this.allocation(node, why, cost);
        }
    }

    private allocation(node: Node, why: string, size: Term): void {
        const stored = this.storedContext > 0;
        const total = stored ? multiply(this.currentFactor(), size) : size;
        if (isConstant(total)) {
            return;
        }
        const ev: Evidence[] = stored ? this.loopEvidence() : [];
        ev.push({ line: node.startPosition.row, text: `${why}${stored ? ' (kept for every iteration)' : ''}` });
        this.proposeSpace(total, ev, 'medium');
    }

    private allocationFromCall(node: Node, name: string, argsText: string[]): void {
        const spec = this.spec;
        const sized = argsText.some((a) => !/^\d+$/.test(a.trim()) && !/^["'`]/.test(a.trim()) && !/^(sizeof|typeof)\b/.test(a));
        if (!sized) {
            return;
        }
        const copyLike = argsText.some((a) => /^[A-Za-z_$][\w$]*$/.test(a.trim()) && !/^(n|len|size|count|length|cap|capacity|m|k|rows|cols)$/i.test(a.trim()) && (this.listVars.has(a.trim()) || this.hashVars.has(a.trim()) || spec.id !== 'c'));
        let size = LINEAR;
        if (spec.id === 'java' || spec.id === 'csharp') {
            // new int[n][m]
            const dims = node.text.match(/\]\s*\[/g);
            if (dims && dims.length >= 1 && !/^new\s+\w+\s*\[\s*\d+\s*\]/.test(node.text)) {
                size = { n: dims.length + 1, log: 0, sqrt: 0, exp: false };
            }
        }
        this.allocation(node, `\`${firstLine(node.text, 36)}\` allocates ${notation(size).slice(2, -1)} entries`, size);
        if (copyLike) {
            this.proposeTime(multiply(this.currentFactor(), LINEAR), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 36)}\` copies its input: n steps` }]), 'medium');
        }
    }

    private appendSite(node: Node, args: Node[]): void {
        const factor = this.currentFactor();
        if (isConstant(factor)) {
            return;
        }
        const spec = this.spec;
        const growsByCollection = args.some((a) => spec.collectionLiteralNodes.has(a.type) || COMPREHENSION_TYPES.has(a.type) || (spec.callNodes.has(a.type) && this.isCollectionProducingCall(a)));
        const size = growsByCollection ? multiply(factor, LINEAR) : factor;
        const ev = this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 40)}\` adds ${growsByCollection ? 'a whole collection' : 'one entry'} on every iteration` }]);
        this.proposeSpace(size, ev, 'medium');
    }

    private isCollectionProducingCall(call: Node): boolean {
        const callee = this.spec.getCallee(call);
        if (!callee) {
            return false;
        }
        return this.spec.collectionConstructors.has(callee.name) || this.spec.collectionConstructors.has(callee.full) || this.producesCollection(callee.name) || this.spec.copyCalls.has(callee.name);
    }

    private checkRecursion(callee: { name: string; receiver?: string; full: string }, argsText: string[], line: number): boolean {
        const spec = this.spec;
        const target = this.fnName.split(/::|\./).pop() ?? this.fnName;
        if (callee.name !== target && callee.name !== `${target}!`) {
            return false;
        }
        let kind: RecursionSite['receiverKind'];
        if (!callee.receiver) {
            kind = 'none';
        } else if (spec.selfNames.has(callee.receiver) || spec.selfNames.has(callee.receiver.replace(/^[&*]/, ''))) {
            kind = 'self';
        } else if (MEMBER_CHAIN.test(callee.receiver) || this.isMethod) {
            if (!this.isMethod && !MEMBER_CHAIN.test(callee.receiver)) {
                return false;
            }
            kind = 'member';
        } else {
            return false;
        }
        const loopVars = new Set<string>();
        for (const i of this.loopStack) {
            for (const v of this.loops[i].variables) {
                loopVars.add(v.replace(/^[&*]/, ''));
            }
        }
        const viaLoopVariable = argsText.some((a) => loopVars.has(a.trim().replace(/^[&*]/, '')));
        this.recursionSites.push({ line, argsText, receiverKind: kind, viaLoopVariable });
        this.cognitive += 1;
        this.decisionPoints.push({ line, kind: 'recursion', description: 'recursive call', nesting: this.nesting, cyclomaticIncrement: 0, cognitiveIncrement: 1 });
        return true;
    }

    private detectMemoization(): boolean {
        const text = this.fnText;
        if (/@\s*(functools\.)?(lru_cache|cache|cached_property|memoize|memoized|cached)\b/.test(text)) {
            return true;
        }
        if (/\b(memo|cache|cached|_memo|_cache|lookup|dp|table|seen)\w*\s*(\[|\.get\(|\.has\(|\.containsKey\(|\.contains\(|\.TryGetValue\(|\.find\(|\.fetch\(|\.entry\()/.test(text) || /\bin\s+(memo|cache|_memo|_cache|dp|seen)\w*\b/.test(text) || /isset\(\$(memo|cache)/.test(text)) {
            return true;
        }
        // Python decorators live on the wrapping decorated_definition node.
        const parent = this.fn.parent;
        if (parent && parent.type === 'decorated_definition') {
            for (const d of parent.namedChildren) {
                if (d.type === 'decorator' && /lru_cache|\bcache\b|memoize|cached/.test(d.text)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ assignments, literals

    private seedTypedParams(params: Node): void {
        const spec = this.spec;
        for (const p of params.namedChildren) {
            const typeText = (field(p, 'type')?.text ?? '').replace(/<.*$/, '').replace(/^(const|final|readonly)\s+/, '').replace(/^std::/, '').trim();
            const name = normVar(field(p, 'name')?.text ?? field(p, 'pattern')?.text ?? field(p, 'declarator')?.text ?? '');
            if (!name) {
                continue;
            }
            // Python-style defaults: memo={} / seen=set() / out=[]
            const def = (field(p, 'value')?.text ?? '').trim();
            if (def) {
                if (/^(\{\}|dict\(|set\(|defaultdict\(|OrderedDict\(|Counter\(|\{[^}]*:)/.test(def)) {
                    this.hashVars.add(name);
                } else if (/^(\[\]|list\(|deque\()/.test(def)) {
                    this.listVars.add(name);
                }
                continue;
            }
            if (/^(String|string|str|&str|&String|std::string|char\*|char \*)$/.test(typeText)) {
                this.stringVars.add(name);
            } else if (typeText && [...spec.hashTypeNames].some((h) => typeText === h || typeText.endsWith('.' + h) || typeText.endsWith('::' + h))) {
                this.hashVars.add(name);
            } else if (typeText && [...spec.listTypeNames].some((l) => typeText === l || typeText.endsWith('.' + l) || typeText.endsWith('::' + l))) {
                this.listVars.add(name);
            }
        }
    }

    private visitAssignment(node: Node): void {
        const spec = this.spec;
        const a = spec.getAssignment(node);
        if (!a) {
            return;
        }
        const target = normVar(a.target.replace(/\s+/g, ''));
        const value = a.value;
        const valueText = value?.text ?? '';
        const base = target.split(/[.\->\[(]/)[0];

        // Track variable kinds for later checks.
        if (value) {
            if (spec.stringLiteralNodes.has(value.type) || /^(str|String|string)\(/.test(valueText) || /^(f|r|b)?["'`]/.test(valueText) || /^\$"/.test(valueText)) {
                this.stringVars.add(target);
            } else {
                const callee = spec.callNodes.has(value.type) ? spec.getCallee(value) : undefined;
                const ctor = callee ? callee.full.replace(/<.*$/, '') : valueText.replace(/<.*$/, '').replace(/\(.*$/, '');
                const hashy = [...spec.hashTypeNames].some((h) => ctor === h || ctor === `new ${h}` || ctor.endsWith(`.${h}`) || ctor.endsWith(`::${h}`) || ctor === `${h}::new` || ctor === `${h}.new`);
                const listy = [...spec.listTypeNames].some((l) => ctor === l || ctor === `new ${l}` || ctor.endsWith(`.${l}`) || ctor === `${l}::new` || ctor === `${l}.new`);
                if (value.type === 'set' || value.type === 'dictionary' || value.type === 'object' || value.type === 'hash' || /^map\[/.test(valueText) || hashy) {
                    this.hashVars.add(target);
                } else if (value.type === 'list' || value.type === 'array' || value.type === 'array_creation_expression' || value.type === 'composite_literal' || listy || /^vec!/.test(valueText)) {
                    this.listVars.add(target);
                }
            }
        }

        // String building inside loops.
        const isConcat = (a.operator === '+=' || a.operator === '.=' || (a.operator === '=' && new RegExp(`^\\(?${escapeRegExp(target)}\\s*(\\+|\\.)\\s*`).test(valueText)));
        if (isConcat && this.loopStack.length > 0 && spec.stringConcatIsQuadratic) {
            const isString = this.stringVars.has(target) || /["'`]/.test(valueText) || /^(f|r)["']/.test(valueText) || /\bstr\(|String\.valueOf|\.toString\(\)|\.to_string\(\)|strconv\./.test(valueText);
            if (isString) {
                const fact = this.located(node, target);
                this.stringConcats.push(fact);
                this.proposeTime(multiply(this.currentFactor(), LINEAR), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 30)}\` copies the whole string on every iteration` }]), 'medium');
                this.proposeSpace(LINEAR, [{ line: node.startPosition.row, text: `builds a string of up to n characters` }], 'medium');
            }
        }

        // Growing a collection through indexed assignment or PHP `$a[] = x` inside a loop.
        if (this.loopStack.length > 0 && spec.subscriptNodes.size > 0 && target !== base && /\[/.test(target) && !this.isLoopVariable(base)) {
            if (!this.paramNamesHasArrayWrite(base)) {
                const growsByCollection = !!value && (spec.collectionLiteralNodes.has(value.type) || COMPREHENSION_TYPES.has(value.type) || (spec.callNodes.has(value.type) && this.isCollectionProducingCall(value)));
                const size = growsByCollection ? multiply(this.currentFactor(), LINEAR) : this.currentFactor();
                if (!isConstant(size)) {
                    this.proposeSpace(size, this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 40)}\` fills one entry per iteration` }]), 'medium');
                }
            }
        }
        // Go: xs = append(xs, v)
        if (spec.id === 'go' && /^append\(/.test(valueText) && this.loopStack.length > 0) {
            this.proposeSpace(this.currentFactor(), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 40)}\` appends one entry per iteration` }]), 'medium');
        }
        // Ruby: xs << v
        if (spec.id === 'ruby' && node.type === 'binary' && this.loopStack.length > 0) {
            this.proposeSpace(this.currentFactor(), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 40)}\` appends one entry per iteration` }]), 'medium');
        }
    }

    private paramNamesHasArrayWrite(base: string): boolean {
        // Writing into a parameter array (in-place algorithms) does not allocate.
        return this.paramNames.has(base) && this.listVars.has(base) === false && this.hashVars.has(base) === false && this.spec.id !== 'python';
    }

    private isLoopVariable(name: string): boolean {
        return this.loops.some((l) => l.variables.includes(name));
    }

    private visitCollectionLiteral(node: Node): void {
        const spec = this.spec;
        // Java `new int[n]`, C# `new int[n]`: size n allocation.
        if (node.type === 'array_creation_expression') {
            const dims = node.childrenForFieldName('dimensions').filter((d) => d.type === 'dimensions_expr');
            const sized = dims.filter((d) => !/^\d+$/.test(d.text.trim()));
            if (sized.length > 0 || /\[\s*[A-Za-z_]/.test(node.text)) {
                const count = Math.max(1, sized.length || (node.text.match(/\[\s*[A-Za-z_][^\]]*\]/g) ?? []).length);
                this.allocation(node, `\`${firstLine(node.text, 36)}\` allocates ${count > 1 ? `n${count === 2 ? '²' : '³'}` : 'n'} entries`, { n: count, log: 0, sqrt: 0, exp: false });
            }
        } else if (node.namedChildCount > 0 && this.storedContext > 0) {
            // A literal created for every iteration of a comprehension.
            this.allocation(node, 'a new collection literal per iteration', ONE);
        }
        if (spec.id === 'ruby' || spec.id === 'php') {
            this.visitChildren(node);
            return;
        }
        this.visitChildren(node);
    }

    /** Python `[0] * n` creates n entries. */
    private checkListMultiply(node: Node): void {
        if (this.spec.id !== 'python') {
            return;
        }
        const op = this.spec.getOperator(node);
        if (op !== '*') {
            return;
        }
        const left = field(node, 'left');
        const right = field(node, 'right');
        const isList = (n: Node | null): boolean => !!n && (n.type === 'list' || n.type === 'string');
        const sizeNode = isList(left) ? right : isList(right) ? left : null;
        if (sizeNode && !/^\d+$/.test(sizeNode.text.trim())) {
            this.allocation(node, `\`${firstLine(node.text, 30)}\` creates n entries`, LINEAR);
            this.proposeTime(multiply(this.currentFactor(), LINEAR), this.loopEvidence([{ line: node.startPosition.row, text: `\`${firstLine(node.text, 30)}\` writes n entries` }]), 'medium');
        }
    }

    private checkPythonMembership(node: Node): void {
        const ops = node.children.filter((c) => !c.isNamed).map((c) => c.type);
        if (!ops.some((o) => this.spec.membershipOperators.has(o))) {
            return;
        }
        const operands = node.namedChildren;
        const container = operands[operands.length - 1];
        if (!container) {
            return;
        }
        const text = container.text.trim();
        if (/^[\[(]/.test(text) && text.length < 120) {
            return; // literal small tuple/list
        }
        if (this.isHashContainer(text) || /^[{]/.test(text) || /^(set|dict|frozenset)\(/.test(text) || /\.keys\(\)$/.test(text)) {
            return;
        }
        if (/^["'f]/.test(text)) {
            return; // substring search; usually short
        }
        this.linearCost(node, `\`${firstLine(node.text, 36)}\` scans \`${firstLine(text, 20)}\` element by element`, LINEAR, false);
        if (this.loopStack.length > 0) {
            this.membershipScans.push(this.located(node, text));
        }
    }

    private checkPairSearch(condition: Node): void {
        if (this.loopStack.length < 2) {
            return;
        }
        const text = condition.text;
        const m = text.match(/(===|==|\.equals\(|\.Equals\(|\beq\?|strcmp\()/);
        if (!m || m.index === undefined) {
            return;
        }
        const left = text.slice(0, m.index);
        const right = text.slice(m.index + m[0].length);
        const inner = this.loops[this.loopStack[this.loopStack.length - 1]];
        const outer = this.loops[this.loopStack[this.loopStack.length - 2]];
        const mentions = (side: string, vars: string[]): boolean => vars.some((v) => v && new RegExp(`(^|[^\\w$])${escapeRegExp(v.replace(/^[&*]/, ''))}([^\\w$]|$)`).test(side));
        if (!inner.variables.length || !outer.variables.length) {
            return;
        }
        const leftOuter = mentions(left, outer.variables);
        const leftInner = mentions(left, inner.variables);
        const rightOuter = mentions(right, outer.variables);
        const rightInner = mentions(right, inner.variables);
        if ((leftOuter && rightInner && !leftInner && !rightOuter) || (leftInner && rightOuter && !leftOuter && !rightInner)) {
            this.pairSearches.push({ line: condition.startPosition.row, outerLoop: outer.index, innerLoop: inner.index });
        }
    }

    private isEmptyHandler(node: Node): boolean {
        const spec = this.spec;
        const body = field(node, 'body') ?? node.namedChildren.find((c) => /block|compound_statement|statement_block|body/.test(c.type)) ?? null;
        if (!body) {
            return false;
        }
        const statements = body.namedChildren.filter((c) => !spec.commentNodes.has(c.type));
        if (statements.length === 0) {
            return true;
        }
        return statements.every((s) => s.type === 'pass_statement' || (s.type === 'expression_statement' && s.text.trim() === '...'));
    }

    private findValidationChain(body: Node): FunctionFacts['validationChain'] {
        const spec = this.spec;
        let count = 0;
        let first: Node | null = null;
        let last: Node | null = null;
        const statements = (body.type === 'block' || body.type === 'compound_statement' || body.type === 'statement_block' || body.type === 'body_statement' || body.type === 'constructor_body')
            ? body.namedChildren
            : body.namedChildren.find((c) => /block|statement_list|body/.test(c.type))?.namedChildren ?? body.namedChildren;
        const flat: Node[] = [];
        for (const s of statements) {
            if (s.type === 'statement_list') {
                flat.push(...s.namedChildren);
            } else {
                flat.push(s);
            }
        }
        for (const s of flat) {
            if (spec.commentNodes.has(s.type)) {
                continue;
            }
            if (count === 0 && s.type === 'expression_statement' && s.namedChildCount === 1 && spec.stringLiteralNodes.has(s.namedChild(0)?.type ?? '')) {
                continue; // docstring
            }
            if (!spec.ifNodes.has(s.type) || s.childrenForFieldName('alternative').length > 0) {
                break;
            }
            const consequence = field(s, 'consequence') ?? field(s, 'body');
            const inner = consequence ? consequence.namedChildren.filter((c) => !spec.commentNodes.has(c.type)) : [];
            const single = inner.length === 1 ? inner[0] : consequence && inner.length === 0 && !/block|statement/.test(consequence.type) ? consequence : null;
            if (!single || !this.isGuardExit(single)) {
                break;
            }
            count += 1;
            first = first ?? s;
            last = s;
        }
        if (count >= 3 && first && last) {
            return { count, line: first.startPosition.row, endLine: last.endPosition.row };
        }
        return null;
    }

    private isGuardExit(stmt: Node): boolean {
        const spec = this.spec;
        if (spec.throwNodes.has(stmt.type) || spec.returnNodes.has(stmt.type)) {
            return true;
        }
        if (stmt.type === 'expression_statement' && stmt.namedChildCount === 1) {
            return this.isGuardExit(stmt.namedChild(0) as Node);
        }
        if (spec.callNodes.has(stmt.type)) {
            const callee = spec.getCallee(stmt);
            return !!callee && /^(raise|panic|panic!|fail|abort|exit|die|throw)$/.test(callee.name);
        }
        return false;
    }
}

export { EXPONENTIAL };
