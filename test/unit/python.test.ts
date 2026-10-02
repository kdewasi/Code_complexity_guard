import * as assert from 'assert';
import { analyze, fn, ids } from './helpers';

describe('Python', () => {
    it('counts cyclomatic complexity like the classic rules', async () => {
        const src = `
def simple():
    return 42

def with_if(x):
    if x > 0:
        return x
    return 0

def branches(x):
    if x > 10:
        return "high"
    elif x > 5:
        return "medium"
    elif x > 0:
        return "low"
    return "zero"

def bool_ops(a, b, c):
    if a and b and c:
        return True
    return False

def mixed(items, threshold=10):
    results = []
    if not items:
        return results
    for item in items:
        try:
            value = int(item)
            if value > threshold and value < 100:
                results.append(value * 2)
            elif value <= threshold or value >= 100:
                results.append(value)
            squares = [x**2 for x in range(value) if x % 2 == 0]
            status = "high" if value > 50 else "low"
        except ValueError:
            continue
        except TypeError:
            break
    while len(results) > 100:
        results.pop()
    return results
`;
        assert.strictEqual((await fn('python', src, 'simple')).cyclomatic, 1);
        assert.strictEqual((await fn('python', src, 'with_if')).cyclomatic, 2);
        assert.strictEqual((await fn('python', src, 'branches')).cyclomatic, 4);
        assert.strictEqual((await fn('python', src, 'bool_ops')).cyclomatic, 4);
        // 1 + if + for + 2 except + (if + and) + (elif + or) + comprehension for + comprehension if + ternary + while = 13
        assert.strictEqual((await fn('python', src, 'mixed')).cyclomatic, 13);
    });

    it('computes cognitive complexity with nesting penalties', async () => {
        const src = `
def process(user, order, cfg):
    if user is not None:
        if user.active:
            if order.status == 'pending':
                if cfg.auto:
                    if order.total < cfg.limit:
                        return approve(order)
    return None

def flat(a, b, c):
    if a:
        return 1
    elif b:
        return 2
    else:
        return 3
`;
        const deep = await fn('python', src, 'process');
        assert.strictEqual(deep.cognitive, 15); // 1+2+3+4+5
        assert.strictEqual(deep.maxNesting, 5);
        assert.ok(ids(deep).includes('deep-nesting'));
        const flat = await fn('python', src, 'flat');
        assert.strictEqual(flat.cognitive, 3); // if + elif + else
        assert.strictEqual(flat.cyclomatic, 3);
    });

    it('estimates Big-O for classic algorithms', async () => {
        const src = `
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == target:
            return mid
        elif a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left = merge_sort(a[:mid])
    right = merge_sort(a[mid:])
    return merge(left, right)

def bubble(a):
    for i in range(len(a)):
        for j in range(len(a) - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]

def log_loop(n):
    i = 1
    while i < n:
        i *= 2
    return i

def sqrt_loop(n):
    i = 2
    while i * i <= n:
        i += 1
    return i

def constant(xs):
    for i in range(10):
        print(xs[i])

def total(xs):
    return sum(xs)

def cube(n):
    c = 0
    for i in range(n):
        for j in range(n):
            for k in range(n):
                c += 1
    return c
`;
        const fib = await fn('python', src, 'fib');
        assert.strictEqual(fib.time.notation, 'O(2ⁿ)');
        assert.strictEqual(fib.space.notation, 'O(n)');
        assert.strictEqual(fib.recursion.reduction, 'linear');
        assert.strictEqual(fib.recursion.callSites, 2);
        assert.strictEqual(fib.rating.grade, 'D');
        assert.ok(ids(fib).includes('exponential-recursion'));

        assert.strictEqual((await fn('python', src, 'binary_search')).time.notation, 'O(log n)');
        const ms = await fn('python', src, 'merge_sort');
        assert.strictEqual(ms.time.notation, 'O(n log n)');
        assert.strictEqual(ms.recursion.reduction, 'halving');
        assert.strictEqual((await fn('python', src, 'bubble')).time.notation, 'O(n²)');
        assert.strictEqual((await fn('python', src, 'log_loop')).time.notation, 'O(log n)');
        assert.strictEqual((await fn('python', src, 'sqrt_loop')).time.notation, 'O(√n)');
        assert.strictEqual((await fn('python', src, 'constant')).time.notation, 'O(1)');
        assert.strictEqual((await fn('python', src, 'total')).time.notation, 'O(n)');
        const cube = await fn('python', src, 'cube');
        assert.strictEqual(cube.time.notation, 'O(n³)');
        assert.ok(ids(cube).includes('deep-loop-nesting'));
    });

    it('recognises memoization and structural recursion', async () => {
        const src = `
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

def fib2(n, memo={}):
    if n < 2:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib2(n - 1, memo) + fib2(n - 2, memo)
    return memo[n]

class Tree:
    def count(self, node):
        if node is None:
            return 0
        return 1 + self.count(node.left) + self.count(node.right)

def walk(node):
    total = 1
    for child in node.children:
        total += walk(child)
    return total
`;
        const a = await fn('python', src, 'fib');
        assert.ok(a.recursion.memoized);
        assert.strictEqual(a.time.notation, 'O(n)');
        const b = await fn('python', src, 'fib2');
        assert.ok(b.recursion.memoized);
        assert.strictEqual(b.time.notation, 'O(n)');
        const c = await fn('python', src, 'Tree.count');
        assert.strictEqual(c.recursion.reduction, 'structural');
        assert.strictEqual(c.time.notation, 'O(n)');
        const d = await fn('python', src, 'walk');
        assert.strictEqual(d.recursion.reduction, 'structural');
        assert.strictEqual(d.time.notation, 'O(n)');
    });

    it('estimates space', async () => {
        const src = `
def grid(n):
    return [[0] * n for _ in range(n)]

def copy_all(xs):
    out = []
    for x in xs:
        out.append(x)
    return out

def in_place(a):
    for i in range(len(a)):
        a[i] = a[i] * 2

def constant_space(xs):
    best = 0
    for x in xs:
        if x > best:
            best = x
    return best
`;
        assert.strictEqual((await fn('python', src, 'grid')).space.notation, 'O(n²)');
        assert.strictEqual((await fn('python', src, 'grid')).time.notation, 'O(n²)');
        assert.strictEqual((await fn('python', src, 'copy_all')).space.notation, 'O(n)');
        assert.strictEqual((await fn('python', src, 'constant_space')).space.notation, 'O(1)');
    });

    it('finds concrete optimisation opportunities', async () => {
        const src = `
def has_dupes(items):
    seen = []
    for x in items:
        if x in seen:
            return True
        seen.append(x)
    return False

def fast_dupes(items):
    seen = set()
    for x in items:
        if x in seen:
            return True
        seen.add(x)
    return False

def join_all(parts):
    s = ""
    for p in parts:
        s += p
    return s

def sort_each(rows, data):
    for r in rows:
        data.sort()
        use(data, r)

def drain(queue):
    while queue:
        item = queue.pop(0)
        handle(item)

def pairs(left, right):
    for a in left:
        for b in right:
            if a.id == b.id:
                merge(a, b)

def kind_of(k):
    if k == 'a':
        return 1
    elif k == 'b':
        return 2
    elif k == 'c':
        return 3
    elif k == 'd':
        return 4
    return 0

def validate(user, email, password):
    if not user:
        raise ValueError("user")
    if not email:
        raise ValueError("email")
    if not password:
        raise ValueError("password")
    return save(user, email, password)

def wide(a, b, c, d, e, f, g):
    return a + b + c + d + e + f + g

def swallow(x):
    try:
        risky(x)
    except Exception:
        pass
`;
        const slow = await fn('python', src, 'has_dupes');
        assert.strictEqual(slow.time.notation, 'O(n²)');
        assert.ok(ids(slow).includes('linear-search-in-loop'));
        const fast = await fn('python', src, 'fast_dupes');
        assert.strictEqual(fast.time.notation, 'O(n)');
        assert.ok(!ids(fast).includes('linear-search-in-loop'));
        const join = await fn('python', src, 'join_all');
        assert.ok(ids(join).includes('string-concat-in-loop'));
        assert.strictEqual(join.time.notation, 'O(n²)');
        assert.ok(ids(await fn('python', src, 'sort_each')).includes('sort-in-loop'));
        assert.ok(ids(await fn('python', src, 'drain')).includes('front-mutation-in-loop'));
        assert.ok(ids(await fn('python', src, 'pairs')).includes('pair-search'));
        assert.ok(ids(await fn('python', src, 'kind_of')).includes('long-if-chain'));
        assert.ok(ids(await fn('python', src, 'validate')).includes('validation-chain'));
        assert.ok(ids(await fn('python', src, 'wide')).includes('too-many-parameters'));
        assert.ok(ids(await fn('python', src, 'swallow')).includes('empty-catch'));
        const snippet = slow.suggestions.find((s) => s.id === 'linear-search-in-loop');
        assert.ok(snippet?.before && snippet.after && snippet.impact === 'O(n²) → O(n)');
    });

    it('propagates costs through same-file calls', async () => {
        const src = `
def helper(xs):
    total = 0
    for x in xs:
        total += x
    return total

def uses_helper(xss):
    for xs in xss:
        print(helper(xs))

def chain(xsss):
    for xss in xsss:
        uses_helper(xss)
`;
        assert.strictEqual((await fn('python', src, 'uses_helper')).time.notation, 'O(n²)');
        assert.strictEqual((await fn('python', src, 'chain')).time.notation, 'O(n³)');
        const u = await fn('python', src, 'uses_helper');
        assert.ok(u.calls.includes('helper'));
        assert.ok(u.time.evidence.some((e) => e.text.includes('helper')));
    });

    it('handles decorators, nesting, match, async and ignore markers', async () => {
        const src = `
import functools

# codecomplexity: ignore
def legacy(a):
    if a:
        return 1
    return 0

class Svc:
    @staticmethod
    def sm(x):
        return x

    async def fetch(self, urls):
        out = []
        for u in urls:
            out.append(await get(u))
        return out

def outer(xs):
    def inner(y):
        if y:
            return y * 2
        return 0
    return [inner(x) for x in xs]

def cmd(c):
    match c:
        case "go":
            return 1
        case "stop":
            return 2
        case _:
            return 0
`;
        const r = await analyze('python', src);
        const names = r.functions.map((f) => f.qualifiedName);
        assert.deepStrictEqual(names, ['legacy', 'Svc.sm', 'Svc.fetch', 'outer', 'inner', 'cmd']);
        assert.ok(r.functions[0].ignored);
        assert.strictEqual(r.functions[1].kind, 'method');
        assert.strictEqual((await fn('python', src, 'outer')).cyclomatic, 2); // comprehension loop only; inner is separate
        assert.strictEqual((await fn('python', src, 'inner')).cyclomatic, 2);
        assert.strictEqual((await fn('python', src, 'cmd')).cyclomatic, 3);
        assert.strictEqual(r.fileRating.grade, 'A');
    });
});
