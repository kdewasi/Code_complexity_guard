/**
 * Pattern detectors that turn facts into concrete, language-aware suggestions.
 * Every suggestion says what is wrong in plain words, why it matters, what to
 * do instead, and (where it helps) shows a before/after snippet.
 */
import { notation, Term } from './bigo';
import { FunctionFacts } from './facts';
import { LanguageSpec } from './languages/spec';
import { RecursionInfo, Suggestion, Thresholds } from './types';

interface Context {
    spec: LanguageSpec;
    facts: FunctionFacts;
    recursion: RecursionInfo;
    time: Term;
    thresholds: Thresholds;
    source: string[];
}

function loopLabel(ctx: Context, loopIndex: number): string {
    const l = ctx.facts.loops[loopIndex];
    return l ? `the loop on line ${l.line + 1}` : 'a loop';
}

function outermost(ctx: Context, loops: number[]): string {
    if (loops.length === 0) {
        return 'a loop';
    }
    return loopLabel(ctx, loops[0]);
}

function impactFor(factor: Term, cost: Term): string {
    const before = notation({ n: factor.n + cost.n, log: factor.log + cost.log, sqrt: factor.sqrt + cost.sqrt, exp: false });
    const after = notation({ n: factor.n + Math.max(0, cost.n - 1), log: factor.log, sqrt: factor.sqrt, exp: false });
    return `${before} → ${after}`;
}

export function buildSuggestions(ctx: Context): Suggestion[] {
    const out: Suggestion[] = [];
    const { facts, spec, recursion } = ctx;
    const snippets = spec.snippets;

    // 1. Exponential recursion.
    if (recursion.isRecursive && recursion.callSites >= 2 && !recursion.memoized && (recursion.reduction === 'linear' || recursion.reduction === 'unknown')) {
        out.push({
            id: 'exponential-recursion',
            title: 'Recursion recomputes the same sub-problems',
            severity: 'critical',
            category: 'performance',
            line: recursion.lines[0],
            endLine: recursion.lines[recursion.lines.length - 1],
            problem: `\`${facts.name}\` calls itself ${recursion.callSites} times per invocation, and each call only shrinks the input by a constant. The same inputs are solved again and again, so the run time roughly doubles with every extra element.`,
            fix: 'Remember results you have already computed (memoization), or rewrite the recursion as a loop that builds the answer bottom-up (dynamic programming).',
            impact: 'O(2ⁿ) → O(n)',
            before: snippets.memoization.before,
            after: snippets.memoization.after,
        });
    }

    // 2. Pair search in nested loops.
    for (const p of facts.pairSearches) {
        out.push({
            id: 'pair-search',
            title: 'Nested loops match elements by equality',
            severity: 'warning',
            category: 'performance',
            line: facts.loops[p.outerLoop].line,
            endLine: facts.loops[p.outerLoop].endLine,
            problem: `${loopLabel(ctx, p.innerLoop)} runs inside ${loopLabel(ctx, p.outerLoop)} just to find elements with a matching key (line ${p.line + 1}). Every element of one collection is compared against every element of the other.`,
            fix: 'Put one collection into a hash map (or set) keyed by the value you compare, then look each element up directly.',
            impact: 'O(n²) → O(n)',
            before: snippets.pairLookup.before,
            after: snippets.pairLookup.after,
        });
        break; // one is enough per function
    }

    // 3. Membership / linear search inside a loop.
    for (const m of facts.membershipScans.slice(0, 2)) {
        const container = m.detail.length > 30 ? m.detail.slice(0, 29) + '…' : m.detail;
        out.push({
            id: 'linear-search-in-loop',
            title: 'Linear search inside a loop',
            severity: 'warning',
            category: 'performance',
            line: m.line,
            endLine: m.endLine,
            problem: `Line ${m.line + 1} searches \`${container}\` element by element, and that search runs on every pass of ${outermost(ctx, m.enclosingLoops)}. If \`${container}\` is a list or array, this multiplies the work.`,
            fix: `Build a hash-based set or map from \`${container}\` once, before the loop, and check membership against that. If it is already a set or map, you can ignore this.`,
            impact: impactFor(m.factor, { n: 1, log: 0, sqrt: 0, exp: false }),
            before: snippets.membershipSet.before,
            after: snippets.membershipSet.after,
        });
    }

    // 4. String concatenation inside a loop.
    if (facts.stringConcats.length > 0 && snippets.stringBuilder) {
        const s = facts.stringConcats[0];
        out.push({
            id: 'string-concat-in-loop',
            title: 'String built by repeated concatenation',
            severity: 'warning',
            category: 'performance',
            line: s.line,
            endLine: s.endLine,
            problem: `\`${s.detail}\` is extended on every pass of ${outermost(ctx, s.enclosingLoops)}. Strings are immutable here, so each \`+=\` copies everything built so far.`,
            fix: 'Collect the pieces and join them once, or use a dedicated builder type.',
            impact: 'O(n²) → O(n)',
            before: snippets.stringBuilder.before,
            after: snippets.stringBuilder.after,
        });
    }

    // 5. Sorting inside a loop.
    if (facts.sortsInLoops.length > 0) {
        const s = facts.sortsInLoops[0];
        out.push({
            id: 'sort-in-loop',
            title: 'Sorting inside a loop',
            severity: 'warning',
            category: 'performance',
            line: s.line,
            endLine: s.endLine,
            problem: `\`${s.detail}\` runs on every pass of ${outermost(ctx, s.enclosingLoops)}. Sorting costs about n log n each time.`,
            fix: 'If the data does not change inside the loop, sort it once before the loop. If it does change, consider a structure that stays ordered (heap, balanced tree) instead of re-sorting.',
            impact: impactFor(s.factor, { n: 1, log: 1, sqrt: 0, exp: false }),
            before: snippets.hoistSort.before,
            after: snippets.hoistSort.after,
        });
    }

    // 6. Removing / inserting at the front of an array inside a loop.
    if (facts.frontMutations.length > 0 && snippets.frontRemoval) {
        const f = facts.frontMutations[0];
        out.push({
            id: 'front-mutation-in-loop',
            title: 'Array front removal/insertion inside a loop',
            severity: 'warning',
            category: 'performance',
            line: f.line,
            endLine: f.endLine,
            problem: `\`${f.detail}\` shifts every remaining element each time it runs, and it runs on every pass of ${outermost(ctx, f.enclosingLoops)}.`,
            fix: 'Use a queue/deque type with O(1) operations at both ends, or keep an index that moves forward instead of removing elements.',
            impact: impactFor(f.factor, { n: 1, log: 0, sqrt: 0, exp: false }),
            before: snippets.frontRemoval.before,
            after: snippets.frontRemoval.after,
        });
    }

    // 7. Copying a collection inside a loop.
    if (facts.copiesInLoops.length > 0) {
        const c = facts.copiesInLoops[0];
        out.push({
            id: 'copy-in-loop',
            title: 'Collection copied inside a loop',
            severity: 'info',
            category: 'performance',
            line: c.line,
            endLine: c.endLine,
            problem: `\`${c.detail}\` makes a full copy on every pass of ${outermost(ctx, c.enclosingLoops)}.`,
            fix: 'If the copy is only read, move it out of the loop. If you need a fresh copy per iteration, consider working with indices or views instead.',
            impact: impactFor(c.factor, { n: 1, log: 0, sqrt: 0, exp: false }),
        });
    }

    // 7b. Linear call evaluated in the loop condition on every iteration.
    if (facts.linearCallsInCondition.length > 0) {
        const c = facts.linearCallsInCondition[0];
        out.push({
            id: 'linear-call-in-condition',
            title: 'Loop condition re-computes a linear call every iteration',
            severity: 'warning',
            category: 'performance',
            line: c.line,
            endLine: c.endLine,
            problem: `\`${c.detail}\` walks its whole input, and the loop condition evaluates it before every single iteration.`,
            fix: 'Compute the value once into a local variable before the loop and compare against that.',
            impact: impactFor(c.factor, { n: 1, log: 0, sqrt: 0, exp: false }),
        });
    }

    // 8. Regex compiled inside a loop.
    if (facts.regexInLoops.length > 0) {
        const r = facts.regexInLoops[0];
        out.push({
            id: 'regex-in-loop',
            title: 'Regular expression compiled inside a loop',
            severity: 'info',
            category: 'performance',
            line: r.line,
            endLine: r.endLine,
            problem: `\`${r.detail}\` is compiled again on every pass of ${outermost(ctx, r.enclosingLoops)}.`,
            fix: 'Compile the pattern once outside the loop (or at module level) and reuse it.',
        });
    }

    // 9. Three or more nested loops.
    const deepest = facts.loops.reduce((m, l) => Math.max(m, l.depth), -1);
    if (deepest >= 2 && !ctx.time.exp) {
        const l = facts.loops.find((x) => x.depth === deepest)!;
        out.push({
            id: 'deep-loop-nesting',
            title: `${deepest + 1} levels of nested loops`,
            severity: ctx.time.n >= 3 ? 'warning' : 'info',
            category: 'performance',
            line: l.line,
            endLine: l.endLine,
            problem: `Line ${l.line + 1} is ${deepest + 1} loops deep. Work grows with ${notation(ctx.time)}: doubling the input makes this about ${Math.pow(2, Math.max(2, ctx.time.n))}× slower.`,
            fix: 'Look for a loop whose job is "find something" and replace it with a hash lookup, a prefix sum, two pointers over sorted data, or dynamic programming over the innermost dimension.',
        });
    }

    // 10. Long if / else-if chain on one variable.
    for (const chain of facts.ifChains) {
        if (chain.branches >= 4) {
            out.push({
                id: 'long-if-chain',
                title: `${chain.branches}-branch if/else chain`,
                severity: 'info',
                category: 'readability',
                line: chain.line,
                endLine: chain.endLine,
                problem: chain.variable
                    ? `Lines ${chain.line + 1}–${chain.endLine + 1} compare \`${chain.variable}\` against ${chain.branches} values in a row. Adding a case means editing the chain, and every call walks the branches in order.`
                    : `Lines ${chain.line + 1}–${chain.endLine + 1} form a ${chain.branches}-branch chain of conditions, which is hard to scan and to test.`,
                fix: chain.variable
                    ? 'Map each value to its handler in a dictionary/map (or use a switch/match), so the lookup is one line and new cases are data, not control flow.'
                    : 'Extract each condition into a well-named helper, or reorder so the most common case exits early.',
                before: chain.variable ? snippets.dispatchTable.before : undefined,
                after: chain.variable ? snippets.dispatchTable.after : undefined,
            });
            break;
        }
    }

    // 11. Deep nesting.
    if (facts.maxNesting >= 4) {
        const deepPoint = facts.decisionPoints.reduce((best, d) => (d.nesting > (best?.nesting ?? -1) ? d : best), undefined as typeof facts.decisionPoints[number] | undefined);
        out.push({
            id: 'deep-nesting',
            title: `Code nested ${facts.maxNesting} levels deep`,
            severity: facts.maxNesting >= 6 ? 'warning' : 'info',
            category: 'readability',
            line: deepPoint ? deepPoint.line : facts.startLine,
            endLine: deepPoint ? deepPoint.line : facts.startLine,
            problem: `A reader has to keep ${facts.maxNesting} conditions in their head to understand the innermost line. Deep nesting is the main driver of the cognitive complexity score.`,
            fix: 'Flip conditions into early returns ("guard clauses"), extract the inner block into a helper function, or merge conditions with && / ||.',
            before: snippets.guardClauses.before,
            after: snippets.guardClauses.after,
        });
    }

    // 12. Validation chain.
    if (facts.validationChain) {
        const v = facts.validationChain;
        out.push({
            id: 'validation-chain',
            title: `${v.count} guard checks at the top of the function`,
            severity: 'info',
            category: 'structure',
            line: v.line,
            endLine: v.endLine,
            problem: `The first ${v.count} statements only validate inputs. They add ${v.count} to the complexity of a function whose real job starts afterwards.`,
            fix: `Move them into a small \`validate_${facts.name.split(/::|\./).pop()}\` helper (or a validation object) so the main function reads as its happy path.`,
        });
    }

    // 13. Complex boolean condition.
    if (facts.complexConditions.length > 0) {
        const c = facts.complexConditions.sort((a, b) => b.operators - a.operators)[0];
        out.push({
            id: 'complex-condition',
            title: `Condition with ${c.operators} boolean operators`,
            severity: 'info',
            category: 'readability',
            line: c.line,
            endLine: c.line,
            problem: `The condition on line ${c.line + 1} combines ${c.operators + 1} tests. Mixed && / || chains are a common source of logic bugs.`,
            fix: 'Give each sub-condition a name (`is_admin`, `can_edit`) in a local variable or helper, then combine the names.',
        });
    }

    // 14. Too many parameters.
    if (facts.parameterCount >= 6) {
        out.push({
            id: 'too-many-parameters',
            title: `${facts.parameterCount} parameters`,
            severity: facts.parameterCount >= 8 ? 'warning' : 'info',
            category: 'structure',
            line: facts.startLine,
            endLine: facts.startLine,
            problem: `Callers have to pass ${facts.parameterCount} arguments in the right order; that is error-prone and hints that some of them belong together.`,
            fix: 'Group related parameters into an object / struct / dataclass, or split the function.',
        });
    }

    // 15. Long function.
    if (facts.lineCount > 60) {
        out.push({
            id: 'long-function',
            title: `${facts.lineCount} lines long`,
            severity: facts.lineCount > 120 ? 'warning' : 'info',
            category: 'structure',
            line: facts.startLine,
            endLine: facts.startLine,
            problem: `A function this long rarely does one thing. It is harder to name, test and reuse.`,
            fix: 'Look for blocks preceded by a comment ("// parse", "// validate") and extract each into a helper with that name.',
        });
    }

    // 16. Empty exception handler.
    for (const e of facts.emptyCatches.slice(0, 1)) {
        out.push({
            id: 'empty-catch',
            title: 'Exception swallowed silently',
            severity: 'info',
            category: 'structure',
            line: e.line,
            endLine: e.line,
            problem: `The handler on line ${e.line + 1} catches an error and does nothing, so failures disappear without a trace.`,
            fix: 'Log the error, re-raise it, or narrow the handler to the one exception type you really expect and leave a comment saying why ignoring it is safe.',
        });
    }

    // 17. High cyclomatic complexity with no other explanation.
    if (facts.cyclomatic > ctx.thresholds.cyclomaticCritical && !out.some((s) => s.category !== 'performance')) {
        out.push({
            id: 'high-cyclomatic',
            title: `${facts.cyclomatic} independent paths`,
            severity: 'warning',
            category: 'structure',
            line: facts.startLine,
            endLine: facts.startLine,
            problem: `Testing every path through this function needs at least ${facts.cyclomatic} test cases.`,
            fix: 'Split the function along its decision points: each `if` family or `switch` that handles a separate concern can become its own function.',
        });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity] || a.line - b.line);
    return out;
}
