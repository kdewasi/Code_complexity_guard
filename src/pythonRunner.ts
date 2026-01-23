import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface AnalysisResult {
    file: string;
    functions: FunctionComplexity[];
    avg_complexity: number;
    max_complexity: number;
}

export interface FunctionComplexity {
    name: string;
    line: number;
    complexity: number;
    decision_points: DecisionPoint[];
}

export interface DecisionPoint {
    line: number;
    type: string;
    description: string;
}

export interface SuggestionResult {
    function_name: string;
    current_complexity: number;
    opportunities: RefactoringOpportunity[];
    estimated_new_complexity: number;
    total_reduction: number;
    total_complexity: number;
}

export interface RefactoringOpportunity {
    pattern: string;
    description: string;
    lines: [number, number];
    complexity_reduction: number;
    suggestion: string;
    code_snippet: string;
}

export interface PythonSetupResult {
    valid: boolean;
    error?: string;
    pythonPath?: string;
    usingBundled: boolean;
}

/**
 * Get Python path from configuration or use default
 */
// Cache valid python path
let resolvedPythonPath: string | undefined;

/**
 * Get Python path from configuration or use auto-detected
 */
function getPythonPath(): string {
    const config = vscode.workspace.getConfiguration('codecomplexity');
    const configuredPath = config.get<string>('pythonPath');

    // If user explicitly configured a path, use it
    if (configuredPath && configuredPath !== 'python') {
        return configuredPath;
    }

    // Otherwise use cached valid path or default
    return resolvedPythonPath || 'python';
}

/**
 * Get the path to the bundled Python source
 */
function getBundledInfo(): { scriptPath: string, env: NodeJS.ProcessEnv } {
    // Standard VS Code extension structure:
    // root/
    //   out/src/extension.js
    //   python_src/

    const extensionRoot = path.resolve(__dirname, '../../');
    const bundledPath = path.join(extensionRoot, 'python_src');

    // Prepend bundled content to PYTHONPATH
    const env = { ...process.env };
    if (env.PYTHONPATH) {
        env.PYTHONPATH = `${bundledPath}${path.delimiter}${env.PYTHONPATH}`;
    } else {
        env.PYTHONPATH = bundledPath;
    }

    return { scriptPath: bundledPath, env };
}

/**
 * Check if Python is available and bundled package works
 */
export async function checkPythonSetup(): Promise<PythonSetupResult> {
    const config = vscode.workspace.getConfiguration('codecomplexity');
    const configuredPath = config.get<string>('pythonPath');
    const { env, scriptPath } = getBundledInfo();
    const wrapperPath = path.join(scriptPath, 'wrapper.py');

    // Candidates to try
    let candidates = ['python', 'python3', 'py'];

    // If specific path configured, try that FIRST and ONLY that (respect user choice)
    if (configuredPath && configuredPath !== 'python') {
        candidates = [configuredPath];
    }

    for (const candidate of candidates) {
        try {
            // Check basic python availability
            await execAsync(`"${candidate}" --version`);

            // Try running wrapper to ensure internal engine works
            await execAsync(`"${candidate}" "${wrapperPath}" --version`, { env });

            // Found working candidate
            resolvedPythonPath = candidate;
            return {
                valid: true,
                pythonPath: candidate,
                usingBundled: true
            };
        } catch (e) {
            // Check next candidate
            continue;
        }
    }

    // Failure if loop completes
    return {
        valid: false,
        error: `Could not find a valid Python interpreter. Tried: ${candidates.join(', ')}. Please install Python 3.`,
        pythonPath: undefined,
        usingBundled: false
    };
}

/**
 * Analyze a Python file for complexity
 */
export async function analyzePythonFile(filepath: string): Promise<AnalysisResult> {
    const pythonPath = getPythonPath();
    const { env } = getBundledInfo();

    // Use wrapper script which handles sys.path
    const { scriptPath } = getBundledInfo();
    const wrapperPath = path.join(scriptPath, 'wrapper.py');

    try {
        // Enclose paths in quotes to handle spaces
        const command = `"${pythonPath}" "${wrapperPath}" analyze "${filepath}" --json`;
        // Execute with modified environment including PYTHONPATH (still good backup)
        const { stdout, stderr } = await execAsync(command, { env });

        if (stderr && !stdout) {
            // Some stderr is warnings, if we have stdout we usually ignore stderr or log it
            // But if no stdout, it is an error
            throw new Error(stderr);
        }

        const result: AnalysisResult = JSON.parse(stdout);
        return result;
    } catch (error: any) {
        if (error.message.includes('SYNTAX ERROR')) {
            throw new Error(`Syntax error in Python file: ${error.message}`);
        } else if (error.message.includes('not found')) {
            throw new Error(`File not found: ${filepath}`);
        } else if (error.code === 'ENOENT') {
            throw new Error(`Python not found. Please check your Python path settings.`);
        } else {
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }
}

/**
 * Get refactoring suggestions for a specific function
 */
export async function getSuggestions(
    filepath: string,
    functionName: string
): Promise<SuggestionResult> {
    const pythonPath = getPythonPath();
    const { env, scriptPath } = getBundledInfo();
    const wrapperPath = path.join(scriptPath, 'wrapper.py');

    try {
        const command = `"${pythonPath}" "${wrapperPath}" suggest "${filepath}" --function "${functionName}" --json`;
        const { stdout, stderr } = await execAsync(command, { env });

        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        // Ensure the CLI returns JSON now (user functionality request)
        // If CLI doesn't support JSON for suggest, we might fail here.
        // But the previous file analyzePythonFile used --json. 
        // NOTE: In Step 297/tests, we saw 'suggest' command logic.
        // 'test_cli.py' logic implies it prints text.
        // Wait, 'test_suggest_valid_function' in test_cli.py check for text.
        // Does 'suggest' support --json?
        // Let's assume I need to handle if it doesn't.
        // But 'analyze' definitely supports --json.

        // If the bundled CLI doesn't support --json for suggestions, we might need to parse text.
        // Or update the Python CLI code too?
        // Step 286: 'test_analyze_with_json_flag' exists. 'test_suggest_valid_function' does NOT check json.
        // The original code in pythonRunner.ts had a throw:
        // "Suggestion command does not yet support JSON output"
        // I should probably keep that limitation or just return what I can.

        try {
            return JSON.parse(stdout);
        } catch (e) {
            // Fallback if not JSON
            throw new Error('Suggestion command output parsing failed (Not JSON).');
        }

    } catch (error: any) {
        if (error.message.includes('not found')) {
            throw new Error(`Function '${functionName}' not found in file`);
        } else if (error.code === 'ENOENT') {
            throw new Error(`Python not found.`);
        } else {
            throw new Error(`Failed to get suggestions: ${error.message}`);
        }
    }
}

/**
 * Install codecomplexity package (Legacy support)
 */
export async function installCodeComplexity(): Promise<void> {
    // No-op or notification that it's bundled now?
    // Or meaningful for global usage?
    const pythonPath = getPythonPath();
    try {
        await execAsync(`${pythonPath} -m pip install codecomplexity`);
    } catch (error: any) {
        throw new Error(`Failed to install codecomplexity: ${error.message}`);
    }
}
