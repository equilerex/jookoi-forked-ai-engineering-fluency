import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
    initStats,
    getStats,
    getUsageStats,
    getChartPayload,
    getMaturityData,
    getFluencyData,
    getDiagnosticsData,
    refreshStats,
    getAllRecentSessionsList,
} from './statsService';
import { getSessionLogData, getToolCallPrettyPayload } from './sessionLogService';
import { renderFullHtml } from './htmlTemplates';
import { getSessionBackingPath } from '../../cli/src/sessionProcessing';

export {
    initStats,
    getStats,
    getUsageStats,
    getChartPayload,
    getMaturityData,
    getFluencyData,
    getDiagnosticsData,
    refreshStats,
    getSessionFiles,
    getAllRecentSessionsList,
} from './statsService';
export { getSessionLogData, getToolCallPrettyPayload } from './sessionLogService';

const STATIC_MIME_TYPES: Record<string, string> = {
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function getWebviewDir(): string {
    return path.join(__dirname, 'webview');
}

async function serveStatic(reqPath: string, res: http.ServerResponse): Promise<void> {
    const webviewDir = path.resolve(getWebviewDir());
    const relativePath = reqPath.replace(/^\/static\//, '');
    const safePath = path.resolve(webviewDir, relativePath);

    if (!safePath.startsWith(webviewDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const data = await fs.promises.readFile(safePath);
        const ext = path.extname(safePath);
        const mime = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache, must-revalidate' });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not Found');
    }
}

function sendHtml(res: http.ServerResponse, html: string): void {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    });
    res.end(html);
}

async function readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function revealInFileManager(filePath: string): void {
    const target = getSessionBackingPath(filePath);
    if (!fs.existsSync(target)) { return; }

    if (process.platform === 'win32') {
        spawn('explorer.exe', ['/select,', target], { detached: true });
    } else if (process.platform === 'darwin') {
        spawn('open', ['-R', target], { detached: true });
    } else {
        spawn('xdg-open', [path.dirname(target)], { detached: true });
    }
}

export function createServer(): http.Server {
    return http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // Static assets
        if (pathname.startsWith('/static/')) {
            await serveStatic(pathname, res);
            return;
        }

        // API routes
        if (pathname === '/api/refresh' && req.method === 'POST') {
            try {
                await refreshStats();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        if (pathname === '/api/reveal' && req.method === 'POST') {
            try {
                const body = await readRequestBody(req);
                const { path: targetPath } = JSON.parse(body || '{}');
                if (targetPath) { revealInFileManager(targetPath); }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        if (pathname === '/api/tool-call' && req.method === 'GET') {
            try {
                const file = url.searchParams.get('file') || '';
                const turn = parseInt(url.searchParams.get('turn') || '0', 10);
                const call = parseInt(url.searchParams.get('call') || '0', 10);
                const payload = await getToolCallPrettyPayload(file, turn, call);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        if (pathname === '/api/recent-sessions' && req.method === 'GET') {
            try {
                const period = url.searchParams.get('period') || 'last7';
                const usage = await getUsageStats();
                const sessions = (usage.recentSessions as any)?.[period] || (period === 'today' ? usage.todaySessions : []);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ period, sessions }));
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        if (pathname === '/api/sessions-list' && req.method === 'GET') {
            try {
                const sessions = await getAllRecentSessionsList();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(sessions));
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // HTML Pages
        try {
            const isEmbed = url.searchParams.get('embed') === '1';
            const initialGroup = url.searchParams.get('group') || undefined;
            const initialTab = url.searchParams.get('tab') || undefined;

            // Support both direct routes and query params (e.g. /?view=usage or /?tab=chart)
            let route = pathname;
            if (pathname === '/') {
                const queryView = url.searchParams.get('view') || url.searchParams.get('tab') || url.searchParams.get('page');
                if (queryView) {
                    route = queryView.startsWith('/') ? queryView : `/${queryView}`;
                } else {
                    route = '/details';
                }
            }

            if (route === '/details') {
                const stats = await getStats();
                const html = renderFullHtml({
                    title: 'Details',
                    activeTab: 'details',
                    scriptFile: 'details.js',
                    initialPayloadKey: '__INITIAL_DETAILS__',
                    isEmbed,
                    initialGroup,
                    initialTab,
                    initialPayloadData: {
                        ...stats,
                        backendConfigured: false,
                        compactNumbers: false,
                        sortSettings: {
                            editor: { key: 'name', dir: 'asc' },
                            model: { key: 'name', dir: 'asc' },
                            modelOtherExpanded: false,
                            editorOtherExpanded: false,
                        },
                    },
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/usage') {
                const usage = await getUsageStats();
                const locale = Intl.DateTimeFormat().resolvedOptions().locale;
                const html = renderFullHtml({
                    title: 'Usage Analysis',
                    activeTab: 'usage',
                    scriptFile: 'usage.js',
                    initialPayloadKey: '__INITIAL_USAGE__',
                    isEmbed,
                    initialGroup,
                    initialTab,
                    initialPayloadData: {
                        today: usage.today,
                        last30Days: usage.last30Days,
                        month: usage.month,
                        lastMonth: usage.lastMonth,
                        locale,
                        customizationMatrix: null,
                        missedPotential: [],
                        lastUpdated: usage.lastUpdated.toISOString(),
                        backendConfigured: false,
                        currentWorkspacePaths: [],
                        suppressedUnknownTools: [],
                        todaySessions: usage.todaySessions || [],
                        recentSessions: usage.recentSessions || { last7: [], last30: [], currentMonth: [] },
                        use24HourTime: false,
                        insights: [],
                        curationAnalysis: null,
                    },
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/recent-sessions') {
                const usage = await getUsageStats();
                const locale = Intl.DateTimeFormat().resolvedOptions().locale;
                const html = renderFullHtml({
                    title: 'Recent Sessions',
                    activeTab: 'recent-sessions',
                    scriptFile: 'usage.js',
                    initialPayloadKey: '__INITIAL_USAGE__',
                    isEmbed,
                    initialGroup: 'usage',
                    initialTab: 'sessions',
                    initialPayloadData: {
                        today: usage.today,
                        last30Days: usage.last30Days,
                        month: usage.month,
                        lastMonth: usage.lastMonth,
                        locale,
                        customizationMatrix: null,
                        missedPotential: [],
                        lastUpdated: usage.lastUpdated.toISOString(),
                        backendConfigured: false,
                        currentWorkspacePaths: [],
                        suppressedUnknownTools: [],
                        todaySessions: usage.todaySessions || [],
                        recentSessions: usage.recentSessions || { last7: [], last30: [], currentMonth: [] },
                        use24HourTime: false,
                        insights: [],
                        curationAnalysis: null,
                    },
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/chart') {
                const chartPayload = await getChartPayload();
                const html = renderFullHtml({
                    title: 'Token Usage Chart',
                    activeTab: 'chart',
                    scriptFile: 'chart.js',
                    initialPayloadKey: '__INITIAL_CHART__',
                    isEmbed,
                    initialPayloadData: {
                        ...chartPayload,
                        initialPeriod: 'day',
                        initialView: 'total',
                        initialMetric: 'tokens',
                        initialSplit: 'total',
                        monthlyBudget: 0,
                    },
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/maturity') {
                const maturityData = await getMaturityData();
                const html = renderFullHtml({
                    title: 'Fluency Score',
                    activeTab: 'maturity',
                    scriptFile: 'maturity.js',
                    initialPayloadKey: '__INITIAL_MATURITY__',
                    isEmbed,
                    initialPayloadData: maturityData,
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/fluency-level-viewer') {
                const fluencyData = getFluencyData();
                const html = renderFullHtml({
                    title: 'Scoring Guide',
                    activeTab: 'fluency-level-viewer',
                    scriptFile: 'fluency-level-viewer.js',
                    initialPayloadKey: '__INITIAL_FLUENCY_LEVEL_DATA__',
                    isEmbed,
                    initialPayloadData: fluencyData,
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/environmental') {
                const stats = await getStats();
                const html = renderFullHtml({
                    title: 'Environmental Impact',
                    activeTab: 'environmental',
                    scriptFile: 'environmental.js',
                    initialPayloadKey: '__INITIAL_ENVIRONMENTAL__',
                    isEmbed,
                    initialPayloadData: {
                        ...stats,
                        backendConfigured: false,
                        compactNumbers: false,
                    },
                });
                sendHtml(res, html);
                return;
            }

            if (route === '/diagnostics') {
                const diagData = await getDiagnosticsData();
                const html = renderFullHtml({
                    title: 'Diagnostics',
                    activeTab: 'diagnostics',
                    scriptFile: 'diagnostics.js',
                    initialPayloadKey: '__INITIAL_DIAGNOSTICS__',
                    isEmbed,
                    initialGroup,
                    initialTab,
                    initialPayloadData: diagData,
                });
                sendHtml(res, html);
                return;
            }

            // Session Log Viewer
            if (route === '/session') {
                const sessionFile = url.searchParams.get('file');
                if (!sessionFile) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Missing ?file= parameter');
                    return;
                }

                const focusedTurn = parseInt(url.searchParams.get('turn') || '0', 10) || undefined;
                const logData = await getSessionLogData(sessionFile);
                const sessionUrl = '/session?file=' + encodeURIComponent(sessionFile) + (focusedTurn ? '&turn=' + focusedTurn : '');
                const html = renderFullHtml({
                    title: logData.title || path.basename(sessionFile),
                    activeTab: 'session',
                    scriptFile: 'logviewer.js',
                    initialPayloadKey: '__INITIAL_LOGDATA__',
                    isEmbed,
                    sessionUrl,
                    initialPayloadData: {
                        ...logData,
                        focusedTurnNumber: focusedTurn,
                        compactNumbers: false,
                    },
                    sessionTitle: logData.title || path.basename(sessionFile),
                    sessionFile,
                });
                sendHtml(res, html);
                return;
            }

            // Raw Session File Viewer
            if (pathname === '/session/raw') {
                const sessionFile = url.searchParams.get('file');
                if (!sessionFile) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Missing ?file= parameter');
                    return;
                }
                const backingPath = getSessionBackingPath(sessionFile);
                const content = await fs.promises.readFile(backingPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(content);
                return;
            }

            // 404
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        } catch (err: any) {
            console.error(`Error handling ${pathname}:`, err);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Internal Server Error:\n${err.stack || err.message}`);
        }
    });
}

function parseCliArgs(): { port: number; host: string } {
    const args = process.argv.slice(2);
    let port = parseInt(process.env.PORT || '3333', 10);
    let host = process.env.HOST || '127.0.0.1';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            port = parseInt(args[++i], 10);
        } else if (args[i] === '--host' && args[i + 1]) {
            host = args[++i];
        }
    }
    return { port, host };
}

if (require.main === module) {
    const { port, host } = parseCliArgs();
    initStats().catch(err => console.error('Failed to init cache:', err));

    // Refresh incrementally in background every 3 minutes (unref so process exits cleanly)
    const refreshTimer = setInterval(() => {
        refreshStats().catch(err => console.error('Background refresh error:', err));
    }, 180_000);
    refreshTimer.unref();

    const server = createServer();
    server.listen(port, host, () => {
        console.log(`\n======================================================`);
        console.log(`  AI Engineering Fluency — Web Dashboard`);
        console.log(`  Running at: http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`);
        console.log(`======================================================\n`);
    });
}
