import * as assert from 'assert';
import { Analyzer, SUPPORTED_LANGUAGE_IDS, languageFromFileName, languageFromVsCodeId } from '../../src/engine';
import { rateFunction } from '../../src/engine/rating';
import { LINEAR, ONE } from '../../src/engine/bigo';
import { DEFAULT_THRESHOLDS } from '../../src/engine/types';
import { analyze, analyzer } from './helpers';

describe('Analyzer', () => {
    it('supports twelve language ids', () => {
        assert.strictEqual(SUPPORTED_LANGUAGE_IDS.length, 12);
        assert.strictEqual(languageFromVsCodeId('typescriptreact'), 'tsx');
        assert.strictEqual(languageFromVsCodeId('javascriptreact'), 'tsx');
        assert.strictEqual(languageFromVsCodeId('csharp'), 'csharp');
        assert.strictEqual(languageFromVsCodeId('plaintext'), undefined);
        assert.strictEqual(languageFromFileName('a/b/c.py'), 'python');
        assert.strictEqual(languageFromFileName('x.hpp'), 'cpp');
        assert.strictEqual(languageFromFileName('x.unknown'), undefined);
        assert.strictEqual(Analyzer.languageFor(undefined, 'main.go'), 'go');
    });

    it('handles empty input, syntax errors and ignore-file markers', async () => {
        assert.strictEqual((await analyze('python', '')).functions.length, 0);
        const broken = await analyze('python', 'def f(:\n    if x\n\ndef g():\n    return 1\n');
        assert.ok(broken.parseErrors > 0);
        assert.ok(broken.functions.some((f) => f.name === 'g'));
        const ignored = await analyze('javascript', '// codecomplexity: ignore-file\nfunction f() { if (a) {} }\n');
        assert.strictEqual(ignored.functions.length, 0);
    });

    it('respects thresholds when grading', async () => {
        const src = 'def f(a, b, c, d):\n    if a:\n        return 1\n    if b:\n        return 2\n    if c:\n        return 3\n    if d:\n        return 4\n    return 0\n';
        const strict = await analyzer.analyze(src, 'python', { thresholds: { cyclomaticWarning: 2, cyclomaticCritical: 4 } });
        assert.strictEqual(strict.functions[0].cyclomatic, 5);
        assert.strictEqual(strict.functions[0].rating.grade, 'D');
        const relaxed = await analyzer.analyze(src, 'python', { thresholds: { cyclomaticWarning: 10, cyclomaticCritical: 20 } });
        assert.strictEqual(relaxed.functions[0].rating.grade, 'A');
        const defaults = await analyzer.analyze(src, 'python');
        assert.strictEqual(defaults.functions[0].rating.grade, 'B');
    });

    it('skips oversized files', async () => {
        const r = await analyzer.analyze('def f():\n    return 1\n', 'python', { maxChars: 5 });
        assert.strictEqual(r.functions.length, 0);
    });

    it('computes file totals and rating', async () => {
        const r = await analyze('python', 'def a():\n    return 1\n\ndef b(x):\n    if x:\n        return 1\n    return 0\n');
        assert.strictEqual(r.totals.functionCount, 2);
        assert.strictEqual(r.totals.maxCyclomatic, 2);
        assert.strictEqual(r.totals.avgCyclomatic, 1.5);
        assert.strictEqual(r.totals.gradeCounts.A, 2);
        assert.strictEqual(r.fileRating.grade, 'A');
        assert.strictEqual(r.totals.worstTime?.notation, 'O(1)');
    });

    it('stays fast on large files', async () => {
        const big = Array.from({ length: 1500 }, (_, i) => `def f${i}(a, b):\n    if a and b:\n        for x in a:\n            if x in b:\n                return x\n    return None\n`).join('\n');
        const started = Date.now();
        const r = await analyze('python', big);
        assert.strictEqual(r.functions.length, 1500);
        assert.ok(Date.now() - started < 10000, `took ${Date.now() - started}ms`);
    });

    it('produces plain-language ratings', () => {
        const good = rateFunction({ cyclomatic: 2, cognitive: 1, maxNesting: 1, lineCount: 10, parameterCount: 2, time: LINEAR, timeConfidence: 'high', suggestions: [], thresholds: DEFAULT_THRESHOLDS, name: 'f' });
        assert.strictEqual(good.grade, 'A');
        const bad = rateFunction({ cyclomatic: 30, cognitive: 40, maxNesting: 7, lineCount: 200, parameterCount: 9, time: ONE, timeConfidence: 'high', suggestions: [], thresholds: DEFAULT_THRESHOLDS, name: 'f' });
        assert.strictEqual(bad.grade, 'D');
        assert.ok(bad.summary.startsWith('Refactor recommended'));
        assert.ok(bad.reasons.length >= 3);
    });

    it('serialises to JSON without tree-sitter objects', async () => {
        const r = await analyze('java', 'class A { int f(int x) { if (x > 0) return 1; return 0; } }');
        const json = JSON.parse(JSON.stringify(r));
        assert.strictEqual(json.functions[0].name, 'f');
        assert.strictEqual(json.functions[0].time.notation, 'O(1)');
    });
});
