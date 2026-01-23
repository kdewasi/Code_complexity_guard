# Contributing to AI Code Quality Guard

Thank you for your interest in contributing to AI Code Quality Guard! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**When reporting a bug, include:**
- VS Code version
- Python version
- Extension version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Error messages from Output panel

**Submit bugs at:** https://github.com/yourusername/codecomplexity/issues

### Suggesting Features

We welcome feature suggestions! Please:
- Check if the feature has already been suggested
- Clearly describe the feature and its benefits
- Provide examples of how it would be used
- Consider implementation complexity

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly**
5. **Commit with clear messages** (`git commit -m 'Add amazing feature'`)
6. **Push to your fork** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- VS Code 1.80.0+
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/yourusername/codecomplexity.git
cd codecomplexity

# Install Python package in development mode
cd CCG
pip install -e .
pip install -r requirements-dev.txt

# Install VS Code extension dependencies
cd ../codecomplexity-vscode
npm install

# Compile TypeScript
npm run compile
```

### Running the Extension

1. Open `codecomplexity-vscode` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Open a Python file to test

### Running Tests

```bash
# Python package tests
cd CCG
pytest

# VS Code extension tests
cd codecomplexity-vscode
npm test
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Follow VS Code extension best practices
- Use async/await for asynchronous operations
- Add JSDoc comments for public APIs
- Use meaningful variable names

**Example:**
```typescript
/**
 * Analyzes a Python file for complexity.
 * @param filePath Path to the Python file
 * @returns Analysis results with complexity metrics
 */
async function analyzeFile(filePath: string): Promise<AnalysisResult> {
    // Implementation
}
```

### Python

- Follow PEP 8 style guide
- Use type hints
- Add docstrings for all public functions
- Use meaningful variable names
- Keep functions focused and small

**Example:**
```python
def calculate_complexity(node: ast.FunctionDef) -> tuple[int, list[DecisionPoint]]:
    """
    Calculate cyclomatic complexity for a function.
    
    Args:
        node: AST node representing the function
        
    Returns:
        Tuple of (complexity score, list of decision points)
    """
    # Implementation
```

### Formatting

```bash
# Python
black src/
flake8 src/

# TypeScript
# VS Code will auto-format on save if configured
```

## Project Structure

```
codecomplexity/
├── CCG/                          # Python package
│   ├── src/codecomplexity/
│   │   ├── analyzers/           # Complexity analysis
│   │   ├── refactoring/         # Pattern detection
│   │   ├── cli.py               # Command-line interface
│   │   └── tests/               # Python tests
│   └── setup.py
│
└── codecomplexity-vscode/       # VS Code extension
    ├── src/
    │   ├── extension.ts         # Main extension
    │   ├── codeActionProvider.ts
    │   ├── suggestionPanel.ts
    │   ├── aiRefactor.ts
    │   └── ...
    ├── test/                    # Extension tests
    └── package.json
```

## Testing Guidelines

### Python Tests

- Test all complexity calculations
- Test pattern detection
- Test edge cases
- Aim for 90%+ coverage

### Extension Tests

- Test extension activation
- Test all commands
- Test configuration changes
- Test error handling
- Mock external dependencies (API calls)

## Documentation

When adding features:
- Update README.md
- Update CHANGELOG.md
- Add JSDoc/docstrings
- Update configuration docs if adding settings
- Add examples if applicable

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add support for JavaScript analysis
fix: Correct complexity calculation for nested loops
docs: Update API key setup instructions
test: Add tests for code action provider
refactor: Simplify decoration manager logic
```

**Prefixes:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Tests
- `refactor:` Code refactoring
- `perf:` Performance improvement
- `chore:` Maintenance tasks

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag (`git tag v0.2.0`)
4. Push tag (`git push origin v0.2.0`)
5. Create GitHub release
6. Publish to VS Code Marketplace (`vsce publish`)
7. Publish Python package (`python setup.py sdist upload`)

## Questions?

- Open a discussion on GitHub
- Check existing documentation
- Review closed issues for similar questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to AI Code Quality Guard!** 🎉
