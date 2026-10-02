/**
 * Worker-thread entry point: runs the engine off the extension host's main
 * thread so that very large files never block the editor.
 */
import { parentPort, workerData } from 'worker_threads';
import { Analyzer, AnalyzeOptions, LanguageId, ParserManager } from './engine';

interface Request {
    id: number;
    source: string;
    languageId: LanguageId;
    options: AnalyzeOptions;
}

const parsers = new ParserManager(String(workerData.wasmDir));
const analyzer = new Analyzer(parsers);

parentPort?.on('message', async (req: Request) => {
    try {
        const result = await analyzer.analyze(req.source, req.languageId, req.options);
        parentPort?.postMessage({ id: req.id, result });
    } catch (err) {
        parentPort?.postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) });
    }
});
