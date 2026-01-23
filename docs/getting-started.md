# Getting Started with AI Code Quality Guard

Welcome to AI Code Quality Guard! This guide will help you get up and running in minutes.

## Prerequisites

Before you begin, ensure you have:

- **VS Code** 1.80.0 or higher
- **Python** 3.8 or higher installed and in your PATH
- **pip** package manager

## Step 1: Install the Extension

### From VS Code Marketplace

1. Open VS Code
2. Click the Extensions icon in the sidebar (`Ctrl+Shift+X`)
3. Search for "AI Code Quality Guard"
4. Click **Install**

### From VSIX File

If you have a `.vsix` file:

```bash
code --install-extension codecomplexity-0.1.0.vsix
```

## Step 2: Install Python Package

The extension requires the `codecomplexity` Python package:

```bash
pip install codecomplexity
```

**Verify installation:**

```bash
codecomplexity --version
```

You should see: `codecomplexity 0.1.0`

## Step 3: Configure Python Path (Optional)

If Python is not in your PATH or you use a virtual environment:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "codecomplexity python"
3. Set `codecomplexity.pythonPath` to your Python executable

**Examples:**
- Windows: `C:\\Python39\\python.exe`
- macOS/Linux: `/usr/local/bin/python3`
- Virtual env: `./venv/bin/python`

## Step 4: Open a Python File

1. Open any Python file in VS Code
2. Save the file (`Ctrl+S`)
3. Watch the magic happen! ✨

You should see:
- Colored decorations on functions
- Complexity scores in the gutter
- Issues in the Problems panel (`Ctrl+Shift+M`)

## Step 5: Try the Features

### View Complexity

Hover over any function to see its complexity score and breakdown.

### Use Code Actions

1. Click on a complex function (yellow or red)
2. Look for the 💡 light bulb icon
3. Click it or press `Ctrl+.`
4. Select an action:
   - Show Refactoring Suggestions
   - View Complexity Breakdown
   - Ignore This Warning
   - Configure Threshold

### Check Problems Panel

1. Open Problems panel (`Ctrl+Shift+M`)
2. See all complexity issues listed
3. Click any issue to jump to that function
4. Right-click for quick fixes

## Step 6: Set Up AI Refactoring (Optional)

For AI-powered automatic refactoring:

### Get Claude API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Configure in VS Code

**Option 1: VS Code Settings**

1. Open Settings (`Ctrl+,`)
2. Search for "codecomplexity api"
3. Paste your API key in `codecomplexity.apiKey`

**Option 2: Environment Variable**

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"

# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

### Try AI Refactoring

1. Open a file with a complex function
2. Click the 💡 light bulb
3. Select "Auto-Refactor with AI"
4. Review the changes in the diff view
5. Accept or reject the refactoring

## Common First-Time Issues

### "codecomplexity package not installed"

**Solution:**
```bash
pip install codecomplexity
```

If using a virtual environment, activate it first:
```bash
# Windows
.\\venv\\Scripts\\activate

# macOS/Linux
source venv/bin/activate

pip install codecomplexity
```

### "Python not found"

**Solution:**
1. Verify Python is installed: `python --version`
2. Set Python path in settings: `codecomplexity.pythonPath`

### No decorations showing

**Solution:**
1. Save the file (`Ctrl+S`)
2. Check file has `.py` extension
3. Check `codecomplexity.enableRealtime` is `true`
4. Check Output panel for errors: View → Output → "AI Code Quality Guard"

### Extension not activating

**Solution:**
1. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
2. Check VS Code version is 1.80.0+
3. Check extension is enabled in Extensions panel

## Next Steps

Now that you're set up:

1. **Read the [Configuration Guide](./configuration.md)** to customize settings
2. **Check out [Examples](./examples.md)** to see refactoring in action
3. **Learn about [Complexity](./complexity-explained.md)** to understand the metrics
4. **Set up [API Key](./api-key-setup.md)** for AI features

## Quick Reference

### Keyboard Shortcuts

- `Ctrl+S` - Save and trigger analysis
- `Ctrl+.` - Open code actions (light bulb)
- `Ctrl+Shift+M` - Open Problems panel
- `Ctrl+,` - Open Settings

### Commands

- **Analyze File**: `Ctrl+Shift+P` → "AI Code Quality Guard: Analyze current file"
- **Get Suggestions**: `Ctrl+Shift+P` → "AI Code Quality Guard: Get refactoring suggestions"

### Complexity Levels

- 🟢 **1-5**: Simple, good code
- 🟡 **6-10**: Moderate, consider simplifying
- 🟠 **11-20**: Complex, refactoring recommended
- 🔴 **21+**: Very complex, refactor immediately

## Getting Help

- **Documentation**: Check the [docs](../) folder
- **Issues**: [GitHub Issues](https://github.com/yourusername/codecomplexity/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/codecomplexity/discussions)

---

**Congratulations! You're ready to write better code!** 🎉
