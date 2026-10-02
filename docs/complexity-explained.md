# The numbers, explained

This page explains every number the extension shows and exactly how it is computed, so you can check the reasoning yourself.

## Cyclomatic complexity

*How many independent paths run through the function.* It is the minimum number of test cases needed to cover every branch.

Starts at **1**, then **+1** for each:

- `if`, `elif` / `else if` (a plain `else` adds nothing)
- `for`, `while`, `do`, `foreach`, comprehension clauses, Ruby iterator blocks and callback blocks with statement bodies (`forEach(x => { … })`)
- `case` / `when` / match arm (not `default` / `_`)
- `catch` / `except` / `rescue`
- `?:` and other conditional expressions
- each `&&`, `||`, `and`, `or`, `??`

| Range | Reading |
|---|---|
| 1–8 | easy to test |
| 9–15 | getting hard to test; consider splitting |
| 16+ | hard to test and to change safely |

## Cognitive complexity

*How hard the function is for a person to follow.* Defined by SonarSource; the rules the extension applies:

- **+1** for each `if`, `else if`, `else`, `?:`, `switch`, loop, `catch`, `goto`/labelled jump, and recursive call
- **+ nesting level** on top of that for `if`, `?:`, `switch`, loops and `catch` (not for `else`/`else if`)
- **+1 per run** of the same boolean operator: `a && b && c` costs 1, `a && b || c` costs 2
- nesting level increases inside branches, loops, `catch` blocks and lambdas

Example:

```python
def process(user, order, cfg):      # cognitive 15, cyclomatic 6
    if user is not None:            # +1
        if user.active:             # +2 (nested once)
            if order.pending:       # +3
                if cfg.auto:        # +4
                    if order.ok:    # +5
                        return 1
```

| Range | Reading |
|---|---|
| 0–15 | reads easily |
| 16–25 | dense |
| 26+ | split it up |

## Estimated time (Big-O)

*How the run time grows when the input grows.* The analyser builds the estimate from the structure of the code:

**Loops.** Each loop contributes a factor, and nested loops multiply:

| Loop shape | Factor |
|---|---|
| `for x in items`, `for (… ; i < n; i++)`, `foreach`, `range`, `.each`, `.map(cb)` | n |
| loop variable multiplied/divided/shifted each step (`i *= 2`, `n //= 2`, `i >>= 1`) | log n |
| binary search (`mid = (lo + hi) / 2` and `lo = mid + 1` / `hi = mid - 1`) | log n |
| `while (i * i <= n)` | √n |
| `for i in range(10)`, `for (i = 0; i < 100; i++)`, iterating a literal list | 1 |
| `while True`, `for (;;)`, `loop {}` | n (low confidence) |

**Calls with known cost** multiply with the loops around them: `sort` is n log n; `x in list`, `.contains`, `.includes`, `.indexOf`, `in_array`, `std::find` are n; copies (`list(x)`, `[...x]`, `.clone()`, `.ToList()`), slices with one bound, `strlen`, `sum`, `join` are n; `queue.pop(0)`, `array.shift()`, `list.remove(0)` are n. Membership on a known set/map/dict is constant.

**Recursion.** The number of self-calls and how the argument shrinks decide the recurrence:

| Shape | Result |
|---|---|
| 2+ self-calls, input shrinks by a constant (`fib(n-1) + fib(n-2)`), no memo | 2ⁿ |
| same, but memoized (`@lru_cache`, `memo[n]`, `cache.has(n)` …) | n × work per call |
| 2+ self-calls on halves (`merge_sort(a[:mid])`) | n (constant work per level) or n log n (linear work per level) |
| 1 self-call, halving (`search(lo, mid)`) | log n |
| 1 self-call, shrinks by a constant | n × work per call |
| calls on `node.left` / `node.right` / children / loop variables (tree walks) | n (every node once) |

**Same-file calls.** If `f` calls `g` inside a loop and `g` is O(n) in the same file, `f` is O(n²). The chain is followed through several levels.

**Confidence.** *high* when loops have explicit bounds and known updates; *medium* when library costs or recurrences are involved; *low* when a loop's bound could not be determined or the recursion shape is unclear.

| Growth | What it means in practice |
|---|---|
| O(1), O(log n) | scales to anything |
| O(n), O(n log n) | fine for millions of items |
| O(n²) | fine for thousands, slow beyond ~100k |
| O(n³) | only for small inputs |
| O(2ⁿ) | only for tiny inputs (dozens) |

## Estimated extra memory (Big-O)

Counts memory that grows with the input, beyond the input itself:

- a collection that gets one entry per loop iteration (`out.append(x)`, `list.add(x)`, `xs = append(xs, x)`, `$a[] = x`, `xs << x`, `m[k] = v`) → n per loop level
- comprehensions, `map`/`filter`/`collect` results, copies, slices, `sorted()` → n
- allocations sized by the input (`[0] * n`, `new int[n][n]`, `make([]T, n)`, `vec![0; n]`) → n or n²
- recursion depth: one stack frame per pending call → n for linear recursion, log n for halving

In-place updates of an array that was passed in do not count.

## Grades

| Grade | Rules |
|---|---|
| 🟢 **A** Excellent | cyclomatic ≤ half the warning limit, cognitive ≤ half its limit, time ≤ n log n, nothing flagged |
| 🔵 **B** Good | under all thresholds; may be quadratic, 4–5 levels deep, 60–120 lines or have info-level suggestions |
| 🟡 **C** Needs attention | above a warning threshold, cubic time, 6+ levels deep, 120+ lines, 8+ parameters, or a warning-level suggestion |
| 🔴 **D** Poor | above a critical threshold, exponential or quartic time, or a critical suggestion |

The file grade is **D** if any function is D, **C** if several functions are C, **B** if a few are, **A** otherwise.

## What is *not* measured

Cyclomatic and cognitive complexity say nothing about naming, comments, duplication or coupling, and Big-O says nothing about constant factors or cache behaviour. Use the numbers as a guide to where to look, not as a verdict on quality.
