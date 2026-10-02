/**
 * A tiny algebra for asymptotic growth terms.
 *
 * A Term is n^a · (log n)^b · (√n)^c, optionally exponential. Terms can be
 * multiplied (nesting loops, calling a linear function inside a loop) and
 * compared (take the worst of several code paths).
 */
import { BigO, Confidence, Evidence } from './types';

export interface Term {
    /** Exponent of n. */
    n: number;
    /** Exponent of log n. */
    log: number;
    /** Exponent of √n (0 or 1 in practice). */
    sqrt: number;
    /** True for 2^n style growth. */
    exp: boolean;
}

export const ONE: Term = { n: 0, log: 0, sqrt: 0, exp: false };
export const LOG_N: Term = { n: 0, log: 1, sqrt: 0, exp: false };
export const SQRT_N: Term = { n: 0, log: 0, sqrt: 1, exp: false };
export const LINEAR: Term = { n: 1, log: 0, sqrt: 0, exp: false };
export const N_LOG_N: Term = { n: 1, log: 1, sqrt: 0, exp: false };
export const QUADRATIC: Term = { n: 2, log: 0, sqrt: 0, exp: false };
export const EXPONENTIAL: Term = { n: 0, log: 0, sqrt: 0, exp: true };

export function multiply(a: Term, b: Term): Term {
    return {
        n: a.n + b.n,
        log: a.log + b.log,
        sqrt: a.sqrt + b.sqrt,
        exp: a.exp || b.exp,
    };
}

/** Sortable growth rank. Exponential always dominates polynomials. */
export function rank(t: Term): number {
    if (t.exp) {
        return 100 + t.n + t.log * 0.5 + t.sqrt * 0.5;
    }
    return t.n + t.sqrt * 0.5 + t.log * 0.25;
}

export function max(a: Term, b: Term): Term {
    return rank(b) > rank(a) ? b : a;
}

export function isConstant(t: Term): boolean {
    return !t.exp && t.n === 0 && t.log === 0 && t.sqrt === 0;
}

export function equals(a: Term, b: Term): boolean {
    return a.n === b.n && a.log === b.log && a.sqrt === b.sqrt && a.exp === b.exp;
}

const SUPERSCRIPT: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function sup(k: number): string {
    return String(k).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

export function notation(t: Term): string {
    if (t.exp) {
        const poly = notation({ ...t, exp: false });
        return poly === 'O(1)' ? 'O(2ⁿ)' : `O(2ⁿ · ${poly.slice(2, -1)})`;
    }
    const parts: string[] = [];
    if (t.n === 1) {
        parts.push('n');
    } else if (t.n > 1) {
        parts.push(`n${sup(t.n)}`);
    }
    if (t.sqrt === 1) {
        parts.push('√n');
    } else if (t.sqrt > 1) {
        parts.push(`n${sup(t.sqrt)}ᐟ²`);
    }
    if (t.log === 1) {
        parts.push('log n');
    } else if (t.log > 1) {
        parts.push(`log${sup(t.log)} n`);
    }
    return parts.length === 0 ? 'O(1)' : `O(${parts.join(' ')})`;
}

export function label(t: Term): string {
    if (t.exp) {
        return 'exponential';
    }
    if (isConstant(t)) {
        return 'constant';
    }
    if (t.n === 0 && t.sqrt === 0) {
        return 'logarithmic';
    }
    if (t.n === 0 && t.sqrt === 1) {
        return 'square-root';
    }
    if (t.n === 1 && t.log === 0 && t.sqrt === 0) {
        return 'linear';
    }
    if (t.n === 1 && t.log >= 1 && t.sqrt === 0) {
        return 'linearithmic';
    }
    if (t.n === 2 && t.sqrt === 0) {
        return t.log > 0 ? 'quadratic × log' : 'quadratic';
    }
    if (t.n === 3 && t.sqrt === 0) {
        return t.log > 0 ? 'cubic × log' : 'cubic';
    }
    return 'polynomial';
}

/** One sentence a newcomer can understand, for time complexity. */
export function plainTime(t: Term): string {
    if (t.exp) {
        return 'Run time roughly doubles every time the input grows by one element. Fine for tiny inputs, unusable beyond a few dozen.';
    }
    if (isConstant(t)) {
        return 'Takes about the same time no matter how big the input is.';
    }
    if (t.n === 0 && t.sqrt === 0) {
        return 'Doubling the input adds only one extra step. Extremely scalable.';
    }
    if (t.n === 0 && t.sqrt === 1) {
        return 'Grows with the square root of the input: 100× more data costs about 10× more time.';
    }
    if (t.n === 1 && t.log === 0 && t.sqrt === 0) {
        return 'Work grows in direct proportion to the input: twice the data, twice the time. This is the normal cost of looking at every element once.';
    }
    if (t.n === 1 && t.log >= 1 && t.sqrt === 0) {
        return 'Slightly worse than linear, the cost of a good sort. Scales well to millions of items.';
    }
    if (t.n === 2 && t.sqrt === 0) {
        return 'Doubling the input makes it about four times slower. Fine for hundreds of items, slow for hundreds of thousands.';
    }
    if (t.n === 3 && t.sqrt === 0) {
        return 'Doubling the input makes it about eight times slower. Only practical for small inputs (a few thousand items at most).';
    }
    return `Grows like n to the power ${t.n + t.sqrt / 2}. Only practical for small inputs.`;
}

/** One sentence a newcomer can understand, for space complexity. */
export function plainSpace(t: Term): string {
    if (t.exp) {
        return 'Memory use explodes with input size.';
    }
    if (isConstant(t)) {
        return 'Uses a fixed amount of extra memory regardless of input size.';
    }
    if (t.n === 0 && t.sqrt === 0) {
        return 'Extra memory grows very slowly (for example the depth of a halving recursion).';
    }
    if (t.n === 1 && t.log === 0 && t.sqrt === 0) {
        return 'Extra memory grows in proportion to the input, for example a new list with one entry per element, or a recursion that goes one level deeper per element.';
    }
    if (t.n === 2 && t.sqrt === 0) {
        return 'Extra memory grows with the square of the input, for example a table with a row and a column per element.';
    }
    return 'Extra memory grows faster than the input.';
}

export function toBigO(t: Term, evidence: Evidence[], confidence: Confidence, space = false): BigO {
    return {
        notation: notation(t),
        label: label(t),
        plain: space ? plainSpace(t) : plainTime(t),
        rank: rank(t),
        confidence,
        evidence,
    };
}

/** Human description of a single loop factor, used in evidence text. */
export function factorWord(t: Term): string {
    if (isConstant(t)) {
        return 'a fixed number of times';
    }
    if (t.n === 0 && t.log === 1 && t.sqrt === 0) {
        return 'about log n times (the loop variable halves or doubles each step)';
    }
    if (t.n === 0 && t.sqrt === 1) {
        return 'about √n times';
    }
    if (t.n === 1 && t.log === 0 && t.sqrt === 0) {
        return 'once per element (n times)';
    }
    return `${notation(t).slice(2, -1)} times`;
}
