# Code Complexity Guard

> Instant, offline code complexity analysis for 12 languages. See how complex every function is, how its run time and memory grow with input size, and exactly what to change. No AI, no API key, no Python install.

[![Version](https://img.shields.io/visual-studio-marketplace/v/Kishan-aicodeguard.codecomplexity)](https://marketplace.visualstudio.com/items?itemName=Kishan-aicodeguard.codecomplexity)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/Kishan-aicodeguard.codecomplexity)](https://marketplace.visualstudio.com/items?itemName=Kishan-aicodeguard.codecomplexity)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI](https://github.com/kdewasi/Code_complexity_guard/actions/workflows/test.yml/badge.svg)](https://github.com/kdewasi/Code_complexity_guard/actions/workflows/test.yml)

Open a file and every function gets a one-line verdict above it:

```
🟡 Needs attention · cyclomatic 5 · cognitive 7 · time O(n³) · space O(n²)
💡 Linear search inside a loop
def find_duplicates(items):
    dupes = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j] and items[i] not in dupes:
                dupes.append(items[i])
    return dupes
```

Hover the name to see **why** (line by line), press `Ctrl+.` for the fix, or open the full **Complexity Report**.

---

## What it measures

| Metric | Question it answers | Comfortable range |
|---|---|---|
| **Grade A–D** | Is this function fine, or should I look at it? | A or B |
| **Cyclomatic complexity** | How many paths run through it? (= test cases needed) | 1–8 |
| **Cognitive complexity** | How hard is it for a person to follow? Nesting costs extra. | 0–15 |
| **Time (Big-O)** | How does run time grow with the size of the input? | O(1) … O(n log n) |
| **Space (Big-O)** | How much extra memory grows with the input? | O(1) … O(n) |

Big-O is **estimated from the structure of the code** using a real parser (tree-sitter), not guessed by a language model:

- nested loops multiply; a loop variable that halves or doubles each step is `log n`; `while (i * i <= n)` is `√n`; a loop over a literal range is constant
- known library costs are included: `sort` is `n log n`, `list.contains` / `x in list` / `indexOf` / `in_array` are `n`, copies and slices are `n`
- recursion follows the standard recurrences: `fib(n-1) + fib(n-2)` is `2ⁿ`, binary search is `log n`, merge sort is `n log n`, tree walks are `n`, memoized recursion is `n`
- calls to other functions **in the same file** are followed: a loop that calls an `O(n)` helper is `O(n²)`
- allocations, appends inside loops, 2-D tables and recursion depth feed the memory estimate

Every number comes with its evidence, so you can check the reasoning rather than trust it.

## Suggestions with before/after code

When a known slow or hard-to-read pattern is recognised, the extension explains what is happening, what to do, and the effect:

| Pattern | Suggestion | Effect |
|---|---|---|
| `x in list`, `.contains()`, `.includes()`, `in_array()` inside a loop | build a set / hash map once | O(n²) → O(n) |
| nested loops that match elements by equality | index one side in a map | O(n²) → O(n) |
| `s += part` inside a loop (Python, Java, C#, Go, Ruby) | join / StringBuilder | O(n²) → O(n) |
| `fib(n-1) + fib(n-2)` style recursion | memoization / DP | O(2ⁿ) → O(n) |
| `queue.pop(0)`, `array.shift()`, `list.remove(0)`, `array_shift()` in a loop | deque / index pointer | O(n²) → O(n) |
| sorting inside a loop | sort once outside | O(n² log n) → O(n log n) |
| `for (i = 0; i < strlen(s); i++)` | hoist the call | O(n²) → O(n) |
| copies, regex compilation inside loops | hoist out of the loop | |
| 4+ branch `if / else if` chains on one value | dispatch table / switch | readability |
| 4+ levels of nesting | guard clauses, extract helper | readability |
| 3+ guard checks at the top, 6+ parameters, 60+ lines, empty `catch` | extract / group / split | structure |

Snippets are written in the language of the file you are editing.

## Languages

Python · Java · JavaScript · TypeScript · JSX/TSX · Go · Rust · C · C++ · C# · Ruby · PHP

Each language is parsed with its official tree-sitter grammar (bundled as WebAssembly), so the analyser understands real syntax: decorators, lambdas, generics, `match`/`switch` expressions, comprehensions, Ruby blocks, LINQ, streams, closures and more.

## Where you see it

- **CodeLens** above each function: grade, the four numbers and the top suggestion. Click to open the report.
- **Hover** on a function name: the numbers with plain-language meaning and the evidence behind the Big-O.
- **Gutter icon and overview ruler** colour-coded by grade.
- **Problems panel**: functions that need attention and every suggestion, with quick fixes (`Ctrl+.`).
- **Complexity Guard view** in the activity bar: all functions of the current file, worst first.
- **Complexity Report** (editor title button or `Complexity Guard: Open Complexity Report`): a dashboard with cards, evidence, suggestions and before/after code.
- **Analyze Whole Workspace**: scans every supported file and lists the hot spots across the project.
- **Status bar**: the file's grade and how many functions to review.

Everything runs locally inside VS Code while you type. **No code ever leaves your machine**, and no account, API key, Python or other runtime is required. The extension works in untrusted and virtual workspaces.

## Commands

| Command | What it does |
|---|---|
| `Complexity Guard: Open Complexity Report` | Dashboard for the current file |
| `Complexity Guard: Analyze Current File` | Re-analyse and open the report |
| `Complexity Guard: Analyze Whole Workspace` | Scan the project and list hot spots |
| `Complexity Guard: What Do These Numbers Mean?` | Plain-language guide to the metrics |
| `Complexity Guard: Toggle Inline Summaries (CodeLens)` | Hide or show the CodeLens line |
| `Complexity Guard: Configure Thresholds` | Open the settings |
| `Complexity Guard: Report an Issue` | Open the issue tracker |

A short **walkthrough** is available under *Help → Get Started → Get started with Complexity Guard*.

## Settings

| Setting | Default | Description |
|---|---|---|
| `codecomplexity.warningThreshold` | `8` | Cyclomatic complexity above this is "Needs attention" |
| `codecomplexity.criticalThreshold` | `15` | Cyclomatic complexity above this is "Poor" |
| `codecomplexity.cognitiveWarningThreshold` | `15` | Cognitive complexity above this is "Needs attention" |
| `codecomplexity.cognitiveCriticalThreshold` | `25` | Cognitive complexity above this is "Poor" |
| `codecomplexity.enableRealtime` | `true` | Re-analyse while typing (debounced) |
| `codecomplexity.analysisDelay` | `400` | Milliseconds of quiet before re-analysing |
| `codecomplexity.showCodeLens` | `true` | Summary line above every function |
| `codecomplexity.showDecorations` | `true` | Gutter icon and line highlight |
| `codecomplexity.decorateHealthyFunctions` | `true` | Also mark A/B functions (turn off to only see problems) |
| `codecomplexity.showDiagnostics` | `true` | Entries in the Problems panel |
| `codecomplexity.maxFileSizeKB` | `1024` | Larger files are skipped |
| `codecomplexity.enabledLanguages` | all | Remove a language to switch analysis off for it |
| `codecomplexity.workspaceExclude` | build dirs | Glob skipped by *Analyze Whole Workspace* |
| `codecomplexity.workspaceMaxFiles` | `1500` | Cap for *Analyze Whole Workspace* |

### Ignoring a function or a file

```python
# codecomplexity: ignore
def legacy_parser(data):
    ...
```

Put `codecomplexity: ignore-file` in a comment within the first five lines to skip a whole file. Any comment syntax works (`//`, `#`, `--`).

## Understanding the numbers

**Cyclomatic complexity** starts at 1 and adds 1 for each `if`, `else if`, loop, `case`, `catch`, `?:` and each `&&` / `||`. It is the number of independent paths, which is the minimum number of tests needed to cover the function.

**Cognitive complexity** (the SonarSource definition) is about readability: each branch or loop adds 1 **plus its nesting depth**, so an `if` inside a loop inside an `if` costs 3. `else`/`else if` and runs of the same boolean operator are cheap; recursion adds 1.

**Time and space** are asymptotic estimates of the worst case. The analyser is deliberately conservative: an unknown `while` loop is assumed linear, and the confidence level (high / medium / low) is shown next to every estimate. Treat `O(n²)` on a function that only ever sees ten items as information, not as an order.

| Grade | Meaning |
|---|---|
| 🟢 **A** Excellent | small, readable, efficient |
| 🔵 **B** Good | some branching or size, nothing urgent |
| 🟡 **C** Needs attention | over a threshold, deeply nested, or doing avoidable work |
| 🔴 **D** Poor | over a critical threshold or exponential/cubic time; refactor soon |

## Command line / CI

The same engine ships as a CLI inside the extension package (and in this repository after `npm run build`):

```bash
node dist/cli.js src/                    # report for every supported file
node dist/cli.js src/ --json             # machine-readable
node dist/cli.js src/ --fail-on C        # exit 1 if any function is rated C or worse
node dist/cli.js src/ --warning 10 --critical 20
```

## Development

```bash
git clone https://github.com/kdewasi/Code_complexity_guard.git
cd Code_complexity_guard
npm install
npm run build        # type-check + bundle to dist/
npm test             # engine unit tests (no VS Code needed)
npm run package      # produce the .vsix
```

Press `F5` in VS Code to launch an Extension Development Host. The engine lives in `src/engine` and has no dependency on VS Code; language support is one spec file each under `src/engine/languages/`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy and security

- Analysis is pure text processing inside the extension host (and a worker thread for large files).
- No network requests, no child processes, no files written.
- The report webview uses a strict Content-Security-Policy and escapes all content.
- No telemetry.

## License

MIT. Grammars are the official tree-sitter grammars (MIT) bundled as WebAssembly.
