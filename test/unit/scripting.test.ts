import * as assert from 'assert';
import { analyze, fn, ids } from './helpers';

describe('Ruby', () => {
    const SRC = `
require 'set'

def fib(n)
  return n if n < 2
  fib(n - 1) + fib(n - 2)
end

def has_dupes(items)
  seen = []
  items.each do |x|
    return true if seen.include?(x)
    seen << x
  end
  false
end

def has_dupes_fast(items)
  seen = Set.new
  items.each do |x|
    return true if seen.include?(x)
    seen << x
  end
  false
end

def join_all(parts)
  s = ""
  parts.each { |p| s += p }
  s
end

def kind(k)
  if k == 'a'
    1
  elsif k == 'b'
    2
  elsif k == 'c'
    3
  elsif k == 'd'
    4
  else
    0
  end
end

def cw(x)
  case x
  when 1 then 1
  when 2, 3 then 2
  else 0
  end
end

class Q
  def self.build(xs)
    xs.map { |x| x * 2 }.select { |x| x > 2 }
  end

  def loop_demo(n)
    n.times do |i|
      puts i if i.even? && i > 2
    end
    3.times { |i| puts i }
  end

  def initialize(a)
    @a = a
  end
end

def modifiers(a)
  x = 1 if a
  x += 1 while x < 10
  x
end
`;
    it('analyses methods, blocks, case/when and modifiers', async () => {
        const r = await analyze('ruby', SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        for (const e of ['fib', 'has_dupes', 'Q.build', 'Q.loop_demo', 'Q.initialize', 'modifiers']) {
            assert.ok(names.includes(e), `missing ${e} in ${names.join(',')}`);
        }
        assert.strictEqual(r.functions.find((f) => f.name === 'initialize')?.kind, 'constructor');
        assert.strictEqual((await fn('ruby', SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('ruby', SRC, 'has_dupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.strictEqual(dupes.cyclomatic, 3); // each block + if modifier
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual(dupes.space.notation, 'O(n)');
        assert.strictEqual((await fn('ruby', SRC, 'has_dupes_fast')).time.notation, 'O(n)');
        const join = await fn('ruby', SRC, 'join_all');
        assert.ok(ids(join).includes('string-concat-in-loop'));
        const kind = await fn('ruby', SRC, 'kind');
        assert.strictEqual(kind.cyclomatic, 5);
        assert.ok(ids(kind).includes('long-if-chain'));
        assert.strictEqual((await fn('ruby', SRC, 'cw')).cyclomatic, 3);
        assert.strictEqual((await fn('ruby', SRC, 'Q.build')).time.notation, 'O(n)');
        const ld = await fn('ruby', SRC, 'Q.loop_demo');
        assert.strictEqual(ld.time.notation, 'O(n)');
        assert.strictEqual(ld.cyclomatic, 5); // times block + if + && + times block
        const mods = await fn('ruby', SRC, 'modifiers');
        assert.strictEqual(mods.cyclomatic, 3);
    });
});

describe('PHP', () => {
    const SRC = `<?php
namespace App;

function fib($n) { if ($n < 2) return $n; return fib($n - 1) + fib($n - 2); }

function hasDupes($items) {
    $seen = [];
    foreach ($items as $x) {
        if (in_array($x, $seen)) return true;
        $seen[] = $x;
    }
    return false;
}

function hasDupesFast($items) {
    $seen = [];
    foreach ($items as $x) {
        if (isset($seen[$x])) return true;
        $seen[$x] = true;
    }
    return false;
}

function shiftAll($q) { while ($q) { $x = array_shift($q); use($x); } }

function sw($x) { switch ($x) { case 1: return 1; case 2: return 2; default: return 0; } }

function kind($k) {
    if ($k === 'a') { return 1; } elseif ($k === 'b') { return 2; } elseif ($k === 'c') { return 3; } elseif ($k === 'd') { return 4; } else { return 0; }
}

class C {
    public function __construct(private array $items) {}
    public function m(): int {
        $f = fn($x) => $x * 2;
        return match(true) { $f(1) > 1 => 1, default => 0 };
    }
    public function sortEach(array $rows, array $data): void {
        foreach ($rows as $r) { sort($data); }
    }
}
`;
    it('analyses functions, methods, match and array helpers', async () => {
        const r = await analyze('php', SRC);
        const names = r.functions.map((f) => f.qualifiedName);
        for (const e of ['fib', 'hasDupes', 'C.__construct', 'C.m', 'C.$f', 'C.sortEach']) {
            assert.ok(names.includes(e), `missing ${e} in ${names.join(',')}`);
        }
        assert.strictEqual(r.functions.find((f) => f.name === '__construct')?.kind, 'constructor');
        assert.strictEqual((await fn('php', SRC, 'fib')).time.notation, 'O(2ⁿ)');
        const dupes = await fn('php', SRC, 'hasDupes');
        assert.strictEqual(dupes.time.notation, 'O(n²)');
        assert.ok(ids(dupes).includes('linear-search-in-loop'));
        assert.strictEqual(dupes.space.notation, 'O(n)');
        assert.strictEqual((await fn('php', SRC, 'hasDupesFast')).time.notation, 'O(n)');
        const shift = await fn('php', SRC, 'shiftAll');
        assert.strictEqual(shift.time.notation, 'O(n²)');
        assert.ok(ids(shift).includes('front-mutation-in-loop'));
        assert.strictEqual((await fn('php', SRC, 'sw')).cyclomatic, 3);
        const kind = await fn('php', SRC, 'kind');
        assert.strictEqual(kind.cyclomatic, 5);
        assert.ok(ids(kind).includes('long-if-chain'));
        assert.strictEqual((await fn('php', SRC, 'C.m')).cyclomatic, 2);
        const se = await fn('php', SRC, 'C.sortEach');
        assert.strictEqual(se.time.notation, 'O(n² log n)');
        assert.ok(ids(se).includes('sort-in-loop'));
    });
});
