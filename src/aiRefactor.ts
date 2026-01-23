import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import * as pythonRunner from './pythonRunner';

export interface RefactoredCode {
    code: string;
    originalComplexity: number;
    newComplexity: number;
    tokensUsed: number;
}

let apiCallCount = 0;
let totalTokensUsed = 0;

/**
 * Get API key from configuration or environment
 */
function getApiKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('codecomplexity');
    const apiKey = config.get<string>('apiKey');

    if (apiKey) {
        return apiKey;
    }

    // Try environment variable
    return process.env.ANTHROPIC_API_KEY;
}

/**
 * Check if API is configured
 */
export function isApiConfigured(): boolean {
    return !!getApiKey();
}

/**
 * Get usage statistics
 */
export function getUsageStats(): { calls: number; tokens: number } {
    return {
        calls: apiCallCount,
        tokens: totalTokensUsed
    };
}

/**
 * Reset usage statistics
 */
export function resetUsageStats(): void {
    apiCallCount = 0;
    totalTokensUsed = 0;
}

/**
 * Refactor a function using Claude API
 */
export async function refactorFunction(
    sourceCode: string,
    functionName: string,
    currentComplexity: number,
    suggestions: string[]
): Promise<RefactoredCode> {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error('Claude API key not configured. Please set codecomplexity.apiKey in settings or ANTHROPIC_API_KEY environment variable.');
    }

    const client = new Anthropic({
        apiKey: apiKey
    });

    // Get configuration
    const config = vscode.workspace.getConfiguration('codecomplexity');
    const model = config.get<string>('aiModel', 'claude-3-5-sonnet-20241022');
    const maxTokens = config.get<number>('maxTokens', 4000);
    const targetThreshold = config.get<number>('warningThreshold', 8);

    // Construct prompt
    const prompt = buildRefactoringPrompt(
        sourceCode,
        functionName,
        currentComplexity,
        suggestions,
        targetThreshold
    );

    try {
        // Call Claude API
        const response = await client.messages.create({
            model: model,
            max_tokens: maxTokens,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        // Track usage
        apiCallCount++;
        const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        totalTokensUsed += tokensUsed;

        // Extract code from response
        const refactoredCode = extractCodeFromResponse(response);

        // Validate syntax
        await validatePythonSyntax(refactoredCode);

        // Analyze new complexity
        const newComplexity = await analyzeRefactoredComplexity(refactoredCode, functionName);

        // Verify complexity was reduced
        if (newComplexity >= currentComplexity) {
            throw new Error(`Refactoring did not reduce complexity (${currentComplexity} → ${newComplexity})`);
        }

        return {
            code: refactoredCode,
            originalComplexity: currentComplexity,
            newComplexity: newComplexity,
            tokensUsed: tokensUsed
        };

    } catch (error: any) {
        if (error.status === 401) {
            throw new Error('Invalid API key. Please check your configuration.');
        } else if (error.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
        } else if (error.message) {
            throw error;
        } else {
            throw new Error(`API error: ${error}`);
        }
    }
}

/**
 * Build refactoring prompt for Claude
 */
function buildRefactoringPrompt(
    sourceCode: string,
    functionName: string,
    currentComplexity: number,
    suggestions: string[],
    targetThreshold: number
): string {
    const suggestionsText = suggestions.length > 0
        ? suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : 'Reduce nesting and extract helper functions where appropriate.';

    return `You are a Python code refactoring expert. Your task is to refactor the following function to reduce its cyclomatic complexity.

**Function to Refactor:**
\`\`\`python
${sourceCode}
\`\`\`

**Current Complexity:** ${currentComplexity}
**Target Complexity:** Under ${targetThreshold}

**Refactoring Suggestions:**
${suggestionsText}

**Requirements:**
1. Reduce cyclomatic complexity to under ${targetThreshold}
2. Maintain EXACT same functionality - do not change behavior
3. Keep the same function signature (name and parameters)
4. Add clear docstrings if missing
5. Follow Python best practices (PEP 8)
6. Extract helper functions if needed
7. Use early returns to reduce nesting
8. Simplify conditional logic where possible

**Important:**
- Return ONLY the refactored Python code
- Include any helper functions you create
- Do NOT include explanations, markdown formatting, or code fences
- The code should be ready to paste directly into a Python file

Refactored code:`;
}

/**
 * Extract code from Claude's response
 */
function extractCodeFromResponse(response: any): string {
    const content = response.content[0].text;

    // Remove markdown code fences if present
    let code = content.trim();

    // Remove ```python and ``` if present
    code = code.replace(/^```python\s*/i, '');
    code = code.replace(/^```\s*/i, '');
    code = code.replace(/\s*```$/i, '');

    return code.trim();
}

/**
 * Validate Python syntax
 */
async function validatePythonSyntax(code: string): Promise<void> {
    // Create a temporary file
    const tempFile = await vscode.workspace.openTextDocument({
        content: code,
        language: 'python'
    });

    // Try to parse it using Python
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        // Write to temp file and validate
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        const tempPath = path.join(os.tmpdir(), `refactored_${Date.now()}.py`);
        fs.writeFileSync(tempPath, code);

        const config = vscode.workspace.getConfiguration('codecomplexity');
        const pythonPath = config.get<string>('pythonPath', 'python');

        await execAsync(`${pythonPath} -m py_compile "${tempPath}"`);

        // Clean up
        fs.unlinkSync(tempPath);

    } catch (error: any) {
        throw new Error(`Refactored code has syntax errors: ${error.message}`);
    }
}

/**
 * Analyze complexity of refactored code
 */
async function analyzeRefactoredComplexity(code: string, functionName: string): Promise<number> {
    // Create temporary file
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tempPath = path.join(os.tmpdir(), `refactored_${Date.now()}.py`);
    fs.writeFileSync(tempPath, code);

    try {
        const result = await pythonRunner.analyzePythonFile(tempPath);

        // Find the function
        const func = result.functions.find(f => f.name === functionName);

        if (!func) {
            throw new Error(`Function '${functionName}' not found in refactored code`);
        }

        // Clean up
        fs.unlinkSync(tempPath);

        return func.complexity;

    } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        throw error;
    }
}

/**
 * Estimate cost of refactoring
 */
export function estimateCost(sourceCode: string): { tokens: number; cost: number } {
    // Rough estimate: ~1.5 tokens per character for input
    // Output is usually similar size
    const inputTokens = Math.ceil(sourceCode.length * 1.5);
    const outputTokens = inputTokens; // Estimate same size
    const totalTokens = inputTokens + outputTokens;

    // Claude 3.5 Sonnet pricing (as of 2024):
    // Input: $3 per million tokens
    // Output: $15 per million tokens
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    return {
        tokens: totalTokens,
        cost: totalCost
    };
}
