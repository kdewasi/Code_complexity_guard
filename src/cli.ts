/**
 * Command-line interface, for terminals and CI:
 *
 *   node dist/cli.js src/app.py            pretty report
 *   node dist/cli.js src/ --json           JSON for every supported file under src/
 *   node dist/cli.js src/ --fail-on C      exit 1 when any function is rated C or worse
 *
 * Exit codes: 0 ok, 1 threshold exceeded (--fail-on), 2 usage / IO error.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Analyzer, FileAnalysis, Grade, ParserManager, languageFromFileName } from './engine';

interface Args {
    paths: string[];
    json: boolean;
    failOn: Grade | undefined;
    warning: number | undefined;
    critical: number | undefined;
    maxKB: number;
}

const GRADE_ORDER: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3 };
const COLORS: Record<Grade, string> = { A: '\x1b[32m', B: '\x1b[34m', C: '\x1b[33m', D: '\x1b[31m' };
const RESET = '\x1b[0m';
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'target', 'vendor', 'venv', '.venv', '__pycache__', 'bin', 'obj']);

function usage(): never {
    process.stderr.write(`Usage: complexity-guard <file-or-dir>... [--json] [--fail-on A|B|C|D] [--warning N] [--critical N] [--max-kb N]\n`);
    process.exit(2);
}

function parseArgs(argv: string[]): Args {
    const args: Args = { paths: [], json: false, failOn: undefined, warning: undefined, critical: undefined, maxKB: 1024 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') {
            args.json = true;
        } else if (a === '--fail-on') {
            const g = (argv[++i] ?? '').toUpperCase();
            if (!['A', 'B', 'C', 'D'].includes(g)) {
                usage();
            }
            args.failOn = g as Grade;
        } else if (a === '--warning') {
            args.warning = Number(argv[++i]);
        } else if (a === '--critical') {
            args.critical = Number(argv[++i]);
        } else if (a === '--max-kb') {
            args.maxKB = Number(argv[++i]);
        } else if (a === '-h' || a === '--help') {
            usage();
        } else if (a.startsWith('-')) {
            usage();
        } else {
            args.paths.push(a);
        }
    }
    if (args.paths.length === 0) {
        usage();
    }
    return args;
}

function collectFiles(p: string, out: string[]): void {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(p);
    } catch {
        process.stderr.write(`Not found: ${p}\n`);
        return;
    }
    if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                    collectFiles(path.join(p, entry.name), out);
                }
            } else if (languageFromFileName(entry.name)) {
                out.push(path.join(p, entry.name));
            }
        }
    } else {
        out.push(p);
    }
}

function printFile(file: string, a: FileAnalysis): void {
    const c = COLORS[a.fileRating.grade];
    process.stdout.write(`\n${c}${a.fileRating.grade}${RESET} ${file}  (${a.languageName}, ${a.totals.functionCount} functions) — ${a.fileRating.summary}\n`);
    const order = [...a.functions].filter((f) => !f.ignored).sort((x, y) => GRADE_ORDER[y.rating.grade] - GRADE_ORDER[x.rating.grade] || x.startLine - y.startLine);
    for (const f of order) {
        const col = COLORS[f.rating.grade];
        process.stdout.write(`  ${col}${f.rating.grade}${RESET} ${f.qualifiedName.padEnd(32)} L${String(f.nameLine + 1).padEnd(5)} cyc ${String(f.cyclomatic).padStart(3)}  cog ${String(f.cognitive).padStart(3)}  time ${f.time.notation.padEnd(12)} space ${f.space.notation.padEnd(8)}\n`);
        for (const s of f.suggestions) {
            const tag = s.severity === 'critical' ? `${COLORS.D}!!${RESET}` : s.severity === 'warning' ? `${COLORS.C}! ${RESET}` : '  ';
            process.stdout.write(`      ${tag} ${s.title}${s.impact ? ` (${s.impact})` : ''} — ${s.fix}\n`);
        }
    }
}

async function main(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    const files: string[] = [];
    for (const p of args.paths) {
        collectFiles(p, files);
    }
    if (files.length === 0) {
        process.stderr.write('No supported files found.\n');
        return 2;
    }
    const wasmDir = path.join(__dirname, '..', 'wasm');
    const analyzer = new Analyzer(new ParserManager(wasmDir));
    const thresholds = {
        ...(args.warning ? { cyclomaticWarning: args.warning } : {}),
        ...(args.critical ? { cyclomaticCritical: args.critical } : {}),
    };
    const results: { file: string; analysis: FileAnalysis }[] = [];
    let worst: Grade = 'A';
    for (const file of files) {
        const languageId = languageFromFileName(file);
        if (!languageId) {
            continue;
        }
        let source: string;
        try {
            source = fs.readFileSync(file, 'utf8');
        } catch (err) {
            process.stderr.write(`Cannot read ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
            continue;
        }
        const analysis = await analyzer.analyze(source, languageId, { thresholds, maxChars: args.maxKB * 1024 });
        results.push({ file, analysis });
        for (const f of analysis.functions) {
            if (!f.ignored && GRADE_ORDER[f.rating.grade] > GRADE_ORDER[worst]) {
                worst = f.rating.grade;
            }
        }
        if (!args.json) {
            printFile(file, analysis);
        }
    }
    if (args.json) {
        process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
        const total = results.reduce((n, r) => n + r.analysis.totals.functionCount, 0);
        process.stdout.write(`\n${results.length} files, ${total} functions, worst grade ${COLORS[worst]}${worst}${RESET}\n`);
    }
    if (args.failOn && GRADE_ORDER[worst] >= GRADE_ORDER[args.failOn]) {
        return 1;
    }
    return 0;
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
        process.exit(2);
    });
