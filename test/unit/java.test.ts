import * as assert from 'assert';
import { analyze, fn, ids } from './helpers';

const SRC = `
import java.util.*;

public class Demo {
    private final Map<Integer, Long> memo = new HashMap<>();

    public Demo() {}

    int fib(int n) {
        if (n < 2) return n;
        return fib(n - 1) + fib(n - 2);
    }

    long fibMemo(int n) {
        if (n < 2) return n;
        if (memo.containsKey(n)) return memo.get(n);
        long v = fibMemo(n - 1) + fibMemo(n - 2);
        memo.put(n, v);
        return v;
    }

    boolean hasDupes(List<Integer> items) {
        List<Integer> seen = new ArrayList<>();
        for (int x : items) {
            if (seen.contains(x)) return true;
            seen.add(x);
        }
        return false;
    }

    boolean hasDupesFast(List<Integer> items) {
        Set<Integer> seen = new HashSet<>();
        for (int x : items) {
            if (seen.contains(x)) return true;
            seen.add(x);
        }
        return false;
    }

    String joinAll(String[] parts) {
        String s = "";
        for (String p : parts) {
            s += p;
        }
        return s;
    }

    int[][] grid(int n) {
        int[][] g = new int[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                g[i][j] = i * j;
            }
        }
        return g;
    }

    int logLoop(int n) {
        int c = 0;
        for (int i = 1; i < n; i *= 2) c++;
        return c;
    }

    int binarySearch(int[] a, int t) {
        int lo = 0, hi = a.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] == t) return mid;
            else if (a[mid] < t) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    void sw(int k) {
        switch (k) {
            case 1:
            case 2:
                doA();
                break;
            default:
                doB();
        }
    }

    void sortEach(List<List<Integer>> rows, List<Integer> data) {
        for (List<Integer> r : rows) {
            Collections.sort(data);
        }
    }

    void loops(int[][] grid) {
        outer:
        for (int[] row : grid) {
            for (int v : row) {
                if (v > 0 && v < 10 || v == 42) {
                    continue outer;
                }
            }
        }
    }

    void streams(List<Integer> xs) {
        xs.stream().map(x -> x * 2).filter(x -> x > 3 && x < 10).forEach(System.out::println);
    }

    void kind(String k) {
        if (k.equals("a")) { a(); } else if (k.equals("b")) { b(); } else if (k.equals("c")) { c(); } else if (k.equals("d")) { d(); } else { e(); }
    }
}
`;

describe('Java', () => {
    it('finds methods and constructors with qualified names', async () => {
        const r = await analyze('java', SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        assert.ok(names.includes('Demo.Demo'));
        assert.ok(names.includes('Demo.fib'));
        assert.strictEqual(r.functions.find((f) => f.name === 'Demo')?.kind, 'constructor');
        assert.strictEqual(r.functions.find((f) => f.name === 'fib')?.kind, 'method');
        assert.strictEqual(r.parseErrors, 0);
    });

    it('computes complexity metrics', async () => {
        const sw = await fn('java', SRC, 'sw');
        assert.strictEqual(sw.cyclomatic, 3); // two case labels
        assert.strictEqual(sw.cognitive, 1); // one switch
        const loops = await fn('java', SRC, 'loops');
        assert.strictEqual(loops.cyclomatic, 6); // 2 loops + if + && + ||
        // for(1) + for(2) + if(3) + boolean sequences(2) + labelled continue(1) = 9
        assert.strictEqual(loops.cognitive, 9);
        const bs = await fn('java', SRC, 'binarySearch');
        assert.strictEqual(bs.cyclomatic, 4);
        assert.strictEqual(bs.time.notation, 'O(log n)');
        const kind = await fn('java', SRC, 'kind');
        assert.strictEqual(kind.cyclomatic, 5);
        assert.strictEqual(kind.cognitive, 5);
        assert.ok(ids(kind).includes('long-if-chain'));
    });

    it('estimates Big-O and suggestions', async () => {
        const fib = await fn('java', SRC, 'fib');
        assert.strictEqual(fib.time.notation, 'O(2ⁿ)');
        assert.strictEqual(fib.rating.grade, 'D');
        const memo = await fn('java', SRC, 'fibMemo');
        assert.ok(memo.recursion.memoized);
        assert.strictEqual(memo.time.notation, 'O(n)');
        const dupes = await fn('java', SRC, 'hasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        const fast = await fn('java', SRC, 'hasDupesFast');
        assert.strictEqual(fast.time.notation, 'O(n)');
        assert.ok(!ids(fast).includes('linear-search-in-loop'));
        const join = await fn('java', SRC, 'joinAll');
        assert.ok(ids(join).includes('string-concat-in-loop'));
        const grid = await fn('java', SRC, 'grid');
        assert.strictEqual(grid.time.notation, 'O(n²)');
        assert.strictEqual(grid.space.notation, 'O(n²)');
        assert.strictEqual((await fn('java', SRC, 'logLoop')).time.notation, 'O(log n)');
        const sortEach = await fn('java', SRC, 'sortEach');
        assert.strictEqual(sortEach.time.notation, 'O(n² log n)');
        assert.ok(ids(sortEach).includes('sort-in-loop'));
        const streams = await fn('java', SRC, 'streams');
        assert.strictEqual(streams.time.notation, 'O(n)');
    });
});
