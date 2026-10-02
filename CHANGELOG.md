# Changelog

All notable changes to **Code Complexity Guard** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-02

A complete rewrite. The extension no longer needs an AI API key, a Python installation or any external process.

### Added
- **12 languages**: Python, Java, JavaScript, TypeScript, JSX/TSX, Go, Rust, C, C++, C#, Ruby and PHP, each parsed with its official tree-sitter grammar (bundled as WebAssembly).
- **Estimated Big-O time and space** per function, derived from loop structure, loop-variable updates (`log n`, `√n`, constant ranges), known library costs, recursion recurrences (exponential, divide-and-conquer, structural, memoized) and same-file call graphs. Every estimate lists its evidence and a confidence level.
- **Cognitive complexity** (SonarSource rules) next to cyclomatic complexity, plus nesting depth, size and parameter count.
- **Grades A–D** with a plain-language verdict for every function and for the file.
- **17 pattern detectors** with language-specific before/after snippets: linear search in a loop, pair search in nested loops, string concatenation in a loop, exponential recursion, front removal/insertion in a loop, sorting in a loop, linear call in a loop condition, copies and regex compilation in loops, deep loop nesting, long if/else chains, deep nesting, validation chains, complex conditions, too many parameters, long functions, empty catch blocks and high cyclomatic complexity.
- **New UI**: CodeLens summaries above every function, rich hovers with evidence, grade gutter icons, Problems-panel diagnostics with quick fixes, a *Complexity Guard* activity-bar view listing functions worst-first, a redesigned Complexity Report dashboard, a workspace-wide scan with hot spots, a status-bar grade and a Get Started walkthrough.
- **Real-time analysis while typing** (debounced), including unsaved files; analysis runs in a worker thread so large files never block the editor.
- **CLI** (`dist/cli.js`) with JSON output and `--fail-on` for CI.
- `codecomplexity: ignore-file` marker; `codecomplexity: ignore` now works with any comment syntax.
- Support for untrusted and virtual workspaces.

### Changed
- Display name is now **Code Complexity Guard**. The extension identifier, settings namespace (`codecomplexity.*`) and command identifiers are unchanged, so existing settings keep working.
- Cyclomatic thresholds keep their defaults (8 / 15); cognitive thresholds (15 / 25) are new settings.
- The extension is bundled with esbuild into a single file plus the grammar binaries; the package no longer contains Python sources or unused dependencies.

### Removed
- The Claude / Anthropic SDK integration, the `codecomplexity.apiKey`, `aiModel`, `maxTokens` and `confirmBeforeRefactor` settings, and all network access.
- The Python engine, the `codecomplexity.pythonPath` setting, the "Install Python package" command and the shell execution it required.

### Fixed
- Command injection risk from passing file paths and the configured Python path through a shell.
- Webview content was rendered without a Content-Security-Policy and without escaping; the new report uses a strict CSP, nonces and full escaping.
- The `Report Issue` command was registered but not declared in the manifest.
- The extension icon was a JPEG with a `.png` extension.
- Analysis of unsaved buffers, files outside the workspace and files on virtual file systems.

## [0.1.3] - 2026-01-23

### Added
- Bundled Python engine (no `pip install` needed) and a "Report Issue" command.

## [0.1.0] - 2026-01-23

- Initial release: cyclomatic complexity for Python via an external Python package, optional AI refactoring.

[1.0.0]: https://github.com/kdewasi/Code_complexity_guard/releases/tag/v1.0.0
[0.1.3]: https://github.com/kdewasi/Code_complexity_guard/commit/4440716
[0.1.0]: https://github.com/kdewasi/Code_complexity_guard/commit/8155dc0
