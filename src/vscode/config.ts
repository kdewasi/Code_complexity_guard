import * as vscode from 'vscode';
import { Analyzer, LanguageId, Thresholds } from '../engine';

export const CONFIG_SECTION = 'codecomplexity';

export interface Settings {
    enableRealtime: boolean;
    analysisDelay: number;
    thresholds: Thresholds;
    showCodeLens: boolean;
    showDecorations: boolean;
    decorateHealthyFunctions: boolean;
    showDiagnostics: boolean;
    maxFileSizeKB: number;
    enabledLanguages: string[];
    workspaceExclude: string;
    workspaceMaxFiles: number;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(max, Math.max(min, n));
}

export function getSettings(): Settings {
    const c = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const warning = clampInt(c.get('warningThreshold'), 8, 1, 1000);
    const critical = Math.max(warning, clampInt(c.get('criticalThreshold'), 15, 1, 1000));
    const cogWarning = clampInt(c.get('cognitiveWarningThreshold'), 15, 1, 1000);
    const cogCritical = Math.max(cogWarning, clampInt(c.get('cognitiveCriticalThreshold'), 25, 1, 1000));
    const langs = c.get<string[]>('enabledLanguages');
    return {
        enableRealtime: c.get<boolean>('enableRealtime', true),
        analysisDelay: clampInt(c.get('analysisDelay'), 400, 100, 5000),
        thresholds: {
            cyclomaticWarning: warning,
            cyclomaticCritical: critical,
            cognitiveWarning: cogWarning,
            cognitiveCritical: cogCritical,
        },
        showCodeLens: c.get<boolean>('showCodeLens', true),
        showDecorations: c.get<boolean>('showDecorations', true),
        decorateHealthyFunctions: c.get<boolean>('decorateHealthyFunctions', true),
        showDiagnostics: c.get<boolean>('showDiagnostics', true),
        maxFileSizeKB: clampInt(c.get('maxFileSizeKB'), 1024, 16, 50000),
        enabledLanguages: Array.isArray(langs) ? langs.filter((l): l is string => typeof l === 'string') : [],
        workspaceExclude: typeof c.get('workspaceExclude') === 'string' ? (c.get('workspaceExclude') as string) : '**/{node_modules,.git,dist,build,out,target,vendor,venv,.venv,__pycache__,bin,obj}/**',
        workspaceMaxFiles: clampInt(c.get('workspaceMaxFiles'), 1500, 10, 100000),
    };
}

/** Engine language for a document, or undefined when the document is not analysable. */
export function languageOf(document: vscode.TextDocument, settings: Settings = getSettings()): LanguageId | undefined {
    if (document.uri.scheme === 'output' || document.uri.scheme === 'debug' || document.uri.scheme === 'vscode') {
        return undefined;
    }
    if (settings.enabledLanguages.length > 0 && !settings.enabledLanguages.includes(document.languageId)) {
        return undefined;
    }
    return Analyzer.languageFor(document.languageId, document.fileName);
}

export const SUPPORTED_VSCODE_LANGUAGES = [
    'python',
    'java',
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
    'go',
    'rust',
    'c',
    'cpp',
    'csharp',
    'ruby',
    'php',
];
