# Changelog

All notable changes to the "AI Code Quality Guard" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-23

### Added

#### Core Features
- **Real-time complexity analysis** for Python files
- **Cyclomatic complexity calculation** using AST parsing
- **Visual decorations** with color-coded complexity indicators (green/yellow/red)
- **Gutter icons** showing complexity scores at a glance
- **Hover tooltips** with detailed complexity breakdown

#### Code Actions (Light Bulb)
- **💡 Show Refactoring Suggestions** - Opens WebView panel with AI-powered recommendations
- **📊 View Complexity Breakdown** - Displays decision points in output channel
- **🚫 Ignore This Warning** - Adds `# codecomplexity: ignore` comment
- **⚙️ Configure Complexity Threshold** - Opens settings for threshold adjustment

#### AI-Powered Refactoring
- **Claude AI integration** for automatic code refactoring
- **Side-by-side diff viewer** for reviewing changes before applying
- **Safety validation** ensures refactored code maintains functionality
- **Complexity verification** guarantees improvement after refactoring
- **Configurable AI models** (Claude 3.5 Sonnet, Opus, Sonnet)

#### Problems Panel Integration
- **Diagnostic collection** showing all complexity issues
- **Warning/Error severity levels** based on configurable thresholds
- **Click-to-navigate** to problematic functions
- **Quick fixes** available via right-click context menu

#### Pattern Detection
- **Validation chain detection** (3+ consecutive validation checks)
- **Nested loop detection** for performance optimization opportunities
- **Complex error handling** (3+ except handlers)
- **Long if/elif chains** (4+ branches) suggesting strategy pattern

#### Configuration
- **Python path configuration** for custom Python interpreters
- **Warning threshold** (default: 8) for moderate complexity
- **Critical threshold** (default: 15) for high complexity
- **Real-time analysis toggle** for performance control
- **API key configuration** for Claude AI (optional)
- **AI model selection** with multiple Claude versions
- **Token limit configuration** for API requests
- **Confirmation prompts** before AI API calls

#### Commands
- `codecomplexity.analyzeFile` - Analyze current Python file
- `codecomplexity.suggestRefactoring` - Get refactoring suggestions
- `codecomplexity.installPackage` - Install Python package helper
- `codecomplexity.showSuggestionsPanel` - Open suggestion WebView
- `codecomplexity.showBreakdown` - Show complexity breakdown
- `codecomplexity.ignoreWarning` - Add ignore comment
- `codecomplexity.configureThreshold` - Open threshold settings

#### Documentation
- Comprehensive README with examples and screenshots
- Quick start guide for immediate usage
- Configuration guide with all settings explained
- Troubleshooting section for common issues
- FAQ covering typical user questions
- API key setup instructions
- Complexity explanation and guidelines

#### Testing
- Extension activation tests
- Command registration verification
- Configuration change handling
- Python file analysis tests
- Code action provider tests
- Mock API tests (no real API keys)
- Error handling and edge case tests

### Technical Details
- **Language Support**: Python 3.8+
- **VS Code Version**: 1.80.0+
- **Dependencies**: 
  - `@anthropic-ai/sdk` for Claude AI integration
  - `codecomplexity` Python package for analysis
- **Architecture**:
  - TypeScript-based extension
  - Python CLI integration via child process
  - WebView panels for rich UI
  - Diagnostic collection for Problems panel
  - Code action provider for light bulb features

### Performance
- **Debounced analysis** to prevent excessive computation
- **Cached results** for improved responsiveness
- **Async operations** to prevent UI blocking
- **Configurable real-time analysis** for resource control

### Security
- **API key storage** in VS Code secure settings
- **Environment variable support** for API keys
- **No code sent to cloud** except during AI refactoring
- **User confirmation** before API calls (configurable)

### Known Limitations
- Python-only support (other languages planned for future)
- Requires Python and codecomplexity package installation
- AI refactoring requires Claude API key and internet connection
- Analysis accuracy depends on Python AST parsing

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- N/A (initial release)

---

## [Unreleased]

### Planned Features
- JavaScript/TypeScript support
- Java support
- Team complexity dashboards
- Historical complexity tracking
- Custom pattern detection
- CI/CD pipeline integration
- Complexity trend visualization
- Multi-file analysis
- Batch refactoring
- Custom refactoring rules

---

[0.1.0]: https://github.com/yourusername/codecomplexity/releases/tag/v0.1.0
[Unreleased]: https://github.com/yourusername/codecomplexity/compare/v0.1.0...HEAD
