// Bundles the extension and the CLI into dist/ with esbuild.
//
//   node esbuild.js               development build (with source maps)
//   node esbuild.js --production  minified build used for the .vsix
//   node esbuild.js --watch       rebuild on change
//
// web-tree-sitter is bundled in; its runtime .wasm and the grammar .wasm files
// live in ../wasm and are loaded at run time by src/engine/parser.ts.
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const shared = {
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
    // web-tree-sitter ships an ESM build (import.meta based) and a CJS build.
    // We bundle to CJS, so resolve the package's "require" export condition;
    // the ESM build would leave import.meta.url undefined at run time.
    conditions: ['require', 'node', 'default'],
    // Keep the wasm files out of the bundle; they are read from disk.
    loader: { '.wasm': 'file' },
};

const builds = [
    {
        ...shared,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        external: ['vscode'],
    },
    {
        ...shared,
        entryPoints: ['src/worker.ts'],
        outfile: 'dist/worker.js',
    },
    {
        ...shared,
        entryPoints: ['src/cli.ts'],
        outfile: 'dist/cli.js',
        banner: { js: '#!/usr/bin/env node' },
    },
];

async function main() {
    if (watch) {
        const contexts = await Promise.all(builds.map((b) => esbuild.context(b)));
        await Promise.all(contexts.map((c) => c.watch()));
        console.log('[esbuild] watching...');
        return;
    }
    for (const b of builds) {
        await esbuild.build(b);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
