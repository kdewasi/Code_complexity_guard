# Configuration

Open the settings with `Ctrl+,` and search for **Complexity Guard**, or run *Complexity Guard: Configure Thresholds*. All settings live in the `codecomplexity` namespace and can be set per user or per workspace (`.vscode/settings.json`).

## Thresholds

| Setting | Default | Effect |
|---|---|---|
| `codecomplexity.warningThreshold` | 8 | Cyclomatic complexity above this value grades the function **C** |
| `codecomplexity.criticalThreshold` | 15 | Cyclomatic complexity above this value grades the function **D** |
| `codecomplexity.cognitiveWarningThreshold` | 15 | Cognitive complexity above this value grades the function **C** |
| `codecomplexity.cognitiveCriticalThreshold` | 25 | Cognitive complexity above this value grades the function **D** |

Grades also consider the estimated time (cubic or exponential growth lowers the grade), nesting depth (6+ levels), size (120+ lines), parameter count (8+) and the severity of the detected suggestions. See [complexity-explained.md](complexity-explained.md).

Suggested profiles:

```jsonc
// Strict (new code, libraries)
{ "codecomplexity.warningThreshold": 6, "codecomplexity.criticalThreshold": 10,
  "codecomplexity.cognitiveWarningThreshold": 10, "codecomplexity.cognitiveCriticalThreshold": 20 }

// Legacy code (reduce noise, fix the worst first)
{ "codecomplexity.warningThreshold": 12, "codecomplexity.criticalThreshold": 25,
  "codecomplexity.cognitiveWarningThreshold": 25, "codecomplexity.cognitiveCriticalThreshold": 40,
  "codecomplexity.decorateHealthyFunctions": false }
```

## Surfaces

| Setting | Default | Effect |
|---|---|---|
| `codecomplexity.showCodeLens` | true | Summary line above each function |
| `codecomplexity.showDecorations` | true | Gutter icon, line tint and overview-ruler mark |
| `codecomplexity.decorateHealthyFunctions` | true | Also mark A/B functions; turn off to see only problems |
| `codecomplexity.showDiagnostics` | true | Problems-panel entries and quick fixes |

The hover, the report, the sidebar view and the status bar are always available.

## Analysis

| Setting | Default | Effect |
|---|---|---|
| `codecomplexity.enableRealtime` | true | Re-analyse while typing. When off, analysis runs on open, on save and on demand |
| `codecomplexity.analysisDelay` | 400 | Milliseconds of inactivity before re-analysing |
| `codecomplexity.maxFileSizeKB` | 1024 | Larger files are skipped to keep the editor responsive |
| `codecomplexity.enabledLanguages` | all 13 VS Code language ids | Remove entries to disable analysis for those languages |

Analysis runs in a worker thread, so even a very large file does not block the editor.

## Workspace scan

| Setting | Default | Effect |
|---|---|---|
| `codecomplexity.workspaceExclude` | `**/{node_modules,.git,dist,build,out,target,vendor,venv,.venv,__pycache__,bin,obj}/**` | Glob of files skipped by *Analyze Whole Workspace* |
| `codecomplexity.workspaceMaxFiles` | 1500 | Maximum number of files scanned |

## Ignore markers

- `codecomplexity: ignore` in a comment on the line above a function (or within its first lines): the function is analysed but never flagged, decorated or listed in Problems.
- `codecomplexity: ignore-file` in a comment within the first five lines: the file is skipped entirely.

Both markers also accept the spellings `complexity-guard: ignore` and `complexity: ignore`.
