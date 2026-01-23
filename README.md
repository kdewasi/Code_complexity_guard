# AI Code Quality Guard

> 🤖 Automatically analyze and refactor complex Python code with AI-powered suggestions

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=your-publisher.codecomplexity)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)

**AI Code Quality Guard** is a powerful VS Code extension that helps you write better Python code by analyzing complexity in real-time and providing intelligent refactoring suggestions powered by Claude AI.

![Demo](./assets/demo.gif)

---

## ✨ Features

### 🎯 Real-Time Complexity Analysis

Analyze your Python code as you type with instant visual feedback:

- **Cyclomatic complexity** calculation for every function
- **Color-coded decorations** (green/yellow/red) based on complexity levels
- **Gutter icons** showing complexity at a glance
- **Hover tooltips** with detailed breakdown

![Real-time Analysis](./assets/screenshots/realtime-analysis.png)

### 💡 Smart Code Actions (Light Bulb)

Get intelligent quick fixes right where you need them:

- **💡 Show Refactoring Suggestions** - View AI-powered recommendations
- **📊 View Complexity Breakdown** - See detailed decision points
- **🚫 Ignore This Warning** - Add ignore comments
- **⚙️ Configure Threshold** - Adjust complexity limits

![Code Actions](./assets/screenshots/code-actions.png)

### 🤖 AI-Powered Auto-Refactoring

Let Claude AI automatically refactor your complex code:

- **One-click refactoring** with Claude 3.5 Sonnet
- **Side-by-side diff view** to review changes
- **Safety validation** ensures code correctness
- **Complexity verification** guarantees improvement

![AI Refactoring](./assets/screenshots/ai-refactoring.png)

### 📊 Problems Panel Integration

See all complexity issues in one place:

- **Warning/Error severity** based on thresholds
- **Click to navigate** to problematic functions
- **Quick fixes** available from problems panel

![Suggestion Panel](./assets/screenshots/suggestion-panel.png)

---

## 🚀 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "AI Code Quality Guard"
4. Click **Install**

### Install Python Package

The extension requires the `codecomplexity` Python package:

```bash
pip install codecomplexity
```

### Optional: Set Up AI Refactoring

For AI-powered auto-refactoring, you'll need a Claude API key:

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to VS Code settings: `codecomplexity.apiKey`
3. Or set environment variable: `ANTHROPIC_API_KEY`

---

## 📋 Requirements

- **VS Code** 1.80.0 or higher
- **Python** 3.8 or higher
- **codecomplexity** Python package
- **Claude API key** (optional, only for AI refactoring)

---

## 🎯 Quick Start

### 1. Open a Python File

Open any Python file in VS Code. The extension activates automatically!

### 2. See Complexity Analysis

Save the file (`Ctrl+S`) to trigger analysis. You'll see:
- Colored decorations on complex functions
- Complexity scores in the gutter
- Issues in the Problems panel

### 3. Use Code Actions

Click on a complex function and look for the 💡 light bulb:
- Click the light bulb or press `Ctrl+.`
- Select an action to improve your code

### 4. Try AI Refactoring (Optional)

If you have an API key configured:
- Click "Auto-Refactor with AI"
- Review the changes in the diff view
- Accept or reject the refactoring

---

## ⚙️ Configuration

Access settings via `Ctrl+,` and search for "codecomplexity":

### Basic Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codecomplexity.pythonPath` | `"python"` | Path to Python interpreter |
| `codecomplexity.warningThreshold` | `8` | Complexity warning level |
| `codecomplexity.criticalThreshold` | `15` | Complexity error level |
| `codecomplexity.enableRealtime` | `true` | Enable real-time analysis |

### AI Settings (Optional)

| Setting | Default | Description |
|---------|---------|-------------|
| `codecomplexity.apiKey` | `""` | Claude API key |
| `codecomplexity.aiModel` | `"claude-3-5-sonnet-20241022"` | AI model to use |
| `codecomplexity.maxTokens` | `4000` | Max tokens per request |
| `codecomplexity.confirmBeforeRefactor` | `true` | Ask before API calls |

### Example Configuration

```json
{
  "codecomplexity.pythonPath": "python3",
  "codecomplexity.warningThreshold": 10,
  "codecomplexity.criticalThreshold": 20,
  "codecomplexity.enableRealtime": true,
  "codecomplexity.apiKey": "sk-ant-..."
}
```

---

## 📖 Understanding Complexity

**Cyclomatic complexity** measures the number of independent paths through code:

| Complexity | Rating | Recommendation |
|------------|--------|----------------|
| 1-5 | ✅ **Simple** | Low risk, easy to test |
| 6-10 | 🟡 **Moderate** | Medium risk, consider simplifying |
| 11-20 | 🟠 **Complex** | High risk, refactoring recommended |
| 21+ | 🔴 **Very Complex** | Very high risk, refactor immediately |

### What Increases Complexity?

Each of these adds +1 to complexity:
- `if`, `elif` statements
- `for`, `while` loops
- `and`, `or` operators
- `try`, `except` blocks
- `with` statements
- Ternary operators
- Comprehensions with conditions

---

## 💡 Usage Examples

### Example 1: Identify Complex Functions

**Before** (Complexity: 12):
```python
def process_order(order, user, config):
    if order is not None:
        if user.is_authenticated:
            if order.status == 'pending':
                if config.auto_approve:
                    if order.total < config.limit:
                        return approve_order(order)
    return None
```

The extension shows:
- 🟡 Yellow decoration
- Hover: "Complexity: 12 - Consider refactoring"
- Light bulb with suggestions

### Example 2: AI Refactoring

**After AI Refactoring** (Complexity: 4):
```python
def process_order(order, user, config):
    """Process order with validation."""
    if not _can_process_order(order, user, config):
        return None
    return approve_order(order)

def _can_process_order(order, user, config):
    """Check if order can be processed."""
    if order is None or not user.is_authenticated:
        return False
    if order.status != 'pending':
        return False
    return config.auto_approve and order.total < config.limit
```

**Result:** 67% complexity reduction! ✨

### Example 3: Ignore Warnings

```python
# codecomplexity: ignore
def legacy_function():
    # Complex but can't refactor yet
    ...
```

---

## 🔧 Commands

Access via Command Palette (`Ctrl+Shift+P`):

- **AI Code Quality Guard: Analyze current file** - Run full analysis
- **AI Code Quality Guard: Get refactoring suggestions** - Show suggestions

---

## 🐛 Troubleshooting

### Extension Not Activating

**Problem:** Extension doesn't start when opening Python files

**Solution:**
1. Check Python is installed: `python --version`
2. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
3. Check Output panel: View → Output → "AI Code Quality Guard"

### Python Package Not Found

**Problem:** "codecomplexity package not installed"

**Solution:**
```bash
pip install codecomplexity
# or
pip install --user codecomplexity
```

### Decorations Not Showing

**Problem:** No colored highlights on functions

**Solution:**
1. Save the file (`Ctrl+S`)
2. Check file is saved as `.py`
3. Check `codecomplexity.enableRealtime` is `true`
4. Check Output panel for errors

### AI Refactoring Not Working

**Problem:** "API key not configured"

**Solution:**
1. Get API key from https://console.anthropic.com/
2. Add to settings: `codecomplexity.apiKey`
3. Or set environment variable: `ANTHROPIC_API_KEY`

---

## ❓ FAQ

**Q: Does this work with other languages?**  
A: Currently Python only. Other languages may be added in future versions.

**Q: How much does AI refactoring cost?**  
A: Typically $0.01-0.05 per function using Claude 3.5 Sonnet.

**Q: Can I use this without the API key?**  
A: Yes! All features work except AI auto-refactoring. You still get analysis, decorations, and manual suggestions.

**Q: Is my code sent to the cloud?**  
A: Only when using AI refactoring. Regular analysis runs locally.

**Q: How accurate is the complexity calculation?**  
A: Very accurate - uses AST parsing, same method as professional tools.

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/codecomplexity.git
cd codecomplexity/codecomplexity-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run extension
# Press F5 in VS Code
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Anthropic** for Claude AI
- **VS Code team** for excellent extension API
- **Python community** for inspiration

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/codecomplexity/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/codecomplexity/discussions)
- **Documentation**: [Full Documentation](./docs/)

---

## 🗺️ Roadmap

- [ ] Support for more languages (JavaScript, TypeScript, Java)
- [ ] Team dashboards for complexity tracking
- [ ] Historical complexity trends
- [ ] Custom pattern detection
- [ ] Integration with CI/CD pipelines

---

**Made with ❤️ by developers, for developers**

[⭐ Star on GitHub](https://github.com/yourusername/codecomplexity) | [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=your-publisher.codecomplexity) | [📖 Documentation](./docs/)
