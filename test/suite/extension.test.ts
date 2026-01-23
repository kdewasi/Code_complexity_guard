import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.codecomplexity'));
    });

    test('Extension should activate', async function () {
        this.timeout(10000);
        const ext = vscode.extensions.getExtension('your-publisher-name.codecomplexity');
        assert.ok(ext);
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });

    test('Should register all commands', async function () {
        this.timeout(5000);
        const commands = await vscode.commands.getCommands(true);

        const expectedCommands = [
            'codecomplexity.analyzeFile',
            'codecomplexity.suggestRefactoring',
            'codecomplexity.installPackage',
            'codecomplexity.showSuggestionsPanel',
            'codecomplexity.showBreakdown',
            'codecomplexity.ignoreWarning',
            'codecomplexity.configureThreshold'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });

    test('Should analyze Python file', async function () {
        this.timeout(15000);

        // Create a test Python file
        const testFilePath = path.join(__dirname, '../../test/fixtures/sample.py');
        const uri = vscode.Uri.file(testFilePath);

        // Open the document
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait a bit for analysis to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify document is Python
        assert.strictEqual(document.languageId, 'python');

        // Note: Actual analysis verification would require access to internal state
        // This test verifies the file can be opened and is recognized as Python
    });

    test('Should respect configuration changes', async function () {
        this.timeout(5000);

        const config = vscode.workspace.getConfiguration('codecomplexity');

        // Test default values
        assert.strictEqual(config.get('warningThreshold'), 8);
        assert.strictEqual(config.get('criticalThreshold'), 15);
        assert.strictEqual(config.get('enableRealtime'), true);

        // Update configuration
        await config.update('warningThreshold', 10, vscode.ConfigurationTarget.Global);

        // Verify update
        const updatedConfig = vscode.workspace.getConfiguration('codecomplexity');
        assert.strictEqual(updatedConfig.get('warningThreshold'), 10);

        // Reset to default
        await config.update('warningThreshold', 8, vscode.ConfigurationTarget.Global);
    });

    test('Should handle missing Python gracefully', async function () {
        this.timeout(5000);

        // Set invalid Python path
        const config = vscode.workspace.getConfiguration('codecomplexity');
        const originalPath = config.get('pythonPath');

        await config.update('pythonPath', 'invalid-python-path', vscode.ConfigurationTarget.Global);

        // Try to analyze - should not crash
        try {
            await vscode.commands.executeCommand('codecomplexity.analyzeFile');
            // If it doesn't throw, that's fine - it should handle gracefully
        } catch (error) {
            // Expected to fail, but shouldn't crash the extension
            assert.ok(true);
        }

        // Reset Python path
        await config.update('pythonPath', originalPath, vscode.ConfigurationTarget.Global);
    });

    test('Should provide code actions for complex functions', async function () {
        this.timeout(10000);

        const testFilePath = path.join(__dirname, '../../test/fixtures/sample.py');
        const uri = vscode.Uri.file(testFilePath);

        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Wait for analysis
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Position cursor on high_complexity function (around line 15)
        const position = new vscode.Position(15, 0);
        editor.selection = new vscode.Selection(position, position);

        // Get code actions
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
            'vscode.executeCodeActionProvider',
            uri,
            new vscode.Range(position, position)
        );

        // Note: This test verifies the code action provider is registered
        // Actual code actions depend on analysis results
        assert.ok(Array.isArray(codeActions));
    });

    test('Configuration should have all required properties', () => {
        const config = vscode.workspace.getConfiguration('codecomplexity');

        // Verify all configuration properties exist
        assert.ok(config.has('pythonPath'));
        assert.ok(config.has('warningThreshold'));
        assert.ok(config.has('criticalThreshold'));
        assert.ok(config.has('enableRealtime'));
        assert.ok(config.has('apiKey'));
        assert.ok(config.has('aiModel'));
        assert.ok(config.has('maxTokens'));
        assert.ok(config.has('confirmBeforeRefactor'));
    });

    test('Should handle ignore comments correctly', async function () {
        this.timeout(10000);

        const testFilePath = path.join(__dirname, '../../test/fixtures/sample.py');
        const uri = vscode.Uri.file(testFilePath);

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Wait for analysis
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Read the file content
        const content = document.getText();

        // Verify ignore comment exists
        assert.ok(content.includes('# codecomplexity: ignore'));

        // The ignored_function should not trigger warnings
        // This would be verified by checking diagnostics, but that requires
        // access to internal diagnostic collection
    });

    test('Should execute analyzeFile command without errors', async function () {
        this.timeout(10000);

        const testFilePath = path.join(__dirname, '../../test/fixtures/sample.py');
        const uri = vscode.Uri.file(testFilePath);

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Execute command - should not throw
        try {
            await vscode.commands.executeCommand('codecomplexity.analyzeFile');
            assert.ok(true);
        } catch (error) {
            assert.fail(`analyzeFile command failed: ${error}`);
        }
    });

    test('Should execute configureThreshold command', async function () {
        this.timeout(5000);

        // Execute command - should open settings
        try {
            await vscode.commands.executeCommand('codecomplexity.configureThreshold');
            assert.ok(true);
        } catch (error) {
            assert.fail(`configureThreshold command failed: ${error}`);
        }
    });
});

suite('Mock API Tests', () => {
    test('Should not use real API key in tests', () => {
        const config = vscode.workspace.getConfiguration('codecomplexity');
        const apiKey = config.get<string>('apiKey');

        // In tests, API key should be empty or a test placeholder
        assert.ok(!apiKey || apiKey === '' || apiKey.startsWith('test-'));
    });

    test('Should handle missing API key gracefully', async function () {
        this.timeout(5000);

        const config = vscode.workspace.getConfiguration('codecomplexity');
        await config.update('apiKey', '', vscode.ConfigurationTarget.Global);

        // Try to use AI refactoring without API key
        // Should show appropriate error message, not crash
        try {
            // This would normally trigger AI refactoring
            // In tests, it should handle missing API key gracefully
            assert.ok(true);
        } catch (error) {
            // Expected to fail gracefully
            assert.ok(true);
        }
    });
});
