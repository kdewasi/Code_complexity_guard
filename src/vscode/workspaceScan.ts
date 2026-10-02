/**
 * Analyses every supported file in the workspace (bounded, cancellable).
 */
import * as vscode from 'vscode';
import { FileAnalysis, languageFromFileName } from '../engine';
import { AnalysisService } from './analysisService';
import { getSettings } from './config';

export interface WorkspaceFileResult {
    uri: vscode.Uri;
    relativePath: string;
    analysis: FileAnalysis;
}

export interface WorkspaceReport {
    files: WorkspaceFileResult[];
    scanned: number;
    skipped: number;
    truncated: boolean;
    durationMs: number;
}

const GLOB = '**/*.{py,pyw,java,js,mjs,cjs,jsx,ts,mts,cts,tsx,go,rs,c,h,cc,cpp,cxx,hpp,hh,hxx,cs,rb,rake,php}';

export async function scanWorkspace(service: AnalysisService, progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<WorkspaceReport> {
    const settings = getSettings();
    const started = Date.now();
    const uris = await vscode.workspace.findFiles(GLOB, settings.workspaceExclude, settings.workspaceMaxFiles + 1, token);
    const truncated = uris.length > settings.workspaceMaxFiles;
    const list = uris.slice(0, settings.workspaceMaxFiles);
    const files: WorkspaceFileResult[] = [];
    let skipped = 0;
    const decoder = new TextDecoder('utf-8');
    const maxBytes = settings.maxFileSizeKB * 1024;
    for (let i = 0; i < list.length; i++) {
        if (token.isCancellationRequested) {
            break;
        }
        const uri = list[i];
        const languageId = languageFromFileName(uri.path);
        if (!languageId || (settings.enabledLanguages.length > 0 && !settings.enabledLanguages.some((l) => languageMatches(l, languageId)))) {
            skipped++;
            continue;
        }
        progress.report({ message: `${i + 1}/${list.length} ${vscode.workspace.asRelativePath(uri)}`, increment: 100 / list.length });
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            if (bytes.byteLength > maxBytes) {
                skipped++;
                continue;
            }
            const source = decoder.decode(bytes);
            const analysis = await service.analyzeText(source, languageId, { thresholds: settings.thresholds, maxChars: maxBytes });
            if (analysis.functions.length > 0) {
                files.push({ uri, relativePath: vscode.workspace.asRelativePath(uri), analysis });
            }
        } catch {
            skipped++;
        }
    }
    const order = { D: 0, C: 1, B: 2, A: 3 };
    files.sort((a, b) => order[a.analysis.fileRating.grade] - order[b.analysis.fileRating.grade] || b.analysis.totals.gradeCounts.D - a.analysis.totals.gradeCounts.D || b.analysis.totals.maxCyclomatic - a.analysis.totals.maxCyclomatic);
    return { files, scanned: list.length, skipped, truncated, durationMs: Date.now() - started };
}

function languageMatches(vscodeId: string, engineId: string): boolean {
    const map: Record<string, string> = { javascriptreact: 'tsx', typescriptreact: 'tsx', csharp: 'csharp', cpp: 'cpp' };
    return (map[vscodeId] ?? vscodeId) === engineId;
}
