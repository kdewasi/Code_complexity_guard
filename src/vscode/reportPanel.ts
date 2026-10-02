/**
 * The Complexity Report webview: a dashboard for one file or the whole workspace.
 *
 * Security: strict CSP with a per-render nonce, no remote resources, every
 * dynamic string HTML-escaped, and the only inbound messages are
 * "reveal a line" / "open a file" / "run a command from a fixed allow-list".
 */
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { FileAnalysis, FunctionAnalysis, Grade, METRIC_EXPLANATIONS, Suggestion } from '../engine';
import { getSettings } from './config';
import { cognitiveHint, cyclomaticHint } from './format';
import { WorkspaceReport } from './workspaceScan';

type Mode = { kind: 'file'; uri: vscode.Uri; analysis: FileAnalysis; focus?: { name: string; startLine: number; suggestionId?: string } } | { kind: 'workspace'; report: WorkspaceReport };

interface InboundMessage {
    type: 'reveal' | 'openFile' | 'command';
    uri?: string;
    line?: number;
    command?: string;
}

const ALLOWED_COMMANDS = new Set(['codecomplexity.explainMetrics', 'codecomplexity.configureThreshold', 'codecomplexity.analyzeWorkspace', 'codecomplexity.showReport']);

const GRADE_LABEL: Record<Grade, string> = { A: 'Excellent', B: 'Good', C: 'Needs attention', D: 'Poor' };

export function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Renders `code` spans in evidence text safely. */
function inlineCode(text: string): string {
    return text
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith('`') && part.endsWith('`') && part.length >= 2 ? `<code>${esc(part.slice(1, -1))}</code>` : esc(part)))
        .join('');
}

export class ReportPanel implements vscode.Disposable {
    private static current: ReportPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private mode: Mode | undefined;

    static show(extensionUri: vscode.Uri, mode: Mode): ReportPanel {
        const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
        if (!ReportPanel.current) {
            const panel = vscode.window.createWebviewPanel('codecomplexity.report', 'Complexity Report', { viewColumn: column, preserveFocus: true }, {
                enableScripts: true,
                enableCommandUris: false,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true,
            });
            panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'activity-icon.svg');
            ReportPanel.current = new ReportPanel(panel);
        } else {
            ReportPanel.current.panel.reveal(undefined, true);
        }
        ReportPanel.current.render(mode);
        return ReportPanel.current;
    }

    static get instance(): ReportPanel | undefined {
        return ReportPanel.current;
    }

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        panel.onDidDispose(() => this.dispose(), null, this.disposables);
        panel.webview.onDidReceiveMessage((msg: InboundMessage) => void this.handle(msg), null, this.disposables);
    }

    /** Current file shown, if any (used to refresh after re-analysis). */
    get fileUri(): vscode.Uri | undefined {
        return this.mode?.kind === 'file' ? this.mode.uri : undefined;
    }

    refreshFile(uri: vscode.Uri, analysis: FileAnalysis): void {
        if (this.mode?.kind === 'file' && this.mode.uri.toString() === uri.toString()) {
            this.render({ kind: 'file', uri, analysis, focus: this.mode.focus });
        }
    }

    render(mode: Mode): void {
        this.mode = mode;
        const nonce = crypto.randomBytes(16).toString('base64');
        const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${this.panel.webview.cspSource} data:;`;
        const body = mode.kind === 'file' ? renderFile(mode.uri, mode.analysis, mode.focus) : renderWorkspace(mode.report);
        this.panel.title = mode.kind === 'file' ? `Complexity: ${basename(mode.uri)}` : 'Complexity: Workspace';
        this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Complexity Report</title>
<style nonce="${nonce}">${CSS}</style>
</head>
<body>
${body}
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
    }

    private async handle(msg: InboundMessage): Promise<void> {
        if (!msg || typeof msg !== 'object') {
            return;
        }
        if (msg.type === 'reveal' && typeof msg.uri === 'string' && typeof msg.line === 'number') {
            await revealLine(msg.uri, msg.line);
        } else if (msg.type === 'openFile' && typeof msg.uri === 'string') {
            const uri = safeUri(msg.uri);
            if (uri) {
                await vscode.commands.executeCommand('codecomplexity.showReportFor', uri);
            }
        } else if (msg.type === 'command' && typeof msg.command === 'string' && ALLOWED_COMMANDS.has(msg.command)) {
            await vscode.commands.executeCommand(msg.command);
        }
    }

    dispose(): void {
        ReportPanel.current = undefined;
        this.panel.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}

function safeUri(s: string): vscode.Uri | undefined {
    try {
        const uri = vscode.Uri.parse(s, true);
        return uri.scheme === 'file' || uri.scheme === 'untitled' || uri.scheme === 'vscode-remote' || uri.scheme === 'vscode-vfs' ? uri : undefined;
    } catch {
        return undefined;
    }
}

export async function revealLine(uriString: string, line: number): Promise<void> {
    const uri = safeUri(uriString);
    if (!uri) {
        return;
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
    const l = Math.max(0, Math.min(line, doc.lineCount - 1));
    const range = doc.lineAt(l).range;
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

function basename(uri: vscode.Uri): string {
    return uri.path.split('/').pop() ?? uri.path;
}

// ---------------------------------------------------------------- rendering

function gradeBadge(grade: Grade, big = false): string {
    return `<span class="badge grade-${grade}${big ? ' big' : ''}" title="${esc(GRADE_LABEL[grade])}">${grade}</span>`;
}

export function renderFile(uri: vscode.Uri, a: FileAnalysis, focus?: { name: string; startLine: number; suggestionId?: string }): string {
    const t = getSettings().thresholds;
    const u = esc(uri.toString());
    const fns = a.functions.filter((f) => !f.ignored);
    const order = { D: 0, C: 1, B: 2, A: 3 };
    const sorted = [...fns].sort((x, y) => order[x.rating.grade] - order[y.rating.grade] || x.startLine - y.startLine);
    const counts = a.totals.gradeCounts;
    const header = `
<header class="top">
  <div class="title-row">
    ${gradeBadge(a.fileRating.grade, true)}
    <div>
      <h1>${esc(basename(uri))}</h1>
      <p class="muted">${esc(a.languageName)} · ${a.lineCount} lines · ${fns.length} function${fns.length === 1 ? '' : 's'} · analysed in ${a.durationMs} ms${a.parseErrors ? ` · <span class="warn">${a.parseErrors} syntax error${a.parseErrors === 1 ? '' : 's'} (results may be partial)</span>` : ''}</p>
    </div>
  </div>
  <p class="summary">${esc(a.fileRating.summary)}</p>
  <div class="chips">
    <span class="chip grade-A">${counts.A} excellent</span>
    <span class="chip grade-B">${counts.B} good</span>
    <span class="chip grade-C">${counts.C} need attention</span>
    <span class="chip grade-D">${counts.D} poor</span>
    <span class="chip">worst time ${esc(a.totals.worstTime?.notation ?? 'O(1)')}</span>
    <span class="chip">avg cyclomatic ${a.totals.avgCyclomatic}</span>
    <span class="chip">${a.totals.suggestionCount} suggestion${a.totals.suggestionCount === 1 ? '' : 's'}</span>
  </div>
  <div class="toolbar">
    <input id="filter" type="search" placeholder="Filter functions…" aria-label="Filter functions">
    <button class="btn" data-command="codecomplexity.explainMetrics">What do these numbers mean?</button>
    <button class="btn" data-command="codecomplexity.analyzeWorkspace">Analyze whole workspace</button>
    <button class="btn" data-command="codecomplexity.configureThreshold">Settings</button>
  </div>
</header>
${legend()}`;
    if (fns.length === 0) {
        return header + `<p class="empty">No functions found in this file.</p>`;
    }
    const cards = sorted.map((f) => renderFunction(f, u, t, focus)).join('\n');
    return header + `<main id="cards">${cards}</main>`;
}

function legend(): string {
    const rows = (['cyclomatic', 'cognitive', 'time', 'space'] as const)
        .map((k) => {
            const m = METRIC_EXPLANATIONS[k];
            return `<div class="legend-item"><strong>${esc(m.name)}</strong><span>${esc(m.short)}</span><em>${esc(m.goodRange)}</em></div>`;
        })
        .join('');
    return `<details class="legend"><summary>How to read this report</summary><div class="legend-grid">${rows}</div>
<p class="muted">Grades: <span class="badge grade-A">A</span> excellent · <span class="badge grade-B">B</span> good · <span class="badge grade-C">C</span> needs attention · <span class="badge grade-D">D</span> poor. Big-O values are estimates from the code's structure (worst case), not measurements.</p></details>`;
}

function renderFunction(f: FunctionAnalysis, u: string, t: { cyclomaticWarning: number; cyclomaticCritical: number; cognitiveWarning: number; cognitiveCritical: number }, focus?: { name: string; startLine: number; suggestionId?: string }): string {
    const focused = !!focus && focus.name === f.name && focus.startLine === f.startLine;
    const open = focused || f.rating.grade === 'C' || f.rating.grade === 'D';
    const line = f.nameLine;
    const evidence = (items: { line: number; text: string }[]): string =>
        items.length === 0 ? '<li class="muted">No loops, recursion or expensive calls found.</li>' : items.map((e) => `<li><a class="line" data-uri="${u}" data-line="${e.line}">L${e.line + 1}</a> ${inlineCode(e.text)}</li>`).join('');
    const suggestions = f.suggestions.map((s) => renderSuggestion(s, u, focus?.suggestionId === s.id)).join('');
    const decisions = f.decisionPoints.length
        ? `<details class="sub"><summary>Decision points (${f.decisionPoints.length})</summary><table class="dp"><thead><tr><th>Line</th><th>Construct</th><th>Nesting</th><th>+cyclomatic</th><th>+cognitive</th></tr></thead><tbody>${f.decisionPoints
              .map((d) => `<tr><td><a class="line" data-uri="${u}" data-line="${d.line}">${d.line + 1}</a></td><td>${esc(d.description)}</td><td>${d.nesting}</td><td>${d.cyclomaticIncrement || ''}</td><td>${d.cognitiveIncrement || ''}</td></tr>`)
              .join('')}</tbody></table></details>`
        : '';
    const recursion = f.recursion.isRecursive ? `<p class="muted">Recursive: ${f.recursion.callSites} call site${f.recursion.callSites === 1 ? '' : 's'}, ${esc(f.recursion.reduction)} reduction${f.recursion.memoized ? ', memoized' : ''}.</p>` : '';
    const reasons = f.rating.reasons.length ? `<ul class="reasons">${f.rating.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    return `
<details class="card grade-${f.rating.grade}${focused ? ' focused' : ''}" data-name="${esc(f.qualifiedName.toLowerCase())}" ${open ? 'open' : ''} id="fn-${esc(f.name)}-${f.startLine}">
  <summary>
    ${gradeBadge(f.rating.grade)}
    <span class="fn-name"><code>${esc(f.qualifiedName)}</code></span>
    <a class="line muted" data-uri="${u}" data-line="${line}">line ${line + 1}</a>
    <span class="kind muted">${esc(f.kind)}</span>
    <span class="mini">cyc ${f.cyclomatic} · cog ${f.cognitive} · ${esc(f.time.notation)} · ${esc(f.space.notation)}</span>
  </summary>
  <div class="card-body">
    <p class="verdict">${esc(f.rating.summary)}</p>
    ${reasons}
    <div class="tiles">
      <div class="tile ${tileClass(f.cyclomatic, t.cyclomaticWarning, t.cyclomaticCritical)}"><div class="tile-label">Cyclomatic</div><div class="tile-value">${f.cyclomatic}</div><div class="tile-hint">${esc(cyclomaticHint(f.cyclomatic, t))}</div></div>
      <div class="tile ${tileClass(f.cognitive, t.cognitiveWarning, t.cognitiveCritical)}"><div class="tile-label">Cognitive</div><div class="tile-value">${f.cognitive}</div><div class="tile-hint">${esc(cognitiveHint(f.cognitive, t))}</div></div>
      <div class="tile ${timeClass(f.time.rank)}"><div class="tile-label">Time</div><div class="tile-value">${esc(f.time.notation)}</div><div class="tile-hint">${esc(f.time.label)} · confidence ${esc(f.time.confidence)}</div></div>
      <div class="tile ${timeClass(f.space.rank)}"><div class="tile-label">Extra memory</div><div class="tile-value">${esc(f.space.notation)}</div><div class="tile-hint">${esc(f.space.label)}</div></div>
      <div class="tile"><div class="tile-label">Size</div><div class="tile-value">${f.lineCount}</div><div class="tile-hint">lines · ${f.parameterCount} param${f.parameterCount === 1 ? '' : 's'} · nesting ${f.maxNesting}</div></div>
    </div>
    <div class="two-col">
      <div><h3>Why ${esc(f.time.notation)} time?</h3><p class="muted">${esc(f.time.plain)}</p><ul class="evidence">${evidence(f.time.evidence)}</ul>${recursion}</div>
      <div><h3>Why ${esc(f.space.notation)} memory?</h3><p class="muted">${esc(f.space.plain)}</p><ul class="evidence">${evidence(f.space.evidence)}</ul></div>
    </div>
    ${f.suggestions.length ? `<h3>Suggestions (${f.suggestions.length})</h3>${suggestions}` : '<p class="ok">✓ No optimisation or readability suggestions for this function.</p>'}
    ${decisions}
  </div>
</details>`;
}

function tileClass(value: number, warn: number, crit: number): string {
    return value > crit ? 'bad' : value > warn ? 'warn' : 'good';
}

function timeClass(rank: number): string {
    return rank >= 100 || rank >= 3 ? 'bad' : rank >= 2 ? 'warn' : 'good';
}

function renderSuggestion(s: Suggestion, u: string, focused: boolean): string {
    const sev = s.severity === 'critical' ? 'bad' : s.severity === 'warning' ? 'warn' : 'info';
    const code = s.before && s.after ? `<div class="before-after"><div><div class="code-label">Before</div><pre><code>${esc(s.before)}</code></pre></div><div><div class="code-label">After</div><pre><code>${esc(s.after)}</code></pre></div></div>` : '';
    return `
<div class="suggestion ${sev}${focused ? ' focused' : ''}" id="sg-${esc(s.id)}-${s.line}">
  <div class="sg-head"><span class="sev ${sev}">${esc(s.severity)}</span><strong>${esc(s.title)}</strong>${s.impact ? `<span class="impact">${esc(s.impact)}</span>` : ''}<a class="line muted" data-uri="${u}" data-line="${s.line}">line ${s.line + 1}</a><span class="muted">${esc(s.category)}</span></div>
  <p><strong>What is happening:</strong> ${esc(s.problem)}</p>
  <p><strong>What to do:</strong> ${esc(s.fix)}</p>
  ${code}
</div>`;
}

export function renderWorkspace(r: WorkspaceReport): string {
    const total = r.files.reduce((n, f) => n + f.analysis.totals.functionCount, 0);
    const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
    const worst: { f: FunctionAnalysis; file: string; uri: string }[] = [];
    for (const file of r.files) {
        for (const g of Object.keys(counts) as Grade[]) {
            counts[g] += file.analysis.totals.gradeCounts[g];
        }
        for (const f of file.analysis.functions) {
            if (!f.ignored && (f.rating.grade === 'C' || f.rating.grade === 'D')) {
                worst.push({ f, file: file.relativePath, uri: file.uri.toString() });
            }
        }
    }
    const order = { D: 0, C: 1, B: 2, A: 3 };
    worst.sort((a, b) => order[a.f.rating.grade] - order[b.f.rating.grade] || b.f.time.rank - a.f.time.rank || b.f.cognitive - a.f.cognitive);
    const overall: Grade = counts.D > 0 ? 'D' : counts.C > Math.max(2, total * 0.2) ? 'C' : counts.C > 0 ? 'B' : 'A';
    const rows = r.files
        .map(
            (f) => `<tr class="grade-row-${f.analysis.fileRating.grade}"><td>${gradeBadge(f.analysis.fileRating.grade)}</td><td><a class="file" data-uri="${esc(f.uri.toString())}">${esc(f.relativePath)}</a></td><td>${f.analysis.totals.functionCount}</td><td>${f.analysis.totals.gradeCounts.D}</td><td>${f.analysis.totals.gradeCounts.C}</td><td>${f.analysis.totals.maxCyclomatic}</td><td>${f.analysis.totals.maxCognitive}</td><td>${esc(f.analysis.totals.worstTime?.notation ?? 'O(1)')}</td></tr>`,
        )
        .join('');
    const hot = worst
        .slice(0, 30)
        .map((w) => `<li>${gradeBadge(w.f.rating.grade)} <a class="line" data-uri="${esc(w.uri)}" data-line="${w.f.nameLine}"><code>${esc(w.f.qualifiedName)}</code></a> <span class="muted">${esc(w.file)}:${w.f.nameLine + 1}</span> — ${esc(w.f.rating.summary)} <span class="mini">cyc ${w.f.cyclomatic} · cog ${w.f.cognitive} · ${esc(w.f.time.notation)}</span></li>`)
        .join('');
    return `
<header class="top">
  <div class="title-row">${gradeBadge(overall, true)}<div><h1>Workspace</h1><p class="muted">${r.files.length} files with functions · ${total} functions · ${r.scanned} files scanned, ${r.skipped} skipped · ${(r.durationMs / 1000).toFixed(1)} s${r.truncated ? ' · <span class="warn">file limit reached, raise codecomplexity.workspaceMaxFiles to scan more</span>' : ''}</p></div></div>
  <div class="chips"><span class="chip grade-A">${counts.A} excellent</span><span class="chip grade-B">${counts.B} good</span><span class="chip grade-C">${counts.C} need attention</span><span class="chip grade-D">${counts.D} poor</span></div>
  <div class="toolbar"><input id="filter" type="search" placeholder="Filter files…" aria-label="Filter files"><button class="btn" data-command="codecomplexity.explainMetrics">What do these numbers mean?</button><button class="btn" data-command="codecomplexity.analyzeWorkspace">Re-scan</button></div>
</header>
${legend()}
<main>
  <h2>Hot spots</h2>
  ${hot ? `<ol class="hot">${hot}</ol>` : '<p class="ok">✓ No function in the workspace needs attention.</p>'}
  <h2>Files</h2>
  <table class="files" id="files"><thead><tr><th>Grade</th><th>File</th><th>Functions</th><th>Poor</th><th>Attention</th><th>Max cyclomatic</th><th>Max cognitive</th><th>Worst time</th></tr></thead><tbody>${rows}</tbody></table>
</main>`;
}

export const REPORT_CSS = (): string => CSS;

const CSS = `
:root { --good:#2ea043; --mid:#2f81f7; --warn:#d29922; --bad:#f85149; }
* { box-sizing: border-box; }
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px 20px 40px; line-height: 1.5; }
h1 { margin: 0; font-size: 1.4em; } h2 { font-size: 1.15em; margin: 24px 0 8px; } h3 { font-size: 1em; margin: 16px 0 6px; }
code, pre { font-family: var(--vscode-editor-font-family); font-size: 0.92em; }
pre { background: var(--vscode-textCodeBlock-background); padding: 10px 12px; border-radius: 6px; overflow: auto; margin: 0; white-space: pre; }
a { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; } a:hover { text-decoration: underline; }
.muted { color: var(--vscode-descriptionForeground); } .warn { color: var(--warn); } .ok { color: var(--good); }
.top { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 12px; margin-bottom: 12px; }
.title-row { display: flex; gap: 14px; align-items: center; }
.summary { font-size: 1.05em; margin: 10px 0 6px; }
.badge { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 0.9em; flex: none; }
.badge.big { width: 52px; height: 52px; font-size: 1.6em; }
.grade-A.badge, .chip.grade-A { background: var(--good); } .grade-B.badge, .chip.grade-B { background: var(--mid); } .grade-C.badge, .chip.grade-C { background: var(--warn); color:#1b1b1b; } .grade-D.badge, .chip.grade-D { background: var(--bad); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chip { padding: 2px 10px; border-radius: 12px; font-size: 0.85em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.chip.grade-A, .chip.grade-B, .chip.grade-D { color: #fff; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.toolbar input { flex: 1 1 200px; min-width: 160px; padding: 5px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; }
.btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
.legend { margin: 8px 0 16px; padding: 8px 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
.legend summary { cursor: pointer; font-weight: 600; }
.legend-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 10px 0; }
.legend-item { display: flex; flex-direction: column; gap: 2px; } .legend-item em { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
.card { border: 1px solid var(--vscode-panel-border); border-left-width: 5px; border-radius: 6px; margin: 10px 0; background: var(--vscode-sideBar-background, transparent); }
.card.grade-A { border-left-color: var(--good); } .card.grade-B { border-left-color: var(--mid); } .card.grade-C { border-left-color: var(--warn); } .card.grade-D { border-left-color: var(--bad); }
.card.focused { box-shadow: 0 0 0 2px var(--vscode-focusBorder); }
.card > summary { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 12px; cursor: pointer; list-style: none; }
.card > summary::-webkit-details-marker { display: none; }
.fn-name code { font-size: 1.05em; font-weight: 600; }
.mini { margin-left: auto; font-size: 0.85em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
.card-body { padding: 0 14px 14px; }
.verdict { font-weight: 500; margin: 4px 0 6px; }
.reasons { margin: 0 0 8px; padding-left: 20px; color: var(--vscode-descriptionForeground); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 10px 0; }
.tile { padding: 8px 10px; border-radius: 6px; background: var(--vscode-editor-inactiveSelectionBackground); border-top: 3px solid var(--vscode-panel-border); }
.tile.good { border-top-color: var(--good); } .tile.warn { border-top-color: var(--warn); } .tile.bad { border-top-color: var(--bad); }
.tile-label { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.04em; color: var(--vscode-descriptionForeground); }
.tile-value { font-size: 1.5em; font-weight: 700; } .tile-hint { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.evidence { padding-left: 18px; margin: 4px 0; } .evidence li { margin: 3px 0; }
.suggestion { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 10px 12px; margin: 8px 0; }
.suggestion.bad { border-color: var(--bad); } .suggestion.warn { border-color: var(--warn); } .suggestion.focused { box-shadow: 0 0 0 2px var(--vscode-focusBorder); }
.sg-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.sev { font-size: 0.75em; text-transform: uppercase; padding: 1px 7px; border-radius: 10px; color: #fff; background: var(--mid); }
.sev.warn { background: var(--warn); color: #1b1b1b; } .sev.bad { background: var(--bad); }
.impact { font-family: var(--vscode-editor-font-family); background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 8px; border-radius: 10px; font-size: 0.85em; }
.before-after { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-top: 8px; }
.code-label { font-size: 0.8em; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 3px; }
.sub summary { cursor: pointer; color: var(--vscode-descriptionForeground); margin-top: 8px; }
table { border-collapse: collapse; width: 100%; margin-top: 6px; } th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); } th { color: var(--vscode-descriptionForeground); font-weight: 600; font-size: 0.85em; }
.hot { padding-left: 20px; } .hot li { margin: 6px 0; }
.empty { padding: 30px; text-align: center; color: var(--vscode-descriptionForeground); }
.hidden { display: none; }
`;

const SCRIPT = `
(function () {
  const vscode = acquireVsCodeApi();
  document.body.addEventListener('click', function (ev) {
    const t = ev.target.closest('[data-line], [data-command], .file');
    if (!t) return;
    if (t.dataset.command) { vscode.postMessage({ type: 'command', command: t.dataset.command }); ev.preventDefault(); return; }
    if (t.classList.contains('file')) { vscode.postMessage({ type: 'openFile', uri: t.dataset.uri }); ev.preventDefault(); return; }
    if (t.dataset.line !== undefined) { vscode.postMessage({ type: 'reveal', uri: t.dataset.uri, line: Number(t.dataset.line) }); ev.preventDefault(); ev.stopPropagation(); }
  });
  const filter = document.getElementById('filter');
  if (filter) {
    filter.addEventListener('input', function () {
      const q = filter.value.trim().toLowerCase();
      document.querySelectorAll('.card').forEach(function (c) { c.classList.toggle('hidden', q !== '' && c.dataset.name.indexOf(q) === -1); });
      document.querySelectorAll('#files tbody tr').forEach(function (r) { r.classList.toggle('hidden', q !== '' && r.textContent.toLowerCase().indexOf(q) === -1); });
    });
  }
  const focused = document.querySelector('.suggestion.focused') || document.querySelector('.card.focused');
  if (focused) { focused.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
})();
`;
