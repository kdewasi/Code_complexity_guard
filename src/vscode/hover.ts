/**
 * Rich hover on a function's name line: grade, the four numbers with
 * plain-language meaning, the evidence behind the Big-O, and the top suggestions.
 */
import * as vscode from 'vscode';
import { FunctionAnalysis, METRIC_EXPLANATIONS } from '../engine';
import { AnalysisService } from './analysisService';
import { getSettings } from './config';
import { GRADE_EMOJI, cognitiveHint, commandUri, cyclomaticHint, escapeMarkdown } from './format';

export function buildHoverMarkdown(f: FunctionAnalysis, uri: vscode.Uri, thresholds = getSettings().thresholds): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.supportHtml = false;
    const name = escapeMarkdown(f.qualifiedName);
    md.appendMarkdown(`### ${GRADE_EMOJI[f.rating.grade]} ${f.rating.grade} · ${f.rating.label} — ${name}\n\n`);
    md.appendMarkdown(`${escapeMarkdown(f.rating.summary)}\n\n`);
    md.appendMarkdown('| Metric | Value | What it means |\n|---|---|---|\n');
    md.appendMarkdown(`| Cyclomatic | **${f.cyclomatic}** | ${escapeMarkdown(cyclomaticHint(f.cyclomatic, thresholds))} · ${f.cyclomatic} paths to test |\n`);
    md.appendMarkdown(`| Cognitive | **${f.cognitive}** | ${escapeMarkdown(cognitiveHint(f.cognitive, thresholds))} · nesting depth ${f.maxNesting} |\n`);
    md.appendMarkdown(`| Time | **${f.time.notation}** | ${escapeMarkdown(f.time.label)} · ${escapeMarkdown(f.time.plain)} |\n`);
    md.appendMarkdown(`| Space | **${f.space.notation}** | ${escapeMarkdown(f.space.plain)} |\n\n`);

    if (f.time.evidence.length > 0) {
        md.appendMarkdown(`**Why ${f.time.notation}?** (confidence: ${f.time.confidence})\n\n`);
        for (const e of f.time.evidence.slice(0, 4)) {
            md.appendMarkdown(`- Line ${e.line + 1}: ${escapeEvidence(e.text)}\n`);
        }
        md.appendMarkdown('\n');
    }
    if (f.recursion.isRecursive) {
        md.appendMarkdown(`Recursive (${f.recursion.callSites} call site${f.recursion.callSites === 1 ? '' : 's'}, ${f.recursion.reduction} reduction${f.recursion.memoized ? ', memoized' : ''}).\n\n`);
    }
    if (f.suggestions.length > 0) {
        md.appendMarkdown(`**Suggestions**\n\n`);
        for (const s of f.suggestions.slice(0, 3)) {
            const badge = s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '💡';
            md.appendMarkdown(`- ${badge} **${escapeMarkdown(s.title)}**${s.impact ? ` (${escapeMarkdown(s.impact)})` : ''}: ${escapeMarkdown(s.fix)}\n`);
        }
        if (f.suggestions.length > 3) {
            md.appendMarkdown(`- …and ${f.suggestions.length - 3} more\n`);
        }
        md.appendMarkdown('\n');
    }
    const open = commandUri('codecomplexity.showSuggestionsPanel', [uri.toString(), f.name, f.startLine]);
    const explain = commandUri('codecomplexity.explainMetrics', []);
    const ignore = commandUri('codecomplexity.ignoreWarning', [uri.toString(), f.startLine]);
    md.appendMarkdown(`[Open full breakdown](${open.toString()}) · [What do these numbers mean?](${explain.toString()}) · [Ignore this function](${ignore.toString()})`);
    return md;
}

function escapeEvidence(text: string): string {
    // Evidence uses `code` spans; keep them, escape the rest.
    return text
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith('`') && part.endsWith('`') ? part : escapeMarkdown(part)))
        .join('');
}

export function buildMetricsExplanation(): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendMarkdown('# What do these numbers mean?\n\n');
    for (const key of ['cyclomatic', 'cognitive', 'time', 'space', 'nesting'] as const) {
        const m = METRIC_EXPLANATIONS[key];
        md.appendMarkdown(`## ${m.name}\n\n**${m.short}**\n\n${m.long}\n\n*Good range:* ${m.goodRange}\n\n`);
    }
    md.appendMarkdown('## Grades\n\n- 🟢 **A Excellent**: small, readable, efficient.\n- 🔵 **B Good**: fine; a little branching or size.\n- 🟡 **C Needs attention**: complex, deeply nested or doing avoidable work.\n- 🔴 **D Poor**: hard to test or very slow for large inputs; refactor soon.\n');
    return md;
}

export class ComplexityHoverProvider implements vscode.HoverProvider {
    constructor(private readonly service: AnalysisService) {}

    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const analysis = this.service.getCached(document.uri);
        if (!analysis) {
            return undefined;
        }
        const f = analysis.functions.find((x) => !x.ignored && (x.nameLine === position.line || x.startLine === position.line));
        if (!f) {
            return undefined;
        }
        const line = document.lineAt(position.line);
        return new vscode.Hover(buildHoverMarkdown(f, document.uri), line.range);
    }
}
