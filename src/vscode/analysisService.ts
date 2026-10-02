/**
 * Owns the analysis lifecycle inside VS Code:
 *   - runs the engine in a worker thread (falls back to in-process)
 *   - caches results per document version
 *   - debounces re-analysis while typing
 *   - notifies listeners when a document's analysis changes
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import { Analyzer, AnalyzeOptions, FileAnalysis, LanguageId, ParserManager } from '../engine';
import { getSettings, languageOf, Settings } from './config';

interface Pending {
    resolve: (r: FileAnalysis) => void;
    reject: (e: Error) => void;
}

interface CacheEntry {
    version: number;
    result: FileAnalysis;
}

export class AnalysisService implements vscode.Disposable {
    private worker: Worker | undefined;
    private workerBroken = false;
    private nextId = 1;
    private readonly pending = new Map<number, Pending>();
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inflight = new Map<string, Promise<FileAnalysis | undefined>>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private fallback: Analyzer | undefined;
    private readonly emitter = new vscode.EventEmitter<{ uri: vscode.Uri; result: FileAnalysis }>();
    readonly onDidAnalyze = this.emitter.event;

    constructor(private readonly extensionPath: string, private readonly log: vscode.OutputChannel) {}

    get wasmDir(): string {
        return path.join(this.extensionPath, 'wasm');
    }

    /** Last known result for a document (may be stale if the document changed). */
    getCached(uri: vscode.Uri): FileAnalysis | undefined {
        return this.cache.get(uri.toString())?.result;
    }

    /** Analyse now (or return the cached result for this exact version). */
    async analyzeDocument(document: vscode.TextDocument, settings: Settings = getSettings()): Promise<FileAnalysis | undefined> {
        const languageId = languageOf(document, settings);
        if (!languageId) {
            return undefined;
        }
        const key = document.uri.toString();
        const cached = this.cache.get(key);
        if (cached && cached.version === document.version) {
            return cached.result;
        }
        const running = this.inflight.get(key);
        if (running) {
            return running;
        }
        const version = document.version;
        const source = document.getText();
        const options: AnalyzeOptions = { thresholds: settings.thresholds, maxChars: settings.maxFileSizeKB * 1024 };
        const job = this.run(source, languageId, options)
            .then((result) => {
                this.cache.set(key, { version, result });
                this.emitter.fire({ uri: document.uri, result });
                return result;
            })
            .catch((err: Error) => {
                this.log.appendLine(`Analysis failed for ${document.fileName}: ${err.message}`);
                return undefined;
            })
            .finally(() => {
                this.inflight.delete(key);
            });
        this.inflight.set(key, job);
        return job;
    }

    /** Debounced analysis used while typing. */
    schedule(document: vscode.TextDocument, delayMs?: number): void {
        const key = document.uri.toString();
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const settings = getSettings();
        const t = setTimeout(() => {
            this.timers.delete(key);
            void this.analyzeDocument(document, settings);
        }, delayMs ?? settings.analysisDelay);
        this.timers.set(key, t);
    }

    /** Analyse arbitrary text (workspace scans). */
    analyzeText(source: string, languageId: LanguageId, options: AnalyzeOptions): Promise<FileAnalysis> {
        return this.run(source, languageId, options);
    }

    forget(uri: vscode.Uri): void {
        const key = uri.toString();
        this.cache.delete(key);
        const t = this.timers.get(key);
        if (t) {
            clearTimeout(t);
            this.timers.delete(key);
        }
    }

    clearCache(): void {
        this.cache.clear();
    }

    private async run(source: string, languageId: LanguageId, options: AnalyzeOptions): Promise<FileAnalysis> {
        if (!this.workerBroken) {
            try {
                return await this.runInWorker(source, languageId, options);
            } catch (err) {
                this.workerBroken = true;
                this.log.appendLine(`Worker unavailable, analysing in-process: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        if (!this.fallback) {
            this.fallback = new Analyzer(new ParserManager(this.wasmDir));
        }
        return this.fallback.analyze(source, languageId, options);
    }

    private runInWorker(source: string, languageId: LanguageId, options: AnalyzeOptions): Promise<FileAnalysis> {
        const worker = this.getWorker();
        const id = this.nextId++;
        return new Promise<FileAnalysis>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            worker.postMessage({ id, source, languageId, options });
        });
    }

    private getWorker(): Worker {
        if (this.worker) {
            return this.worker;
        }
        const workerPath = path.join(this.extensionPath, 'dist', 'worker.js');
        const worker = new Worker(workerPath, { workerData: { wasmDir: this.wasmDir } });
        worker.on('message', (msg: { id: number; result?: FileAnalysis; error?: string }) => {
            const p = this.pending.get(msg.id);
            if (!p) {
                return;
            }
            this.pending.delete(msg.id);
            if (msg.result) {
                p.resolve(msg.result);
            } else {
                p.reject(new Error(msg.error ?? 'unknown worker error'));
            }
        });
        const fail = (err: Error): void => {
            this.log.appendLine(`Analysis worker stopped: ${err.message}`);
            this.worker = undefined;
            for (const [, p] of this.pending) {
                p.reject(err);
            }
            this.pending.clear();
        };
        worker.on('error', fail);
        worker.on('exit', (code) => {
            if (code !== 0) {
                fail(new Error(`exit code ${code}`));
            }
        });
        this.worker = worker;
        return worker;
    }

    dispose(): void {
        for (const t of this.timers.values()) {
            clearTimeout(t);
        }
        this.timers.clear();
        this.emitter.dispose();
        if (this.worker) {
            void this.worker.terminate();
            this.worker = undefined;
        }
    }
}
