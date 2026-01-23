# Quick Start Guide - Testing the VS Code Extension

## Problem: F5 Doesn't Work

F5 only works when you have the **extension project** open in VS Code, not the Python package.

## Solution: Open the Extension Project

### Step 1: Open Extension Folder in VS Code

**Option A: From Current VS Code Window**
1. File → Open Folder
2. Navigate to: `d:\College\AI Code Complexity Guard\codecomplexity-vscode`
3. Click "Select Folder"

**Option B: From Terminal**
```bash
cd "d:\College\AI Code Complexity Guard\codecomplexity-vscode"
code .
```

**Option C: From Windows Explorer**
1. Navigate to `d:\College\AI Code Complexity Guard\codecomplexity-vscode`
2. Right-click in folder
3. Select "Open with Code"

### Step 2: Verify You're in the Right Folder

Check the VS Code window title - it should show:
```
codecomplexity-vscode - Visual Studio Code
```

Also check the Explorer sidebar - you should see:
- `.vscode/`
- `node_modules/`
- `out/`
- `src/`
- `package.json`
- `tsconfig.json`

### Step 3: Launch Extension Development Host

Now F5 should work! Try one of these methods:

**Method 1: Keyboard**
- Press `F5`

**Method 2: Run Menu**
1. Click `Run` → `Start Debugging`

**Method 3: Run View**
1. Click the Run icon in the sidebar (play button with bug)
2. Click the green play button at the top
3. Select "Run Extension" from dropdown

**Method 4: Command Palette**
1. Press `Ctrl+Shift+P`
2. Type: "Debug: Start Debugging"
3. Press Enter

### Step 4: What Should Happen

1. **Compilation**: TypeScript compiles (if needed)
2. **New Window Opens**: "Extension Development Host" window appears
3. **Extension Loads**: Your extension is active in the new window

### Step 5: Test the Extension

In the **Extension Development Host** window:

1. **Create a Python file**:
   - File → New File
   - Type some Python code
   - Save as `test.py`

2. **You should see**:
   - Notification: "AI Code Quality Guard activated!"

3. **Test commands**:
   - Press `Ctrl+Shift+P`
   - Type: "AI Code Quality Guard"
   - You should see both commands

## Troubleshooting

### "No configuration found"
- Make sure `.vscode/launch.json` exists
- Verify you're in the `codecomplexity-vscode` folder

### "Cannot find module 'vscode'"
- Run: `npm install` in the extension folder
- Then try F5 again

### Extension doesn't activate
- Open a `.py` file in the Extension Development Host
- Check Debug Console for errors

### Still not working?
Try this sequence:
1. Close VS Code completely
2. Open terminal
3. Run:
   ```bash
   cd "d:\College\AI Code Complexity Guard\codecomplexity-vscode"
   npm install
   npm run compile
   code .
   ```
4. Press F5

## Quick Reference

**Current folder**: `d:\College\AI Code Complexity Guard\CCG` (Python package)
**Extension folder**: `d:\College\AI Code Complexity Guard\codecomplexity-vscode` (VS Code extension)

You need to be in the **extension folder** to test the extension!
