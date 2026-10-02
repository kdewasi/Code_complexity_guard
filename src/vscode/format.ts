/**
 * Small presentation helpers shared by hover, CodeLens, tree and status bar.
 */
import * as vscode from 'vscode';
import { FunctionAnalysis, Grade, Thresholds } from '../engine';

export const GRADE_EMOJI: Record<Grade, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🔴' };
export const GRADE_ICON: Record<Grade, string> = { A: 'pass', B: 'check', C: 'warning', D: 'error' };
export const GRADE_THEME_COLOR: Record<Grade, string> = {
    A: 'testing.iconPassed',
    B: 'charts.blue',
    C: 'list.warningForeground',
    D: 'list.errorForeground',
};

export function gradeIcon(grade: Grade): vscode.ThemeIcon {
    return new vscode.ThemeIcon(GRADE_ICON[grade], new vscode.ThemeColor(GRADE_THEME_COLOR[grade]));
}

export function cyclomaticHint(value: number, t: Thresholds): string {
    if (value > t.cyclomaticCritical) {
        return `very hard to test (limit ${t.cyclomaticCritical})`;
    }
    if (value > t.cyclomaticWarning) {
        return `getting hard to test (limit ${t.cyclomaticWarning})`;
    }
    return value <= 3 ? 'trivial to test' : 'easy to test';
}

export function cognitiveHint(value: number, t: Thresholds): string {
    if (value > t.cognitiveCritical) {
        return `very hard to follow (limit ${t.cognitiveCritical})`;
    }
    if (value > t.cognitiveWarning) {
        return `dense (limit ${t.cognitiveWarning})`;
    }
    return value <= 5 ? 'reads easily' : 'readable';
}

export function oneLineSummary(f: FunctionAnalysis): string {
    return `${GRADE_EMOJI[f.rating.grade]} ${f.rating.grade} ${f.rating.label} · cyclomatic ${f.cyclomatic} · cognitive ${f.cognitive} · time ${f.time.notation} · space ${f.space.notation}`;
}

export function severityOf(level: 'info' | 'warning' | 'critical'): vscode.DiagnosticSeverity {
    switch (level) {
        case 'critical':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}

export function escapeMarkdown(s: string): string {
    return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, (m) => `\\${m}`);
}

export function codeSpan(s: string): string {
    return '`' + s.replace(/`/g, "'") + '`';
}

export function commandUri(command: string, args: unknown[]): vscode.Uri {
    return vscode.Uri.parse(`command:${command}?${encodeURIComponent(JSON.stringify(args))}`);
}
