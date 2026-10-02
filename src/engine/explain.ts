/**
 * Plain-language explanations reused by the hover, the report and the CLI.
 */
import { Grade } from './types';

export interface MetricExplanation {
    name: string;
    short: string;
    long: string;
    goodRange: string;
}

export const METRIC_EXPLANATIONS: Record<'cyclomatic' | 'cognitive' | 'time' | 'space' | 'nesting', MetricExplanation> = {
    cyclomatic: {
        name: 'Cyclomatic complexity',
        short: 'How many different paths run through the function.',
        long:
            'Starts at 1 and adds 1 for every place the code can go two ways: if, else-if, loops, case labels, catch blocks, ?: and each && / ||. ' +
            'It is the minimum number of test cases needed to cover every path.',
        goodRange: '1–8 is comfortable, 9–15 deserves a look, above 15 is hard to test.',
    },
    cognitive: {
        name: 'Cognitive complexity',
        short: 'How hard the function is for a person to follow.',
        long:
            'Like cyclomatic complexity, but nested structures cost more: an `if` inside a loop inside an `if` adds 3, not 1. ' +
            'Else-if chains and sequences of the same boolean operator are cheap because people read them as one idea. Recursion adds 1.',
        goodRange: '0–15 reads easily, 16–25 is dense, above 25 should be split up.',
    },
    time: {
        name: 'Estimated time (Big-O)',
        short: 'How the run time grows when the input gets bigger.',
        long:
            'Estimated from the structure of the code: nested loops multiply, a loop variable that halves each step counts as log n, ' +
            'known library calls (sort, contains, copy) have their usual cost, recursion follows the standard recurrences, and calls to other functions in the same file are included. ' +
            'It is an estimate of the worst case, not a measurement.',
        goodRange: 'O(1), O(log n), O(n) and O(n log n) scale to very large inputs. O(n²) is fine for thousands of items. O(n³) and O(2ⁿ) only work for small inputs.',
    },
    space: {
        name: 'Estimated extra memory (Big-O)',
        short: 'How much additional memory the function needs as the input grows.',
        long:
            'Counts collections that grow inside loops, copies and slices, allocations sized by the input, and recursion depth (every pending call keeps a stack frame).',
        goodRange: 'O(1) and O(log n) are ideal; O(n) is normal when a result list is built; O(n²) means a table with one cell per pair of elements.',
    },
    nesting: {
        name: 'Nesting depth',
        short: 'The deepest level of blocks inside blocks.',
        long: 'Each if / loop / switch / try that sits inside another one adds a level. Readers have to keep every enclosing condition in mind.',
        goodRange: '1–3 is easy, 4–5 is tiring, 6 and more needs guard clauses or helper functions.',
    },
};

export function explainGrade(grade: Grade): string {
    switch (grade) {
        case 'A':
            return 'Excellent: small, easy to read and efficient.';
        case 'B':
            return 'Good: readable and reasonably efficient; nothing urgent.';
        case 'C':
            return 'Needs attention: complex, deeply nested or doing more work than necessary. Worth refactoring when you touch it next.';
        default:
            return 'Poor: hard to test or very slow for large inputs. Refactor soon.';
    }
}
