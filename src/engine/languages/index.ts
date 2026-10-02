import { LanguageId } from '../types';
import { LanguageSpec } from './spec';
import { python } from './python';
import { java } from './java';
import { javascript, typescript, tsx } from './javascript';
import { go } from './go';
import { rust } from './rust';
import { c, cpp } from './c';
import { csharp } from './csharp';
import { ruby } from './ruby';
import { php } from './php';

export const LANGUAGES: Record<LanguageId, LanguageSpec> = {
    python,
    java,
    javascript,
    typescript,
    tsx,
    go,
    rust,
    c,
    cpp,
    csharp,
    ruby,
    php,
};

/** Maps VS Code language identifiers (and common aliases) to engine language ids. */
const VSCODE_IDS: Record<string, LanguageId> = {
    python: 'python',
    java: 'java',
    javascript: 'javascript',
    javascriptreact: 'tsx',
    typescript: 'typescript',
    typescriptreact: 'tsx',
    go: 'go',
    rust: 'rust',
    c: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    csharp: 'csharp',
    'c#': 'csharp',
    ruby: 'ruby',
    php: 'php',
    js: 'javascript',
    jsx: 'tsx',
    ts: 'typescript',
    py: 'python',
    rs: 'rust',
    rb: 'ruby',
    cs: 'csharp',
};

const EXTENSIONS: Record<string, LanguageId> = {
    '.py': 'python',
    '.pyw': 'python',
    '.java': 'java',
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.jsx': 'tsx',
    '.ts': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.tsx': 'tsx',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.h': 'c',
    '.cc': 'cpp',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.hpp': 'cpp',
    '.hh': 'cpp',
    '.hxx': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.rake': 'ruby',
    '.php': 'php',
};

export function languageFromVsCodeId(id: string): LanguageId | undefined {
    return VSCODE_IDS[id.toLowerCase()];
}

export function languageFromFileName(fileName: string): LanguageId | undefined {
    const m = fileName.toLowerCase().match(/\.[a-z0-9+]+$/);
    return m ? EXTENSIONS[m[0]] : undefined;
}

export function getSpec(id: LanguageId): LanguageSpec {
    return LANGUAGES[id];
}

export const SUPPORTED_LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];
export { LanguageSpec };
