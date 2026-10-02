#!/usr/bin/env node
// Refreshes the tree-sitter grammar binaries in ../wasm from npm.
//
// The grammar packages ship a prebuilt .wasm file but also carry native
// node-gyp install scripts, so they are deliberately NOT dependencies of this
// extension. This script installs them into a temporary folder with scripts
// disabled, copies the .wasm files over, and deletes the temporary folder.
//
//   node scripts/update-wasm.js
//
// After running it, re-run the unit tests: a grammar upgrade can rename node
// types that src/engine/languages/*.ts rely on.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GRAMMARS = [
    { pkg: 'tree-sitter-python@0.25.0', files: ['tree-sitter-python.wasm'] },
    { pkg: 'tree-sitter-java@0.23.5', files: ['tree-sitter-java.wasm'] },
    { pkg: 'tree-sitter-javascript@0.25.0', files: ['tree-sitter-javascript.wasm'] },
    { pkg: 'tree-sitter-typescript@0.23.2', files: ['tree-sitter-typescript.wasm', 'tree-sitter-tsx.wasm'] },
    { pkg: 'tree-sitter-go@0.25.0', files: ['tree-sitter-go.wasm'] },
    { pkg: 'tree-sitter-rust@0.24.0', files: ['tree-sitter-rust.wasm'] },
    { pkg: 'tree-sitter-c@0.24.1', files: ['tree-sitter-c.wasm'] },
    { pkg: 'tree-sitter-cpp@0.23.4', files: ['tree-sitter-cpp.wasm'] },
    { pkg: 'tree-sitter-c-sharp@0.23.5', files: ['tree-sitter-c_sharp.wasm'] },
    { pkg: 'tree-sitter-ruby@0.23.1', files: ['tree-sitter-ruby.wasm'] },
    { pkg: 'tree-sitter-php@0.24.2', files: ['tree-sitter-php.wasm'] },
];

const root = path.resolve(__dirname, '..');
const wasmDir = path.join(root, 'wasm');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-wasm-'));

try {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"ccg-wasm-tmp","private":true}');
    for (const g of GRAMMARS) {
        console.log(`installing ${g.pkg}`);
        execSync(`npm install --no-audit --no-fund --ignore-scripts --legacy-peer-deps ${g.pkg}`, {
            cwd: tmp,
            stdio: 'inherit',
        });
        const name = g.pkg.replace(/@.*$/, '');
        for (const f of g.files) {
            const src = path.join(tmp, 'node_modules', name, f);
            fs.copyFileSync(src, path.join(wasmDir, f));
            console.log(`  copied ${f} (${fs.statSync(src).size} bytes)`);
        }
    }
    // The runtime wasm must match the web-tree-sitter version in package.json.
    const runtime = path.join(root, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm');
    fs.copyFileSync(runtime, path.join(wasmDir, 'web-tree-sitter.wasm'));
    console.log('copied web-tree-sitter.wasm');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
