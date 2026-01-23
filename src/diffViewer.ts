import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface DiffResult {
    accepted: boolean;
    refactoredCode?: string;
}

/**
 * Show diff view comparing original and refactored code
 */
export async function showDiff(
    originalCode: string,
    refactoredCode: string,
    functionName: string,
    originalComplexity: number,
    newComplexity: number
): Promise<DiffResult> {
    return new Promise(async (resolve) => {
        // Create temporary files
        const tempDir = os.tmpdir();
        const timestamp = Date.now();

        const originalPath = path.join(tempDir, `original_${timestamp}.py`);
        const refactoredPath = path.join(tempDir, `refactored_${timestamp}.py`);

        // Add complexity info as comments at the top
        const originalWithInfo = `# Original - Complexity: ${originalComplexity}\n# Function: ${functionName}\n\n${originalCode}`;
        const refactoredWithInfo = `# Refactored - Complexity: ${newComplexity}\n# Function: ${functionName}\n# Reduction: ${originalComplexity - newComplexity} (${Math.round((1 - newComplexity / originalComplexity) * 100)}%)\n\n${refactoredCode}`;

        fs.writeFileSync(originalPath, originalWithInfo);
        fs.writeFileSync(refactoredPath, refactoredWithInfo);

        const originalUri = vscode.Uri.file(originalPath);
        const refactoredUri = vscode.Uri.file(refactoredPath);

        // Open diff view
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            refactoredUri,
            `${functionName}: Original ↔ Refactored (${originalComplexity} → ${newComplexity})`
        );

        // Show action buttons
        const choice = await vscode.window.showInformationMessage(
            `Complexity reduced from ${originalComplexity} to ${newComplexity}. Accept refactoring?`,
            { modal: true },
            'Accept',
            'Reject',
            'Try Again'
        );

        // Clean up temp files
        try {
            fs.unlinkSync(originalPath);
            fs.unlinkSync(refactoredPath);
        } catch (error) {
            // Ignore cleanup errors
        }

        if (choice === 'Accept') {
            resolve({ accepted: true, refactoredCode: refactoredCode });
        } else if (choice === 'Try Again') {
            resolve({ accepted: false });
        } else {
            resolve({ accepted: false });
        }
    });
}

/**
 * Apply refactored code to editor
 */
export async function applyRefactoring(
    editor: vscode.TextEditor,
    functionStartLine: number,
    originalCode: string,
    refactoredCode: string
): Promise<void> {
    const document = editor.document;

    // Find the range of the original function
    const startLine = functionStartLine - 1; // Convert to 0-indexed

    // Count lines in original code
    const originalLines = originalCode.split('\n').length;
    const endLine = startLine + originalLines;

    // Create range
    const range = new vscode.Range(
        startLine,
        0,
        endLine,
        document.lineAt(Math.min(endLine, document.lineCount - 1)).text.length
    );

    // Apply edit
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, refactoredCode);

    await vscode.workspace.applyEdit(edit);

    // Save the document
    await document.save();
}

/**
 * Extract function code from document
 */
export function extractFunctionCode(
    document: vscode.TextDocument,
    functionLine: number
): string {
    const lines: string[] = [];
    const startLine = functionLine - 1; // Convert to 0-indexed

    // Get the function definition line
    const defLine = document.lineAt(startLine).text;
    const indent = defLine.match(/^\s*/)?.[0] || '';
    lines.push(defLine);

    // Get subsequent lines that are part of the function
    for (let i = startLine + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;

        // Empty line or comment - include it
        if (line.trim() === '' || line.trim().startsWith('#')) {
            lines.push(line);
            continue;
        }

        // Check indentation
        const lineIndent = line.match(/^\s*/)?.[0] || '';

        // If line has same or less indentation than function def, we're done
        if (lineIndent.length <= indent.length && line.trim() !== '') {
            break;
        }

        lines.push(line);
    }

    return lines.join('\n');
}
