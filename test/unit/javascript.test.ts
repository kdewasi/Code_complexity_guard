import * as assert from 'assert';
import { analyze, fn, ids } from './helpers';

const SRC = `
function fib(n) { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }

const hasDupes = (items) => {
  const seen = [];
  for (const x of items) {
    if (seen.includes(x)) return true;
    seen.push(x);
  }
  return false;
};

function hasDupesFast(items) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x)) return true;
    seen.add(x);
  }
  return false;
}

function shiftAll(queue) {
  while (queue.length) {
    const x = queue.shift();
    use(x);
  }
}

function matrix(n) {
  const m = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(0);
    m.push(row);
  }
  return m;
}

function logLoop(n) { let c = 0; for (let i = 1; i < n; i <<= 1) c++; return c; }

class K {
  constructor() { this.x = 1; }
  count(node) { if (!node) return 0; return 1 + this.count(node.left) + this.count(node.right); }
  static of(v) { return new K(v); }
}

function cb(xs) { return xs.map(x => x * 2).filter(x => x > 1 || x < -1); }

function withBlocks(xs) {
  xs.forEach(x => {
    if (x > 1) {
      console.log(x);
    }
  });
}

function memo(n, cache = new Map()) {
  if (n < 2) return n;
  if (cache.has(n)) return cache.get(n);
  const v = memo(n - 1, cache) + memo(n - 2, cache);
  cache.set(n, v);
  return v;
}

const obj = {
  handler(a) { if (a) return 1; return 0; },
  arrow: (b) => b ? 1 : 0,
};

export default function (q) { return q ?? 0; }

function labels(m) {
  outer: for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m[i].length; j++) {
      if (m[i][j] === 0) continue outer;
    }
  }
}

function sw(k) {
  switch (k) {
    case 1: return 'a';
    case 2: return 'b';
    default: return 'c';
  }
}
`;

describe('JavaScript', () => {
    it('finds declarations, assigned arrows, methods and object literal members', async () => {
        const r = await analyze('javascript', SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        for (const expected of ['fib', 'hasDupes', 'hasDupesFast', 'K.constructor', 'K.count', 'K.of', 'cb', 'handler', 'arrow', 'default', 'labels', 'sw']) {
            assert.ok(names.includes(expected), `missing ${expected} in ${names.join(',')}`);
        }
        assert.strictEqual(r.functions.find((f) => f.name === 'constructor')?.kind, 'constructor');
    });

    it('computes metrics', async () => {
        const sw = await fn('javascript', SRC, 'sw');
        assert.strictEqual(sw.cyclomatic, 3);
        assert.strictEqual(sw.cognitive, 1);
        const labels = await fn('javascript', SRC, 'labels');
        assert.strictEqual(labels.cyclomatic, 4);
        assert.strictEqual(labels.time.notation, 'O(n²)');
        assert.ok(!ids(labels).includes('pair-search'));
        const blocks = await fn('javascript', SRC, 'withBlocks');
        assert.strictEqual(blocks.cyclomatic, 3); // forEach block + if
        assert.strictEqual(blocks.time.notation, 'O(n)');
        const cbf = await fn('javascript', SRC, 'cb');
        assert.strictEqual(cbf.cyclomatic, 2); // the || only
        assert.strictEqual(cbf.time.notation, 'O(n)');
        assert.strictEqual(cbf.space.notation, 'O(n)');
        assert.strictEqual((await fn('javascript', SRC, 'default')).cyclomatic, 2); // ??
    });

    it('estimates Big-O and suggestions', async () => {
        assert.strictEqual((await fn('javascript', SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('javascript', SRC, 'hasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual((await fn('javascript', SRC, 'hasDupesFast')).time.notation, 'O(n)');
        const shift = await fn('javascript', SRC, 'shiftAll');
        assert.strictEqual(shift.time.notation, 'O(n²)');
        assert.ok(ids(shift).includes('front-mutation-in-loop'));
        const matrix = await fn('javascript', SRC, 'matrix');
        assert.strictEqual(matrix.time.notation, 'O(n²)');
        assert.strictEqual(matrix.space.notation, 'O(n²)');
        assert.strictEqual((await fn('javascript', SRC, 'logLoop')).time.notation, 'O(log n)');
        const count = await fn('javascript', SRC, 'K.count');
        assert.strictEqual(count.recursion.reduction, 'structural');
        assert.strictEqual(count.time.notation, 'O(n)');
        const memo = await fn('javascript', SRC, 'memo');
        assert.ok(memo.recursion.memoized);
        assert.strictEqual(memo.time.notation, 'O(n)');
    });
});

describe('TypeScript and TSX', () => {
    it('analyses typed code', async () => {
        const src = `
export function fib(n: number): number { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }
export const hasDupes = (items: number[]): boolean => {
  const seen: number[] = [];
  for (const x of items) { if (seen.includes(x)) return true; seen.push(x); }
  return false;
};
interface I { g(): void }
abstract class Base<T> { abstract run(x: T): T; protected helper(xs: T[]): number { let c = 0; for (const _ of xs) c++; return c; } }
`;
        const r = await analyze('typescript', src);
        assert.deepStrictEqual(r.functions.map((f) => f.qualifiedName), ['fib', 'hasDupes', 'Base.helper']);
        assert.strictEqual(r.functions[0].time.notation, 'O(2ⁿ)');
        assert.strictEqual(r.functions[1].time.notation, 'O(n²)');
        assert.strictEqual(r.functions[2].time.notation, 'O(n)');
    });

    it('parses JSX', async () => {
        const src = `
export function List({ items }: { items: string[] }) {
  return <ul>{items.map((i) => <li key={i}>{i.length > 3 ? i : '-'}</li>)}</ul>;
}
`;
        const r = await analyze('tsx', src);
        assert.strictEqual(r.parseErrors, 0);
        assert.strictEqual(r.functions[0].name, 'List');
        assert.strictEqual(r.functions[0].cyclomatic, 2);
        assert.strictEqual(r.functions[0].time.notation, 'O(n)');
    });
});
