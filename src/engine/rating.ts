/**
 * Turns the numbers into a grade and a sentence a newcomer can act on.
 */
import { Term, notation } from './bigo';
import { FileAnalysis, FunctionAnalysis, Grade, Rating, Suggestion, Thresholds } from './types';

const LABELS: Record<Grade, string> = {
    A: 'Excellent',
    B: 'Good',
    C: 'Needs attention',
    D: 'Poor',
};

function worse(a: Grade, b: Grade): Grade {
    return a > b ? a : b;
}

export interface RatingInput {
    cyclomatic: number;
    cognitive: number;
    maxNesting: number;
    lineCount: number;
    parameterCount: number;
    time: Term;
    timeConfidence: string;
    suggestions: Suggestion[];
    thresholds: Thresholds;
    name: string;
}

export function rateFunction(input: RatingInput): Rating {
    const { thresholds: t } = input;
    let grade: Grade = 'A';
    const reasons: string[] = [];

    if (input.cyclomatic > t.cyclomaticCritical) {
        grade = worse(grade, 'D');
        reasons.push(`cyclomatic complexity ${input.cyclomatic} is above the critical limit of ${t.cyclomaticCritical}`);
    } else if (input.cyclomatic > t.cyclomaticWarning) {
        grade = worse(grade, 'C');
        reasons.push(`cyclomatic complexity ${input.cyclomatic} is above the warning limit of ${t.cyclomaticWarning}`);
    } else if (input.cyclomatic > Math.ceil(t.cyclomaticWarning / 2)) {
        grade = worse(grade, 'B');
    }

    if (input.cognitive > t.cognitiveCritical) {
        grade = worse(grade, 'D');
        reasons.push(`cognitive complexity ${input.cognitive} is above the critical limit of ${t.cognitiveCritical}`);
    } else if (input.cognitive > t.cognitiveWarning) {
        grade = worse(grade, 'C');
        reasons.push(`cognitive complexity ${input.cognitive} is above the warning limit of ${t.cognitiveWarning}`);
    } else if (input.cognitive > Math.ceil(t.cognitiveWarning / 2)) {
        grade = worse(grade, 'B');
    }

    if (input.time.exp) {
        grade = worse(grade, 'D');
        reasons.push('estimated run time is exponential');
    } else if (input.time.n >= 4) {
        grade = worse(grade, 'D');
        reasons.push(`estimated run time is ${notation(input.time)}`);
    } else if (input.time.n >= 3) {
        grade = worse(grade, 'C');
        reasons.push(`estimated run time is ${notation(input.time)}`);
    } else if (input.time.n >= 2) {
        grade = worse(grade, 'B');
        reasons.push(`estimated run time is ${notation(input.time)}`);
    }

    if (input.maxNesting >= 6) {
        grade = worse(grade, 'C');
        reasons.push(`code is nested ${input.maxNesting} levels deep`);
    } else if (input.maxNesting >= 4) {
        grade = worse(grade, 'B');
    }

    if (input.lineCount > 120) {
        grade = worse(grade, 'C');
        reasons.push(`${input.lineCount} lines long`);
    } else if (input.lineCount > 60) {
        grade = worse(grade, 'B');
    }

    if (input.parameterCount >= 8) {
        grade = worse(grade, 'C');
        reasons.push(`${input.parameterCount} parameters`);
    } else if (input.parameterCount >= 6) {
        grade = worse(grade, 'B');
    }

    // These suggestions restate a metric already listed above; count them but do not repeat the reason.
    const metricBacked = new Set(['deep-nesting', 'long-function', 'too-many-parameters', 'high-cyclomatic', 'deep-loop-nesting']);
    for (const s of input.suggestions) {
        if (s.severity === 'critical') {
            grade = worse(grade, 'D');
        } else if (s.severity === 'warning') {
            grade = worse(grade, 'C');
        } else {
            continue;
        }
        if (!metricBacked.has(s.id)) {
            reasons.push(s.title.toLowerCase());
        }
    }

    const unique = [...new Set(reasons)];
    let summary: string;
    switch (grade) {
        case 'A':
            summary = 'Simple, readable and efficient. Nothing to do here.';
            break;
        case 'B':
            summary = unique.length ? `In good shape; ${unique[0]}.` : 'In good shape. A little branching or size, but easy to follow.';
            break;
        case 'C':
            summary = `Worth a look: ${unique.slice(0, 2).join(' and ')}.`;
            break;
        default:
            summary = `Refactor recommended: ${unique.slice(0, 2).join(' and ')}.`;
    }
    return { grade, label: LABELS[grade], summary, reasons: unique };
}

export function rateFile(functions: FunctionAnalysis[]): Rating {
    const counted = functions.filter((f) => !f.ignored);
    if (counted.length === 0) {
        return { grade: 'A', label: LABELS.A, summary: 'No functions found to grade.', reasons: [] };
    }
    const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const f of counted) {
        counts[f.rating.grade] += 1;
    }
    let grade: Grade;
    const reasons: string[] = [];
    if (counts.D > 0) {
        grade = 'D';
        reasons.push(`${counts.D} function${counts.D === 1 ? '' : 's'} rated Poor`);
    } else if (counts.C > counted.length * 0.3 || counts.C >= 3) {
        grade = 'C';
        reasons.push(`${counts.C} function${counts.C === 1 ? '' : 's'} need attention`);
    } else if (counts.C > 0) {
        grade = 'B';
        reasons.push(`${counts.C} function${counts.C === 1 ? '' : 's'} need${counts.C === 1 ? 's' : ''} attention`);
    } else if (counts.B > counted.length * 0.5) {
        grade = 'B';
    } else {
        grade = 'A';
    }
    const summaries: Record<Grade, string> = {
        A: 'Every function in this file is simple and efficient.',
        B: reasons[0] ? `Mostly healthy; ${reasons[0]}.` : 'Mostly healthy, with a few functions that could be simpler.',
        C: `Several hot spots: ${reasons[0]}.`,
        D: `Needs work: ${reasons[0]}.`,
    };
    return { grade, label: LABELS[grade], summary: summaries[grade], reasons };
}

export function gradeColorName(grade: Grade): string {
    return grade === 'A' ? 'green' : grade === 'B' ? 'blue' : grade === 'C' ? 'yellow' : 'red';
}

export type { FileAnalysis };
