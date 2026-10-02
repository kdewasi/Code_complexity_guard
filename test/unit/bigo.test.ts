import * as assert from 'assert';
import { EXPONENTIAL, LINEAR, LOG_N, N_LOG_N, ONE, QUADRATIC, SQRT_N, label, max, multiply, notation, rank } from '../../src/engine/bigo';

describe('Big-O term algebra', () => {
    it('formats notations', () => {
        assert.strictEqual(notation(ONE), 'O(1)');
        assert.strictEqual(notation(LOG_N), 'O(log n)');
        assert.strictEqual(notation(SQRT_N), 'O(√n)');
        assert.strictEqual(notation(LINEAR), 'O(n)');
        assert.strictEqual(notation(N_LOG_N), 'O(n log n)');
        assert.strictEqual(notation(QUADRATIC), 'O(n²)');
        assert.strictEqual(notation(multiply(QUADRATIC, LINEAR)), 'O(n³)');
        assert.strictEqual(notation(multiply(QUADRATIC, LOG_N)), 'O(n² log n)');
        assert.strictEqual(notation(EXPONENTIAL), 'O(2ⁿ)');
    });

    it('multiplies and ranks', () => {
        assert.deepStrictEqual(multiply(LINEAR, LOG_N), N_LOG_N);
        assert.ok(rank(EXPONENTIAL) > rank(multiply(QUADRATIC, QUADRATIC)));
        assert.ok(rank(N_LOG_N) > rank(LINEAR));
        assert.ok(rank(LINEAR) > rank(SQRT_N));
        assert.ok(rank(SQRT_N) > rank(LOG_N));
        assert.ok(rank(LOG_N) > rank(ONE));
        assert.strictEqual(max(LINEAR, QUADRATIC), QUADRATIC);
        assert.strictEqual(max(QUADRATIC, LINEAR), QUADRATIC);
    });

    it('labels growth classes', () => {
        assert.strictEqual(label(ONE), 'constant');
        assert.strictEqual(label(LOG_N), 'logarithmic');
        assert.strictEqual(label(LINEAR), 'linear');
        assert.strictEqual(label(N_LOG_N), 'linearithmic');
        assert.strictEqual(label(QUADRATIC), 'quadratic');
        assert.strictEqual(label(EXPONENTIAL), 'exponential');
    });
});
