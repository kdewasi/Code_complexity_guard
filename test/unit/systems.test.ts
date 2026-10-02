import * as assert from 'assert';
import { analyze, fn, ids } from './helpers';

describe('Go', () => {
    const SRC = `
package main

import "sort"

type Stack struct{ items []int }

func (s *Stack) Push(v int) { s.items = append(s.items, v) }

func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}

func hasDupes(items []int) bool {
    seen := []int{}
    for _, x := range items {
        for _, s := range seen {
            if s == x {
                return true
            }
        }
        seen = append(seen, x)
    }
    return false
}

func hasDupesFast(items []int) bool {
    seen := map[int]bool{}
    for _, x := range items {
        if seen[x] {
            return true
        }
        seen[x] = true
    }
    return false
}

func join(parts []string) string {
    s := ""
    for _, p := range parts {
        s += p
    }
    return s
}

func logLoop(n int) int {
    c := 0
    for i := 1; i < n; i *= 2 {
        c++
    }
    return c
}

func sw(x int) int {
    switch x {
    case 1:
        return 1
    case 2, 3:
        return 2
    default:
        return 0
    }
}

func walk(n *Node) int {
    total := 1
    for _, c := range n.Children {
        total += walk(c)
    }
    return total
}

func sortEach(rows [][]int) {
    for _, r := range rows {
        sort.Ints(r)
    }
}
`;
    it('analyses functions and methods', async () => {
        const r = await analyze('go', SRC);
        assert.ok(r.functions.map((f) => f.qualifiedName).includes('Push'));
        assert.strictEqual(r.functions.find((f) => f.name === 'Push')?.kind, 'method');
        assert.strictEqual((await fn('go', SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('go', SRC, 'hasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('pair-search'));
        assert.strictEqual((await fn('go', SRC, 'hasDupesFast')).time.notation, 'O(n)');
        assert.strictEqual((await fn('go', SRC, 'hasDupesFast')).space.notation, 'O(n)');
        assert.ok(ids(await fn('go', SRC, 'join')).includes('string-concat-in-loop'));
        assert.strictEqual((await fn('go', SRC, 'logLoop')).time.notation, 'O(log n)');
        const sw = await fn('go', SRC, 'sw');
        assert.strictEqual(sw.cyclomatic, 3);
        const walk = await fn('go', SRC, 'walk');
        assert.strictEqual(walk.recursion.reduction, 'structural');
        assert.strictEqual(walk.time.notation, 'O(n)');
        const se = await fn('go', SRC, 'sortEach');
        assert.strictEqual(se.time.notation, 'O(n² log n)');
        assert.ok(ids(se).includes('sort-in-loop'));
    });
});

describe('Rust', () => {
    const SRC = `
use std::collections::HashSet;

fn fib(n: u64) -> u64 { if n < 2 { return n; } fib(n - 1) + fib(n - 2) }

fn has_dupes(items: &[i32]) -> bool {
    let mut seen: Vec<i32> = Vec::new();
    for x in items {
        if seen.contains(x) { return true; }
        seen.push(*x);
    }
    false
}

fn has_dupes_fast(items: &[i32]) -> bool {
    let mut seen = HashSet::new();
    for x in items {
        if seen.contains(x) { return true; }
        seen.insert(*x);
    }
    false
}

fn log_loop(mut n: u64) -> u32 { let mut c = 0; while n > 1 { n /= 2; c += 1; } c }

fn m(x: i32) -> i32 { match x { 1 => 1, 2 | 3 => 2, _ => 0 } }

fn iter(v: &Vec<i32>) -> Vec<i32> { v.iter().map(|x| x * 2).filter(|x| *x > 1 && *x < 9).collect() }

impl Tree {
    fn size(&self) -> usize { match &self.root { None => 0, Some(n) => Self::count(n) } }
    fn count(n: &Node) -> usize { 1 + n.children.iter().map(|c| Self::count(c)).sum::<usize>() }
}

fn w(mut v: Vec<i32>) { while let Some(top) = v.pop() { if top > 0 { } } }
`;
    it('analyses items, impl methods, match and closures', async () => {
        const r = await analyze('rust', SRC);
        assert.ok(r.functions.map((f) => f.qualifiedName).includes('Tree.size'));
        assert.strictEqual((await fn('rust', SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('rust', SRC, 'has_dupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual((await fn('rust', SRC, 'has_dupes_fast')).time.notation, 'O(n)');
        assert.strictEqual((await fn('rust', SRC, 'log_loop')).time.notation, 'O(log n)');
        assert.strictEqual((await fn('rust', SRC, 'm')).cyclomatic, 3);
        const it = await fn('rust', SRC, 'iter');
        assert.strictEqual(it.cyclomatic, 2);
        assert.strictEqual(it.time.notation, 'O(n)');
        assert.strictEqual((await fn('rust', SRC, 'Tree.count')).time.notation, 'O(n)');
        assert.strictEqual((await fn('rust', SRC, 'Tree.size')).time.notation, 'O(n)');
        const w = await fn('rust', SRC, 'w');
        assert.strictEqual(w.cyclomatic, 3);
        assert.strictEqual(w.time.notation, 'O(n)');
    });
});

describe('C and C++', () => {
    const C_SRC = `
#include <string.h>

int fib(int n) { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }

int count_a(const char *s) {
    int c = 0;
    for (int i = 0; i < strlen(s); i++) {
        if (s[i] == 'a') c++;
    }
    return c;
}

void bubble(int *a, int n) {
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n - i - 1; j++)
            if (a[j] > a[j + 1]) { int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; }
}

int sw(int x) { switch (x) { case 1: return 1; case 2: return 2; default: return 0; } }

static void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

int (*get_handler(int k))(int) { if (k) return h1; return h2; }

void loop(int n) { int i = 0; do { i++; } while (i < n); }

int find(int *a, int n, int t) {
    for (int i = 0; i < n; i++) {
        if (a[i] == t) goto done;
    }
    return -1;
done:
    return 1;
}
`;
    it('analyses C', async () => {
        const r = await analyze('c', C_SRC);
        const names = r.functions.map((f) => f.name);
        assert.deepStrictEqual(names, ['fib', 'count_a', 'bubble', 'sw', 'swap', 'get_handler', 'loop', 'find']);
        assert.strictEqual((await fn('c', C_SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const ca = await fn('c', C_SRC, 'count_a');
        assert.strictEqual(ca.time.notation, 'O(n²)');
        assert.ok(ids(ca).includes('linear-call-in-condition'));
        const bubble = await fn('c', C_SRC, 'bubble');
        assert.strictEqual(bubble.time.notation, 'O(n²)');
        assert.strictEqual(bubble.space.notation, 'O(1)');
        assert.strictEqual((await fn('c', C_SRC, 'sw')).cyclomatic, 3);
        assert.strictEqual((await fn('c', C_SRC, 'swap')).parameterCount, 2);
        assert.strictEqual((await fn('c', C_SRC, 'loop')).time.notation, 'O(n)');
        const find = await fn('c', C_SRC, 'find');
        assert.strictEqual(find.cognitive, 1 + 2 + 1); // for + if (nested) + goto
    });

    const CPP_SRC = `
#include <vector>
#include <algorithm>
#include <unordered_set>

namespace ns {

int fib(int n) { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }

bool hasDupes(const std::vector<int>& items) {
    std::vector<int> seen;
    for (int x : items) {
        if (std::find(seen.begin(), seen.end(), x) != seen.end()) return true;
        seen.push_back(x);
    }
    return false;
}

bool hasDupesFast(const std::vector<int>& items) {
    std::unordered_set<int> seen;
    for (int x : items) {
        if (seen.count(x)) return true;
        seen.insert(x);
    }
    return false;
}

class K {
public:
    K() {}
    ~K() {}
    int count(Node* node) { if (!node) return 0; return 1 + count(node->left) + count(node->right); }
    bool operator<(const K& o) const { return a < o.a; }
};

int K::g(int z) { return z ? 1 : 2; }

void sortEach(std::vector<std::vector<int>>& rows) { for (auto& r : rows) { std::sort(r.begin(), r.end()); } }

template <typename T>
T maxOf(const std::vector<T>& v) {
    T best = v[0];
    for (const auto& x : v) { if (x > best) best = x; }
    return best;
}
}
`;
    it('analyses C++', async () => {
        const r = await analyze('cpp', CPP_SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        for (const e of ['ns.fib', 'ns.hasDupes', 'K.K', 'K.~K', 'K.count', 'K.operator<', 'K::g', 'ns.sortEach', 'ns.maxOf']) {
            assert.ok(names.includes(e), `missing ${e} in ${names.join(',')}`);
        }
        assert.strictEqual((await fn('cpp', CPP_SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('cpp', CPP_SRC, 'hasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual((await fn('cpp', CPP_SRC, 'hasDupesFast')).time.notation, 'O(n)');
        const count = await fn('cpp', CPP_SRC, 'K.count');
        assert.strictEqual(count.recursion.reduction, 'structural');
        assert.strictEqual(count.time.notation, 'O(n)');
        assert.strictEqual((await fn('cpp', CPP_SRC, 'ns.sortEach')).time.notation, 'O(n² log n)');
        assert.strictEqual((await fn('cpp', CPP_SRC, 'K::g')).cyclomatic, 2);
        assert.strictEqual((await fn('cpp', CPP_SRC, 'ns.maxOf')).time.notation, 'O(n)');
    });
});

describe('C#', () => {
    const SRC = `
using System.Collections.Generic;
using System.Linq;

namespace Demo
{
    class A
    {
        public A() {}
        public int P { get { return 1; } }

        int Fib(int n) { if (n < 2) return n; return Fib(n - 1) + Fib(n - 2); }

        bool HasDupes(List<int> items)
        {
            var seen = new List<int>();
            foreach (var x in items)
            {
                if (seen.Contains(x)) return true;
                seen.Add(x);
            }
            return false;
        }

        bool HasDupesFast(List<int> items)
        {
            var seen = new HashSet<int>();
            foreach (var x in items)
            {
                if (seen.Contains(x)) return true;
                seen.Add(x);
            }
            return false;
        }

        string JoinAll(string[] parts) { string s = ""; foreach (var p in parts) { s += p; } return s; }

        int Sw(int x) { switch (x) { case 1: return 1; case 2: return 2; default: return 0; } }

        string Sw2(int k) => k switch { 1 => "a", 2 => "b", _ => "c" };

        int Linq(List<int> xs) { return xs.Where(x => x > 1 && x < 9).Select(x => x * 2).Sum(); }

        int LocalFn(int n)
        {
            int Helper(int k) { if (k < 1) return 0; return Helper(k - 1) + 1; }
            return Helper(n);
        }

        void Drain(List<int> list) { while (list.Count > 0) { var next = list[0]; list.RemoveAt(0); Use(next); } }
    }
}
`;
    it('analyses methods, local functions, switch expressions and LINQ', async () => {
        const r = await analyze('csharp', SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        for (const e of ['A.A', 'A.Fib', 'A.HasDupes', 'A.Sw2', 'A.LocalFn', 'A.Helper', 'A.Drain']) {
            assert.ok(names.includes(e), `missing ${e} in ${names.join(',')}`);
        }
        assert.strictEqual((await fn('csharp', SRC, 'A.Fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('csharp', SRC, 'A.HasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual((await fn('csharp', SRC, 'A.HasDupesFast')).time.notation, 'O(n)');
        assert.ok(ids(await fn('csharp', SRC, 'A.JoinAll')).includes('string-concat-in-loop'));
        assert.strictEqual((await fn('csharp', SRC, 'A.Sw')).cyclomatic, 3);
        assert.strictEqual((await fn('csharp', SRC, 'A.Sw2')).cyclomatic, 3);
        assert.strictEqual((await fn('csharp', SRC, 'A.Linq')).time.notation, 'O(n)');
        assert.strictEqual((await fn('csharp', SRC, 'A.LocalFn')).time.notation, 'O(n)');
        const drain = await fn('csharp', SRC, 'A.Drain');
        assert.strictEqual(drain.time.notation, 'O(n²)');
        assert.ok(ids(drain).includes('front-mutation-in-loop'));
    });
});
