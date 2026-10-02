# Getting started

## Install

1. Open VS Code, press `Ctrl+Shift+X` (Extensions).
2. Search for **Code Complexity Guard** and click **Install**.

That is all. There is nothing else to install: no Python, no account, no API key.

Alternatively, install a downloaded package: `code --install-extension codecomplexity-1.0.1.vsix`.

## First look

Open any file in a supported language (Python, Java, JavaScript, TypeScript, JSX/TSX, Go, Rust, C, C++, C#, Ruby, PHP). Within a second you will see:

- a **summary line above every function** (CodeLens) with the grade, cyclomatic and cognitive complexity, and estimated time and space;
- a **coloured icon in the gutter** next to each function;
- entries in the **Problems panel** (`Ctrl+Shift+M`) for functions that need attention;
- the **Complexity Guard** view in the activity bar listing all functions, worst first;
- the file's grade in the **status bar**.

## Read a function

Hover the function name. The hover explains every number in plain language and lists, line by line, why the function got its Big-O estimate.

Click the CodeLens line, press `Ctrl+.` on the function, or run **Complexity Guard: Open Complexity Report** to open the dashboard. Each function card shows:

- the verdict and the reasons behind the grade,
- the five tiles (cyclomatic, cognitive, time, extra memory, size),
- the evidence for the time and memory estimates with clickable line numbers,
- suggestions with *what is happening*, *what to do*, the expected effect, and before/after code in your language,
- the full list of decision points.

## Scan a project

Run **Complexity Guard: Analyze Whole Workspace** (also available from the view's title bar). The report lists hot spots across the project and a per-file table. Use `codecomplexity.workspaceExclude` and `codecomplexity.workspaceMaxFiles` to control the scan.

## Silence a function

Add a comment on the line above the function:

```python
# codecomplexity: ignore
def legacy_parser(data):
```

The function is still analysed, but it is no longer flagged. `codecomplexity: ignore-file` in the first five lines skips the whole file.

## Use it in CI

The same engine runs from the command line:

```bash
npm install && npm run build
node dist/cli.js src/ --fail-on C
```

See the [README](../README.md#command-line--ci) for all options.

## Troubleshooting

- **Nothing appears**: check the language is in `codecomplexity.enabledLanguages` and the file is under `codecomplexity.maxFileSizeKB`. Open *View → Output → Complexity Guard* for messages.
- **CodeLens is distracting**: run *Complexity Guard: Toggle Inline Summaries (CodeLens)*, or turn off `codecomplexity.showDecorations` / `showDiagnostics` individually.
- **A number looks wrong**: open the report and read the evidence. Big-O is an estimate from the code's structure; the confidence level tells you how sure the analyser is. If you believe it is a bug, please [open an issue](https://github.com/kdewasi/Code_complexity_guard/issues) with the snippet.
