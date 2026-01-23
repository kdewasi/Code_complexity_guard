import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    packageInstalled?: boolean;
}

/**
 * Get Python path from configuration or use default
 */
function getPythonPath(): string {
    const config = vscode.workspace.getConfiguration('codecomplexity');
    return config.get<string>('pythonPath', 'python');
}

/**
 * Check if Python is available and codecomplexity package is installed
 */
export async function checkPythonSetup(): Promise<PythonSetupResult> {
    const pythonPath = getPythonPath();

    try {
        // Check if Python is available
        const { stdout: versionOutput } = await execAsync(`${pythonPath} --version`);

        // Check if codecomplexity package is installed
        try {
            const { stdout: packageOutput } = await execAsync(
                `${pythonPath} -m pip show codecomplexity`
            );

            return {
                valid: true,
                pythonPath: pythonPath,
                packageInstalled: true
            };
        } catch (packageError) {
            return {
                valid: false,
                error: 'codecomplexity package not installed',
                pythonPath: pythonPath,
                packageInstalled: false
            };
        }
    } catch (pythonError) {
        return {
            valid: false,
            error: `Python not found at: ${pythonPath}`,
            pythonPath: pythonPath,
            packageInstalled: false
        };
    }
}

/**
 * Analyze a Python file for complexity
 */
export async function analyzePythonFile(filepath: string): Promise<AnalysisResult> {
    const pythonPath = getPythonPath();

    try {
        const command = `${pythonPath} -m codecomplexity.cli analyze "${filepath}" --json`;
        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const result: AnalysisResult = JSON.parse(stdout);
        return result;
    } catch (error: any) {
        // Handle specific errors
        if (error.message.includes('SYNTAX ERROR')) {
            throw new Error(`Syntax error in Python file: ${error.message}`);
        } else if (error.message.includes('not found')) {
            throw new Error(`File not found: ${filepath}`);
        } else if (error.code === 'ENOENT') {
            throw new Error(`Python not found. Please check your Python path setting.`);
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

    try {
        const command = `${pythonPath} -m codecomplexity.cli suggest "${filepath}" --function "${functionName}" --json`;
        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        // For now, the CLI doesn't output JSON for suggest command
        // This is a placeholder for future implementation
        throw new Error('Suggestion command does not yet support JSON output');
    } catch (error: any) {
        if (error.message.includes('not found')) {
            throw new Error(`Function '${functionName}' not found in file`);
        } else if (error.code === 'ENOENT') {
            throw new Error(`Python not found. Please check your Python path setting.`);
        } else {
            throw new Error(`Failed to get suggestions: ${error.message}`);
        }
    }
}

/**
 * Install codecomplexity package
 */
export async function installCodeComplexity(): Promise<void> {
    const pythonPath = getPythonPath();

    try {
        await execAsync(`${pythonPath} -m pip install codecomplexity`);
    } catch (error: any) {
        throw new Error(`Failed to install codecomplexity: ${error.message}`);
    }
}
