/**
 * Turns walker facts into final time/space estimates:
 *   - folds recursion into the loop-based estimate using standard recurrences
 *   - resolves calls to other functions in the same file (call graph)
 */
import { EXPONENTIAL, LINEAR, LOG_N, ONE, Term, isConstant, max, multiply, notation, rank } from './bigo';
import { FunctionFacts, RecursionSite, WorstCase } from './facts';
import { Confidence, Evidence, RecursionInfo } from './types';

const LINEAR_REDUCTION = /(^|[^\w])[\w.$]+\s*[-+]\s*\d+\b|\[\s*1\s*:|\[\s*:\s*-\s*1\s*\]|\.slice\(\s*1|\.substring\(\s*1|\.substr\(\s*1|\.tail\b|\.next\b|\.rest\b|\+\+|--|\.pop\(|\.shift\(|\bchars\[1|\[1\.\.\]|&[\w]+\[1\.\.\]|\.drop\(1|\.skip\(1|\bcdr\b|\btail\b|\.Substring\(1/;
const HALVING = /\/\/?\s*2\b|>>\s*1\b|\/\s*2(\.0)?\b|\bmid\w*\b|\bhalf\w*\b|\bmiddle\b|\bpivot\b|len\([^)]*\)\s*\/\/?\s*2|\.length\s*\/\s*2|\.size\(\)\s*\/\s*2|\.len\(\)\s*\/\s*2|\bm\b\s*[-+]\s*1|\blo\b|\bhi\b|\bleft\b.*\bright\b|\blow\b|\bhigh\b/;
const STRUCTURAL = /\.(left|right|children|child|next|parent|kids|nodes|subtrees|successors|neighbors|neighbours|adjacent|adj|first|second)\b|->(left|right|next|children|child)\b|\[\s*child|\bchild\b|\bsubtree\b|\bnode\b/;

export function classifyRecursion(sites: RecursionSite[], memoized: boolean): RecursionInfo {
    if (sites.length === 0) {
        return { isRecursive: false, callSites: 0, reduction: 'none', memoized: false, lines: [] };
    }
    let halving = false;
    let linear = false;
    let structural = sites.some((s) => s.receiverKind === 'member' || s.viaLoopVariable);
    for (const s of sites) {
        const joined = s.argsText.join(', ');
        if (s.viaLoopVariable) {
            continue;
        }
        if (HALVING.test(joined)) {
            halving = true;
        } else if (LINEAR_REDUCTION.test(joined)) {
            linear = true;
        } else if (STRUCTURAL.test(joined)) {
            structural = true;
        }
    }
    let reduction: RecursionInfo['reduction'];
    if (halving) {
        reduction = 'halving';
    } else if (linear) {
        reduction = 'linear';
    } else if (structural) {
        reduction = 'structural';
    } else {
        reduction = 'unknown';
    }
    return {
        isRecursive: true,
        callSites: sites.length,
        reduction,
        memoized,
        lines: [...new Set(sites.map((s) => s.line))].sort((a, b) => a - b),
    };
}

export function foldRecursionIntoTime(facts: FunctionFacts, rec: RecursionInfo): WorstCase {
    const base = facts.time;
    if (!rec.isRecursive) {
        return base;
    }
    const lines = rec.lines.map((l) => l + 1).join(', ');
    const body = base.term;
    const sites = rec.callSites;
    const ev = (text: string): Evidence[] => [{ line: rec.lines[0], text }].concat(base.evidence);
    let term: Term;
    let confidence: Confidence = base.confidence;
    let why: string;

    if (rec.memoized) {
        term = max(LINEAR, multiply(LINEAR, body));
        why = `recursive (${sites} call site${sites === 1 ? '' : 's'}, line${rec.lines.length > 1 ? 's' : ''} ${lines}) but results look memoized, so each input is solved once`;
        confidence = 'medium';
    } else if (sites >= 2 && (rec.reduction === 'linear' || rec.reduction === 'unknown')) {
        term = EXPONENTIAL;
        why = `calls itself ${sites} times per invocation (line${rec.lines.length > 1 ? 's' : ''} ${lines}) and the input only shrinks by a constant each time, so the number of calls doubles with every extra element`;
        confidence = rec.reduction === 'unknown' ? 'low' : 'high';
    } else if (sites >= 2 && rec.reduction === 'halving') {
        if (isConstant(body)) {
            term = LINEAR;
        } else if (body.n === 1 && body.log === 0 && !body.exp) {
            term = { n: 1, log: 1, sqrt: 0, exp: false };
        } else {
            term = body;
        }
        why = `divide and conquer: ${sites} recursive calls on halves of the input (line${rec.lines.length > 1 ? 's' : ''} ${lines})${isConstant(body) ? '' : `, each level doing ${notation(body)} work`}`;
        confidence = 'medium';
    } else if (rec.reduction === 'structural') {
        term = max(LINEAR, body);
        why = `walks a linked structure recursively (line${rec.lines.length > 1 ? 's' : ''} ${lines}); every node is visited once`;
        confidence = 'medium';
    } else if (rec.reduction === 'halving') {
        term = isConstant(body) ? LOG_N : body;
        why = `recursion halves the input each call (line ${lines}), so the depth is about log n`;
        confidence = 'high';
    } else {
        // single call, linear or unknown reduction
        term = multiply(LINEAR, body);
        why = `recursion shrinks the input by a constant each call (line ${lines}), so there are about n calls${isConstant(body) ? '' : `, each doing ${notation(body)} work`}`;
        confidence = rec.reduction === 'unknown' ? 'low' : 'high';
    }
    return { term, evidence: ev(why), confidence };
}

export function foldRecursionIntoSpace(facts: FunctionFacts, rec: RecursionInfo): WorstCase {
    const base = facts.space;
    if (!rec.isRecursive) {
        return base;
    }
    let stack: Term;
    let why: string;
    switch (rec.reduction) {
        case 'halving':
            stack = rec.callSites >= 2 ? LINEAR : LOG_N;
            why = rec.callSites >= 2 ? 'divide-and-conquer recursion keeps up to n items on the stack and in partial results' : 'the call stack grows to about log n frames';
            break;
        case 'structural':
            stack = LINEAR;
            why = 'the call stack grows with the depth of the structure (up to n frames in the worst case)';
            break;
        default:
            stack = LINEAR;
            why = 'the call stack grows one frame per recursive call (up to n frames)';
    }
    if (rec.memoized) {
        why += '; the memo table also holds up to n results';
    }
    if (rank(stack) > rank(base.term)) {
        return { term: stack, evidence: [{ line: rec.lines[0], text: why }], confidence: 'medium' };
    }
    return base;
}

export interface CallGraphEntry {
    name: string;
    facts: FunctionFacts;
    time: WorstCase;
}

/**
 * Propagates the cost of same-file callees into their callers:
 * a loop that calls an O(n) helper is O(n²). Runs to a fixed point
 * (bounded) so chains of helpers resolve too.
 */
export function resolveCallGraph(entries: CallGraphEntry[]): void {
    const byName = new Map<string, CallGraphEntry[]>();
    for (const e of entries) {
        const short = e.name.split(/::|\./).pop() ?? e.name;
        const list = byName.get(short) ?? [];
        list.push(e);
        byName.set(short, list);
    }
    for (let round = 0; round < 4; round++) {
        let changed = false;
        for (const caller of entries) {
            for (const call of caller.facts.calls) {
                if (!call.userCandidate) {
                    continue;
                }
                const targets = byName.get(call.name);
                if (!targets) {
                    continue;
                }
                for (const callee of targets) {
                    if (callee === caller) {
                        continue;
                    }
                    if (isConstant(callee.time.term)) {
                        continue;
                    }
                    const candidate = multiply(call.factor, callee.time.term);
                    if (candidate.n > 6) {
                        continue;
                    }
                    if (rank(candidate) > rank(caller.time.term)) {
                        const loopEv: Evidence[] = call.enclosingLoops.map((i) => {
                            const l = caller.facts.loops[i];
                            return { line: l.line, text: `\`${l.header}\` runs ${describeFactor(l.factor)}: ${l.reason}` };
                        });
                        caller.time = {
                            term: candidate,
                            evidence: loopEv.concat([{ line: call.line, text: `calls \`${call.name}()\`, which is ${notation(callee.time.term)} (defined in this file)` }]),
                            confidence: callee.time.confidence === 'low' || call.enclosingLoops.length === 0 ? 'low' : 'medium',
                        };
                        changed = true;
                    }
                }
            }
        }
        if (!changed) {
            break;
        }
    }
}

function describeFactor(t: Term): string {
    if (isConstant(t)) {
        return 'a fixed number of times';
    }
    if (t.n === 1 && t.log === 0 && t.sqrt === 0) {
        return 'once per element (n times)';
    }
    if (t.n === 0 && t.log === 1) {
        return 'about log n times';
    }
    if (t.n === 0 && t.sqrt === 1) {
        return 'about √n times';
    }
    return `${notation(t).slice(2, -1)} times`;
}

export { ONE };
