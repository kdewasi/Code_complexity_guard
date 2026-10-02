# Make it yours

All settings live under **Complexity Guard** in the Settings UI (`codecomplexity.*`):

- `warningThreshold` / `criticalThreshold` — cyclomatic limits (default 8 / 15)
- `cognitiveWarningThreshold` / `cognitiveCriticalThreshold` — cognitive limits (default 15 / 25)
- `showCodeLens`, `showDecorations`, `showDiagnostics` — switch each surface on or off
- `enabledLanguages` — remove languages you do not want analysed
- `enableRealtime` / `analysisDelay` — analyse while typing, or only on save

To silence one function, put a comment on the line above it:

```
# codecomplexity: ignore
```

Use `codecomplexity: ignore-file` in the first five lines to skip a whole file.
