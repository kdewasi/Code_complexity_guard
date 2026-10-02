# Contributing to Code Complexity Guard

Thanks for helping! This document explains how the project is laid out, how to run it, and how to add a language or a suggestion.

## Setup

Requirements: Node.js 18+ and npm. Nothing else (no Python, no native build tools).

```bash
git clone https://github.com/kdewasi/Code_complexity_guard.git
cd Code_complexity_guard
npm install
npm run build      # type-check + bundle extension, worker and CLI into dist/
npm test           # compiles to out/ and runs the engine unit tests with mocha
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Layout

```
src/
  engine/                 The analyser. No dependency on VS Code.
    parser.ts             Loads web-tree-sitter and the grammar .wasm files from ../wasm
    languages/            One spec per language: which node types are functions, loops, branches, calls …
    walker.ts             Walks a function body and collects facts (metrics, loops, calls, recursion …)
    complexity.ts         Folds recursion into the Big-O estimate; resolves same-file call graphs
    suggestions.ts        Pattern detectors → suggestions with before/after snippets
    rating.ts             Grades and plain-language verdicts
    analyzer.ts           Public entry point: source text → FileAnalysis
  vscode/                 Editor integration: service + worker, CodeLens, hover, diagnostics, report …
  extension.ts            Activation and command wiring
  worker.ts               Worker-thread entry point (runs the engine off the main thread)
  cli.ts                  Command-line interface
wasm/                     tree-sitter runtime + grammar binaries (refresh with `npm run update-wasm`)
test/unit/                Engine tests (plain mocha, no VS Code required)
media/                    Icons and walkthrough pages
```

## Adding a language

1. Get a tree-sitter grammar that ships a `.wasm` file in its npm package, add it to `scripts/update-wasm.js`, run `npm run update-wasm`.
2. Create `src/engine/languages/<lang>.ts` by copying the closest existing spec. The fields are documented in `spec.ts`. Use a quick script with `web-tree-sitter` to print the syntax tree of a sample file to learn the node and field names.
3. Register it in `src/engine/languages/index.ts` (engine id, VS Code language id, file extensions).
4. Add the VS Code language id to `package.json` (`activationEvents`, `enabledLanguages` enum) and to `SUPPORTED_VSCODE_LANGUAGES` in `src/vscode/config.ts`.
5. Add a test file under `test/unit/` covering functions, loops, branches, recursion and at least one suggestion.

## Adding a suggestion

1. Collect the fact in `walker.ts` (keep it plain data; no tree-sitter nodes may survive the walk).
2. Turn it into a `Suggestion` in `suggestions.ts`: say what is happening, why it matters, what to do, and the effect. Add language snippets to the specs if a before/after helps.
3. Add a test. Suggestions are part of the grade, so keep severities honest: `critical` for things that are always a bug at scale, `warning` for likely problems, `info` for readability.

## Style

- TypeScript strict mode, `npm run typecheck` must be clean.
- Keep the engine free of `vscode` imports so the CLI and tests keep working.
- Plain language in anything a user reads. Explain *why*, show *what to do*.

## Commit messages

```
feat: detect binary-search loops in Rust
fix: do not count else-if as nested for cognitive complexity
docs: explain confidence levels
test: add PHP match expression cases
```

## Release process

1. Update `version` in `package.json` and add a section to `CHANGELOG.md`.
2. `npm run build && npm test && npm run package` must succeed.
3. Tag and push: `git tag v1.2.3 && git push origin v1.2.3`. The *Publish Extension* workflow builds, tests, attaches the `.vsix` to a GitHub Release and publishes to the Marketplace when the `VSCE_PAT` secret is configured (see [PUBLISHING_GUIDE.md](PUBLISHING_GUIDE.md)).
