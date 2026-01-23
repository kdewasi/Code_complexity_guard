# Configuration Guide

Complete guide to configuring AI Code Quality Guard for your needs.

## Configuration Overview

All settings are accessed via VS Code Settings (`Ctrl+,`). Search for "codecomplexity" to see all options.

## Basic Settings

### Python Path

**Setting:** `codecomplexity.pythonPath`  
**Type:** string  
**Default:** `"python"`

Path to your Python interpreter.

**When to change:**
- Using a virtual environment
- Python not in PATH
- Multiple Python versions installed

**Examples:**

```json
{
  // System Python
  "codecomplexity.pythonPath": "python3",
  
  // Specific version
  "codecomplexity.pythonPath": "C:\\Python39\\python.exe",
  
  // Virtual environment (Windows)
  "codecomplexity.pythonPath": ".\\venv\\Scripts\\python.exe",
  
  // Virtual environment (macOS/Linux)
  "codecomplexity.pythonPath": "./venv/bin/python"
}
```

---

### Warning Threshold

**Setting:** `codecomplexity.warningThreshold`  
**Type:** number  
**Default:** `8`

Complexity level that triggers yellow warnings.

**Recommendations:**
- **Strict projects:** 6-7
- **Standard projects:** 8-10
- **Legacy code:** 12-15

**Example:**

```json
{
  "codecomplexity.warningThreshold": 10
}
```

**Effect:**
- Functions with complexity > threshold show yellow decoration
- Warning severity in Problems panel
- Light bulb appears for refactoring suggestions

---

### Critical Threshold

**Setting:** `codecomplexity.criticalThreshold`  
**Type:** number  
**Default:** `15`

Complexity level that triggers red errors.

**Recommendations:**
- **Strict projects:** 10-12
- **Standard projects:** 15-20
- **Legacy code:** 20-25

**Example:**

```json
{
  "codecomplexity.criticalThreshold": 20
}
```

**Effect:**
- Functions with complexity > threshold show red decoration
- Error severity in Problems panel
- Stronger refactoring recommendations

---

### Enable Real-time Analysis

**Setting:** `codecomplexity.enableRealtime`  
**Type:** boolean  
**Default:** `true`

Enable/disable automatic analysis on file save.

**When to disable:**
- Working on very large files
- Limited system resources
- Prefer manual analysis only

**Example:**

```json
{
  "codecomplexity.enableRealtime": false
}
```

**Note:** When disabled, use command "Analyze current file" to run analysis manually.

---

## AI Settings

### API Key

**Setting:** `codecomplexity.apiKey`  
**Type:** string  
**Default:** `""`

Your Claude API key for AI-powered refactoring.

**How to get:**
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create account or log in
3. Navigate to API Keys
4. Create new key
5. Copy key (starts with `sk-ant-`)

**Example:**

```json
{
  "codecomplexity.apiKey": "sk-ant-api03-..."
}
```

**Security:**
- Stored in VS Code secure storage
- Never committed to version control
- Can also use environment variable `ANTHROPIC_API_KEY`

**Alternative (Environment Variable):**

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-your-key"

# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-your-key"
```

---

### AI Model

**Setting:** `codecomplexity.aiModel`  
**Type:** string (enum)  
**Default:** `"claude-3-5-sonnet-20241022"`

Claude model to use for refactoring.

**Options:**
- `claude-3-5-sonnet-20241022` - **Recommended** - Best balance of speed and quality
- `claude-3-opus-20240229` - Highest quality, slower, more expensive
- `claude-3-sonnet-20240229` - Faster, less expensive, good quality

**Example:**

```json
{
  "codecomplexity.aiModel": "claude-3-opus-20240229"
}
```

**Cost comparison (per 1M tokens):**
- Sonnet 3.5: $3 input / $15 output
- Opus: $15 input / $75 output
- Sonnet 3: $3 input / $15 output

**Typical refactoring:** 500-2000 tokens = $0.01-0.05

---

### Max Tokens

**Setting:** `codecomplexity.maxTokens`  
**Type:** number  
**Default:** `4000`

Maximum tokens per AI refactoring request.

**Recommendations:**
- **Small functions:** 2000
- **Medium functions:** 4000 (default)
- **Large functions:** 8000

**Example:**

```json
{
  "codecomplexity.maxTokens": 2000
}
```

**Note:** Higher values = more detailed refactoring but higher cost.

---

### Confirm Before Refactor

**Setting:** `codecomplexity.confirmBeforeRefactor`  
**Type:** boolean  
**Default:** `true`

Ask for confirmation before calling Claude API.

**When to disable:**
- You trust the extension completely
- You want faster workflow
- You're okay with API costs

**Example:**

```json
{
  "codecomplexity.confirmBeforeRefactor": false
}
```

**Warning:** Disabling means API calls (and costs) happen automatically.

---

## Configuration Profiles

### Strict Quality Profile

For new projects with high quality standards:

```json
{
  "codecomplexity.warningThreshold": 6,
  "codecomplexity.criticalThreshold": 10,
  "codecomplexity.enableRealtime": true,
  "codecomplexity.aiModel": "claude-3-5-sonnet-20241022",
  "codecomplexity.confirmBeforeRefactor": true
}
```

### Balanced Profile

For most projects:

```json
{
  "codecomplexity.warningThreshold": 8,
  "codecomplexity.criticalThreshold": 15,
  "codecomplexity.enableRealtime": true,
  "codecomplexity.aiModel": "claude-3-5-sonnet-20241022",
  "codecomplexity.confirmBeforeRefactor": true
}
```

### Legacy Code Profile

For working with existing complex codebases:

```json
{
  "codecomplexity.warningThreshold": 12,
  "codecomplexity.criticalThreshold": 20,
  "codecomplexity.enableRealtime": true,
  "codecomplexity.aiModel": "claude-3-5-sonnet-20241022",
  "codecomplexity.confirmBeforeRefactor": true
}
```

### Performance Profile

For large files or limited resources:

```json
{
  "codecomplexity.warningThreshold": 8,
  "codecomplexity.criticalThreshold": 15,
  "codecomplexity.enableRealtime": false,
  "codecomplexity.maxTokens": 2000,
  "codecomplexity.confirmBeforeRefactor": true
}
```

---

## Workspace vs User Settings

### User Settings

Apply to all VS Code workspaces:

1. `Ctrl+,` → Settings
2. Make changes
3. Automatically saved to user settings

### Workspace Settings

Apply only to current project:

1. `Ctrl+,` → Settings
2. Switch to "Workspace" tab
3. Make changes
4. Saved to `.vscode/settings.json` in project

**Example workspace settings:**

```json
// .vscode/settings.json
{
  "codecomplexity.warningThreshold": 6,
  "codecomplexity.criticalThreshold": 10
}
```

**Tip:** Commit workspace settings to enforce team standards.

---

## Environment Variables

Alternative to VS Code settings:

```bash
# API Key
ANTHROPIC_API_KEY=sk-ant-your-key

# Python Path
CODECOMPLEXITY_PYTHON_PATH=/usr/bin/python3
```

**Priority:**
1. VS Code settings (highest)
2. Environment variables
3. Defaults (lowest)

---

## Configuration Tips

### Gradual Strictness

Start lenient, gradually tighten:

**Week 1:**
```json
{ "codecomplexity.warningThreshold": 15 }
```

**Week 2:**
```json
{ "codecomplexity.warningThreshold": 12 }
```

**Week 3:**
```json
{ "codecomplexity.warningThreshold": 10 }
```

### Team Consistency

Create `.vscode/settings.json` in your repository:

```json
{
  "codecomplexity.warningThreshold": 8,
  "codecomplexity.criticalThreshold": 15,
  "codecomplexity.enableRealtime": true
}
```

Commit this file so all team members use same thresholds.

### Per-Language Settings

VS Code supports language-specific settings:

```json
{
  "[python]": {
    "codecomplexity.warningThreshold": 8
  },
  "[javascript]": {
    "codecomplexity.warningThreshold": 10
  }
}
```

---

## Troubleshooting Configuration

### Settings not taking effect

1. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
2. Check for workspace settings overriding user settings
3. Verify JSON syntax in settings file

### Can't find settings

1. `Ctrl+,` to open Settings
2. Search for "codecomplexity"
3. All settings should appear

### API key not working

1. Verify key starts with `sk-ant-`
2. Check for extra spaces
3. Try environment variable instead
4. Verify key is active in Anthropic Console

---

## Advanced Configuration

### Custom Ignore Patterns

Add to Python files:

```python
# codecomplexity: ignore
def complex_function():
    # This won't trigger warnings
    pass
```

### Disable for Specific Files

Use workspace settings:

```json
{
  "files.exclude": {
    "**/legacy/**": true
  }
}
```

---

## See Also

- [Getting Started](./getting-started.md)
- [API Key Setup](./api-key-setup.md)
- [Complexity Explained](./complexity-explained.md)
- [Examples](./examples.md)
