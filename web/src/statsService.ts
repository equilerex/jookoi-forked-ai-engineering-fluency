import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
    discoverSessionFiles,
    calculateDetailedStats,
    calculateDailyStats,
    buildChartPayload,
    getDiagnosticPaths,
    getSessionBackingPath,
    getSessionLastActivity,
    getSessionMeta,
    processSessionFile,
    loadCache,
    saveCache,
} from '../../cli/src/helpers';
import {
    getEditorSourceFromPath,
    runWithConcurrency,
    createEmptyUsageAnalysisPeriod,
} from '../../cli/src/analysis';
import type {
    DetailedStats,
    UsageAnalysisStats,
    SessionUsageAnalysis,
    TodaySessionSummary,
} from '../../src/types';
import { createEmptyContextRefs, calculateEstimatedCost } from '../../src/tokenEstimation';
import { addModelUsage } from '../../src/statsHelpers';
import { toLocalDayKey } from '../../src/utils/dayKeys';
import { calculateMaturityScores, getFluencyLevelData } from '../../src/maturityScoring';
import { getToolFamilies } from '../../vscode-extension/src/toolFamilies';
import { detectEditorSource } from '../../src/workspaceHelpers';
import { getEditorIconByName } from '../../vscode-extension/src/editorIcons';
import { buildWebviewLocalization } from '../../vscode-extension/src/webviewLocalization';
import { createTranslator, resolvedLocale } from '../../vscode-extension/src/l10nCore';
import {
    statSessionFile,
    getEcosystems,
    modelPricing,
    tokenEstimators,
} from '../../cli/src/sessionProcessing';
import { analyzeSessionUsage, mergeUsageAnalysis } from '../../src/usageAnalysis';
import { buildRecentSessionBuckets, type RecentSessionBucketItem } from '../../src/recentSessions';
import { parseWorkspaceStorageJsonFile } from '../../src/workspacePathResolver';
import toolNamesData from '../../src/toolNames.json';

const toolNameMap = ((toolNamesData as any).toolNameMap || toolNamesData) as Record<string, string>;

// ---------------------------------------------------------------------------
// Disk Cache for Usage Analysis (SessionUsageAnalysis)
// ---------------------------------------------------------------------------

interface UsageCacheEntry {
    mtime: number;
    size: number;
    analysis: SessionUsageAnalysis;
    title?: string;
    workspace?: string;
    workspacePath?: string;
}

const USAGE_CACHE_DIR = path.join(os.homedir(), '.copilot-token-tracker');
const USAGE_CACHE_PATH = path.join(USAGE_CACHE_DIR, 'web-usage-cache.json');
const MAX_USAGE_CACHE_ENTRIES = 2000;

let usageCache = new Map<string, UsageCacheEntry>();
let usageCacheDirty = false;

function loadWebUsageCache(): void {
    try {
        if (!fs.existsSync(USAGE_CACHE_PATH)) { return; }
        const raw = fs.readFileSync(USAGE_CACHE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && parsed.entries) {
            usageCache = new Map(Object.entries(parsed.entries));
        }
    } catch {
        usageCache.clear();
    }
}

function saveWebUsageCache(): void {
    if (!usageCacheDirty) { return; }
    try {
        if (!fs.existsSync(USAGE_CACHE_DIR)) {
            fs.mkdirSync(USAGE_CACHE_DIR, { recursive: true });
        }
        if (usageCache.size > MAX_USAGE_CACHE_ENTRIES) {
            const excess = usageCache.size - MAX_USAGE_CACHE_ENTRIES;
            const keys = Array.from(usageCache.keys()).slice(0, excess);
            for (const k of keys) { usageCache.delete(k); }
        }
        const entries: Record<string, UsageCacheEntry> = {};
        for (const [k, v] of usageCache.entries()) {
            entries[k] = v;
        }
        fs.writeFileSync(USAGE_CACHE_PATH, JSON.stringify({ version: 1, entries }), 'utf-8');
        usageCacheDirty = false;
    } catch { /* ignore write errors */ }
}

// ---------------------------------------------------------------------------
// In-Memory Shared Datasets
// ---------------------------------------------------------------------------

let cachedStats: DetailedStats | null = null;
let cachedSessionFiles: string[] | null = null;
let cachedUsageStats: UsageAnalysisStats | null = null;
let cachedChartPayload: object | null = null;
let cachedDiagnosticsData: any = null;
let cachedDataDay = '';
let isRefreshing = false;
let dataGeneration = 0;

const inFlight = new Map<string, Promise<unknown>>();
function shareInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) { return existing as Promise<T>; }
    const p = fn().finally(() => { inFlight.delete(key); });
    inFlight.set(key, p);
    return p;
}

function expireCachesOnDateChange(): void {
    const today = toLocalDayKey(new Date());
    if (cachedDataDay === today) { return; }
    if (cachedDataDay !== '') {
        // Trigger a background refresh to smoothly update datasets for the new day
        void refreshStats();
    }
    cachedDataDay = today;
}

// ---------------------------------------------------------------------------
// Memory-budgeted session loading
//
// The shared parsers read a whole session file into one string (logs reach 90MB).
// Parsing a file is therefore scheduled by size: it is parsed once into the
// shared caches under a byte budget (big files run alone), and the aggregate
// calculators then run against warm caches instead of re-parsing every file.
// Light files are published first so the page loads fast; heavy files follow in
// the background.
// ---------------------------------------------------------------------------

const LIGHT_FILE_BYTES = 8 * 1024 * 1024;
/** Estimated peak memory per parsed byte (string + line array + parsed objects). */
const PARSE_MEMORY_FACTOR = 4;
const PARSE_MEMORY_BUDGET_BYTES = 512 * 1024 * 1024;

class ByteBudget {
    private inUse = 0;
    private waiters: Array<() => void> = [];

    constructor(private readonly limit: number) { }

    async run<T>(weight: number, fn: () => Promise<T>): Promise<T> {
        const claimed = Math.min(weight, this.limit);
        while (this.inUse > 0 && this.inUse + claimed > this.limit) {
            await new Promise<void>((resolve) => this.waiters.push(resolve));
        }
        this.inUse += claimed;
        try {
            return await fn();
        } finally {
            this.inUse -= claimed;
            this.waiters.splice(0).forEach((wake) => wake());
        }
    }
}

const parseBudget = new ByteBudget(PARSE_MEMORY_BUDGET_BYTES);

async function statSessionSizes(files: string[]): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    const results = await runWithConcurrency(files, async (file) => {
        try {
            return (await fs.promises.stat(getSessionBackingPath(file))).size;
        } catch {
            return 0;
        }
    }, 16);
    files.forEach((file, index) => sizes.set(file, results[index] ?? 0));
    return sizes;
}

function usageWindowCutoff(now: Date): Date {
    const last30DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return lastMonthStart < last30DaysStart ? lastMonthStart : last30DaysStart;
}

/** Parse each file once (smallest first) so later passes only hit the caches. */
async function prewarmSessionCaches(files: string[], sizes: Map<string, number>): Promise<void> {
    const cutoff = usageWindowCutoff(new Date());
    const smallestFirst = [...files].sort((a, b) => (sizes.get(a) ?? 0) - (sizes.get(b) ?? 0));
    await runWithConcurrency(smallestFirst, async (file) => {
        const weight = (sizes.get(file) ?? 0) * PARSE_MEMORY_FACTOR;
        await parseBudget.run(weight, async () => {
            try {
                await processSessionFile(file);
                const stats = await statSessionFile(file);
                if (stats.mtime >= cutoff || file.includes('.db')) {
                    await getSessionUsageAnalysisCached(file, stats.mtimeMs, stats.size);
                }
            } catch { /* unparsable file: the calculators skip it too */ }
            // Let HTTP requests through between files.
            await new Promise<void>((resolve) => setImmediate(resolve));
        });
    }, 16);
}

export async function getSessionFiles(): Promise<string[]> {
    if (!cachedSessionFiles) {
        cachedSessionFiles = await discoverSessionFiles();
    }
    return cachedSessionFiles;
}

export function sessionEditorName(file: string): string {
    const editor = getEditorSourceFromPath(file);
    if (editor && editor !== 'Unknown') { return editor; }
    return detectEditorSource(file) || 'Unknown';
}

// Title/workspace come from the first ~150 lines; session logs can reach 100MB,
// so read only the head instead of the whole file.
const SESSION_HEAD_BYTES = 2 * 1024 * 1024;

function readFileHead(filePath: string, maxBytes: number): string {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
        let text = buffer.toString('utf8', 0, bytesRead);
        if (bytesRead === maxBytes) {
            // Drop the possibly cut-off last line.
            text = text.slice(0, Math.max(0, text.lastIndexOf('\n')));
        }
        return text;
    } finally {
        fs.closeSync(fd);
    }
}

export function extractSessionTitleAndWorkspace(filePath: string, content?: string): { title: string; workspace: string; workspacePath?: string } {
    let title: string | null = null;
    let workspace: string | null = null;
    let workspacePath: string | null = null;

    // Fast heuristic for VS Code workspaceStorage
    const normFile = filePath.replace(/\\/g, '/');
    const wsHashMatch = normFile.match(/^(.*\/workspaceStorage\/[^/]+)/i);
    if (wsHashMatch) {
        const wsDir = wsHashMatch[1];
        const wsJson = path.join(wsDir, 'workspace.json');
        const folder = parseWorkspaceStorageJsonFile(wsJson, ['folder', 'configuration']);
        if (folder) {
            workspacePath = folder;
            workspace = path.basename(folder, '.code-workspace');
        }
    }

    // Fast heuristic from path for workspace/repository (e.g. Claude Code)
    const claudeMatch = filePath.match(/[\\/]\.claude[\\/]projects[\\/]([^\\/]+)/);
    if (claudeMatch && !workspace) {
        const folder = claudeMatch[1];
        const repoIdx = folder.toLowerCase().indexOf('repos-');
        if (repoIdx >= 0) {
            const after = folder.slice(repoIdx + 6).split('-');
            workspace = after.slice(Math.max(0, after.length - 2)).join('-');
        } else {
            const parts = folder.split('-');
            workspace = parts[parts.length - 1];
        }
    }

    if (!content) {
        try {
            const backing = getSessionBackingPath(filePath);
            content = readFileHead(backing, SESSION_HEAD_BYTES);
        } catch {
            return {
                title: workspace ? `${workspace} session` : path.basename(filePath, path.extname(filePath)),
                workspace: workspace || 'Workspace',
                workspacePath: workspacePath || (workspace && workspace !== 'Workspace' ? workspace : undefined),
            };
        }
    }

    const lines = content.split('\n');
    let firstUserText: string | null = null;

    for (let i = 0; i < Math.min(150, lines.length); i++) {
        const l = lines[i].trim();
        if (!l) { continue; }
        try {
            const obj = JSON.parse(l);

            // 1. Explicit title
            if (!title) {
                if (typeof obj.customTitle === 'string' && obj.customTitle.trim()) {
                    title = obj.customTitle.trim();
                } else if (typeof obj.aiTitle === 'string' && obj.aiTitle.trim()) {
                    title = obj.aiTitle.trim();
                } else if (typeof obj.title === 'string' && obj.title.trim() && obj.title !== 'Untitled session') {
                    title = obj.title.trim();
                }
            }

            // 2. Workspace and WorkspacePath from cwd, tool calls, or content
            if (!workspacePath) {
                let candidatePath: string | null = null;
                if (typeof obj.cwd === 'string' && obj.cwd.trim()) {
                    candidatePath = obj.cwd.trim();
                } else if (typeof obj.payload?.cwd === 'string' && obj.payload.cwd.trim()) {
                    candidatePath = obj.payload.cwd.trim();
                } else if (typeof obj.workspaceRoot === 'string' && obj.workspaceRoot.trim()) {
                    candidatePath = obj.workspaceRoot.trim();
                } else if (typeof obj.rootPath === 'string' && obj.rootPath.trim()) {
                    candidatePath = obj.rootPath.trim();
                } else if (Array.isArray(obj.tool_calls)) {
                    for (const tc of obj.tool_calls) {
                        const cwd = tc.args?.Cwd || tc.args?.cwd;
                        if (typeof cwd === 'string' && cwd.trim()) {
                            candidatePath = cwd.trim();
                            break;
                        }
                    }
                } else if (typeof obj.content === 'string') {
                    const wsMatch = obj.content.match(/Active Workspaces?:\s*\r?\n\s*-\s*([^\r\n]+)/i);
                    const cwdMatch = obj.content.match(/Command Working Directory:\s*([^\r\n]+)/i);
                    if (wsMatch) {
                        candidatePath = wsMatch[1].trim();
                    } else if (cwdMatch) {
                        candidatePath = cwdMatch[1].trim();
                    }
                }

                if (candidatePath) {
                    const clean = candidatePath.replace(/^"+|"+$/g, '').replace(/\/$/, '').replace(/\\$/, '');
                    if (clean && !clean.includes('\n')) {
                        workspacePath = clean;
                        workspace = path.basename(clean.replace(/\\/g, '/'));
                    }
                } else if (!workspace && (obj.git?.repository_url || obj.payload?.git?.repository_url)) {
                    const repoUrl = String(obj.git?.repository_url || obj.payload?.git?.repository_url);
                    workspace = path.basename(repoUrl, '.git');
                }
            }

            // 3. User message
            if (!firstUserText) {
                let msg = '';
                if (obj.type === 'USER_INPUT' && typeof obj.content === 'string') {
                    const userReqMatch = obj.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                    msg = userReqMatch ? userReqMatch[1].trim() : obj.content.trim();
                } else if (obj.type === 'user' && obj.message?.content) {
                    msg = typeof obj.message.content === 'string' ? obj.message.content : JSON.stringify(obj.message.content);
                } else if (obj.type === 'user.message' && obj.data?.content) {
                    msg = obj.data.content;
                } else if (obj.type === 'response_item' && obj.payload?.role === 'user' && obj.payload?.content) {
                    const c = obj.payload.content;
                    if (Array.isArray(c)) {
                        msg = c.map((x: any) => x.text || '').join(' ');
                    } else { msg = String(c); }
                } else if (obj.userMessage) {
                    msg = String(obj.userMessage);
                } else if (obj.message && obj.message.role === 'user') {
                    msg = typeof obj.message.content === 'string' ? obj.message.content : '';
                }

                if (msg) {
                    // Clean XML wrappers
                    msg = msg.replace(/<(?:environment_context|system_reminder|pasted_content|USER_REQUEST|ADDITIONAL_METADATA|user_information)[^>]*>[\s\S]*?<\/(?:environment_context|system_reminder|pasted_content|USER_REQUEST|ADDITIONAL_METADATA|user_information)>/gi, '');
                    msg = msg.replace(/<[^>]+>/g, '').trim();
                    if (msg.length > 5) {
                        firstUserText = msg.split('\n')[0].slice(0, 65).trim();
                    }
                }
            }
        } catch { /* skip line */ }
    }

    if (!workspace) {
        const norm = filePath.replace(/\\/g, '/');
        const reposMatch = norm.match(/repos\/([^/]+)/i);
        if (reposMatch) {
            workspace = reposMatch[1];
        } else {
            const parentDir = path.basename(path.dirname(filePath));
            if (parentDir && !parentDir.startsWith('.') && parentDir !== 'sessions' && parentDir !== 'projects' && parentDir !== 'logs') {
                workspace = parentDir;
            } else {
                workspace = 'Workspace';
            }
        }
    }

    if (!workspacePath && workspace && workspace !== 'Workspace') {
        workspacePath = workspace;
    }

    if (!title) {
        title = firstUserText || `${workspace} session`;
    }

    return {
        title: title || `${workspace} session`,
        workspace: workspace || 'Workspace',
        workspacePath: workspacePath || undefined,
    };
}

async function getSessionUsageAnalysisCached(file: string, mtimeMs: number, size: number): Promise<{ analysis: SessionUsageAnalysis; title: string; workspace: string; workspacePath?: string }> {
    const cached = usageCache.get(file);
    if (cached && cached.mtime === mtimeMs && cached.size === size && cached.title && cached.workspace) {
        if (cached.workspacePath) {
            return { analysis: cached.analysis, title: cached.title, workspace: cached.workspace, workspacePath: cached.workspacePath };
        }
        const { workspacePath } = extractSessionTitleAndWorkspace(file);
        cached.workspacePath = workspacePath || cached.workspace;
        usageCacheDirty = true;
        return { analysis: cached.analysis, title: cached.title, workspace: cached.workspace, workspacePath: cached.workspacePath };
    }
    const deps = {
        warn: () => { /* quiet */ },
        tokenEstimators,
        modelPricing,
        toolNameMap,
        ecosystems: getEcosystems(),
    };
    const analysis = await analyzeSessionUsage(deps, file);
    const { title, workspace, workspacePath } = extractSessionTitleAndWorkspace(file);
    usageCache.set(file, { mtime: mtimeMs, size, analysis, title, workspace, workspacePath });
    usageCacheDirty = true;
    return { analysis, title, workspace, workspacePath };
}

export async function calculateUsageAnalysisStatsFast(sessionFiles: string[]): Promise<UsageAnalysisStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last30DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cutoffStart = usageWindowCutoff(now);

    // Concurrently stat all session files and filter to only relevant ones
    const fileStats = await runWithConcurrency(sessionFiles, async (file) => {
        try {
            const stats = await statSessionFile(file);
            const inPeriodWindow = stats.mtime >= cutoffStart || file.includes('.db');
            return inPeriodWindow ? { file, stats } : null;
        } catch {
            return null;
        }
    }, 16);

    const relevant = fileStats.filter((f): f is NonNullable<typeof f> => f !== null);

    const todayPeriod = createEmptyUsageAnalysisPeriod();
    const last30DaysPeriod = createEmptyUsageAnalysisPeriod();
    const monthPeriod = createEmptyUsageAnalysisPeriod();
    const lastMonthPeriod = createEmptyUsageAnalysisPeriod();
    const todaySessions: TodaySessionSummary[] = [];
    const recentSessionItems: RecentSessionBucketItem<TodaySessionSummary>[] = [];

    // Concurrently process the relevant files using both cliCache and usageCache
    const analyzedResults = await runWithConcurrency(relevant, async ({ file, stats }) => {
        try {
            const { analysis, title, workspace, workspacePath } = await getSessionUsageAnalysisCached(file, stats.mtimeMs, stats.size);
            const data = stats.mtime >= last30DaysStart ? await processSessionFile(file) : undefined;
            return { file, stats, analysis, data, title, workspace, workspacePath };
        } catch {
            return null;
        }
    }, 16);

    for (const res of analyzedResults) {
        if (!res) { continue; }
        const { file, stats, analysis, data, title, workspace, workspacePath } = res;
        const modified = stats.mtime;

        if (modified < cutoffStart) { continue; }

        let sessionSummary: TodaySessionSummary | undefined;
        if (data && data.interactions > 0) {
            let inputTokens = 0, outputTokens = 0, cachedTokens = 0;
            for (const usage of Object.values(data.modelUsage)) {
                inputTokens += usage.inputTokens;
                outputTokens += usage.outputTokens;
                cachedTokens += usage.cachedReadTokens ?? 0;
            }
            sessionSummary = {
                title,
                workspace,
                workspacePath,
                filePath: file,
                interactions: data.interactions,
                toolCalls: analysis.toolCalls.total,
                inputTokens,
                outputTokens,
                thinkingTokens: data.thinkingTokens ?? 0,
                cachedTokens,
                totalTokens: data.tokens,
                estimatedCost: calculateEstimatedCost(data.modelUsage, modelPricing),
                editor: data.editorSource,
                models: Object.keys(data.modelUsage),
                lastActivity: data.lastModified.toISOString(),
                ...(analysis.sessionDuration?.totalDurationMs !== undefined ? { durationMs: analysis.sessionDuration.totalDurationMs } : {}),
                ...(analysis.sessionDuration?.activeDurationMs !== undefined ? { activeDurationMs: analysis.sessionDuration.activeDurationMs } : {}),
            };
            recentSessionItems.push({
                activityKey: toLocalDayKey(data.lastModified),
                interactions: data.interactions,
                value: sessionSummary,
            });
        }

        if (modified >= last30DaysStart) {
            mergeUsageAnalysis(last30DaysPeriod, analysis);
            last30DaysPeriod.sessions++;
        }
        if (modified >= monthStart) {
            mergeUsageAnalysis(monthPeriod, analysis);
            monthPeriod.sessions++;
        }
        if (modified >= todayStart) {
            mergeUsageAnalysis(todayPeriod, analysis);
            todayPeriod.sessions++;
            if (sessionSummary) { todaySessions.push(sessionSummary); }
        }
        if (modified >= lastMonthStart && modified < monthStart) {
            mergeUsageAnalysis(lastMonthPeriod, analysis);
            lastMonthPeriod.sessions++;
        }
    }

    saveWebUsageCache();

    const sortByLastActivityDesc = (a: TodaySessionSummary, b: TodaySessionSummary) => {
        const timeA = a.lastActivity ? Date.parse(a.lastActivity) : 0;
        const timeB = b.lastActivity ? Date.parse(b.lastActivity) : 0;
        return timeB - timeA;
    };

    const buckets = buildRecentSessionBuckets(recentSessionItems, now);
    buckets.last7.sort(sortByLastActivityDesc);
    buckets.last30.sort(sortByLastActivityDesc);
    buckets.currentMonth.sort(sortByLastActivityDesc);

    return {
        today: todayPeriod,
        last30Days: last30DaysPeriod,
        month: monthPeriod,
        lastMonth: lastMonthPeriod,
        lastUpdated: now,
        todaySessions: todaySessions.sort(sortByLastActivityDesc),
        recentSessions: buckets,
    };
}

export async function getAllRecentSessionsList(): Promise<Array<{
    file: string;
    filePath: string;
    title: string;
    workspace: string;
    workspacePath?: string;
    editor: string;
    interactions: number;
    tokens: number;
    lastActivity: string;
}>> {
    const usage = await getUsageStats();
    const map = new Map<string, TodaySessionSummary>();
    for (const s of [...(usage.recentSessions?.last30 || []), ...(usage.recentSessions?.last7 || []), ...(usage.todaySessions || [])]) {
        if (!map.has(s.filePath)) {
            map.set(s.filePath, s);
        }
    }
    const list = Array.from(map.values()).map(s => ({
        file: s.filePath,
        filePath: s.filePath,
        title: s.title || 'Session',
        workspace: s.workspace || 'Workspace',
        workspacePath: s.workspacePath || s.workspace,
        editor: s.editor || 'Unknown',
        interactions: s.interactions || 0,
        tokens: s.totalTokens || 0,
        lastActivity: s.lastActivity || new Date().toISOString(),
    }));
    return list.sort((a, b) => (Date.parse(b.lastActivity) || 0) - (Date.parse(a.lastActivity) || 0));
}

// ---------------------------------------------------------------------------
// Unified Concurrent Dataset Loading
// ---------------------------------------------------------------------------

let cachesLoaded = false;
async function ensureCachesLoaded(): Promise<void> {
    // Load from disk once: reloading would discard entries parsed since the last save.
    if (cachesLoaded) { return; }
    cachesLoaded = true;
    await loadCache();
    loadWebUsageCache();
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
        return await fn();
    } finally {
        console.log(`[stats] ${label}: ${Date.now() - startedAt}ms`);
    }
}

/** Run the aggregate calculators one after another against warm caches and publish the result. */
async function publishDatasets(files: string[], generation: number): Promise<void> {
    const stats = await timed('detailed', () => calculateDetailedStats(files));
    const { labels, days, allDaysMap } = await timed('daily', () => calculateDailyStats(files));
    const usageStats = await timed('usage', () => calculateUsageAnalysisStatsFast(files));
    const diagData = await timed('diagnostics', () => buildDiagnosticsDataInternal(files));

    if (generation === dataGeneration) {
        cachedStats = stats;
        cachedChartPayload = buildChartPayload(labels, days, allDaysMap);
        cachedUsageStats = usageStats;
        cachedDiagnosticsData = diagData;
        cachedDataDay = toLocalDayKey(stats.lastUpdated);
    }
    await saveCache();
    saveWebUsageCache();
}

async function computeAllDatasets(files: string[]): Promise<void> {
    const startGeneration = dataGeneration;
    await ensureCachesLoaded();

    const sizes = await statSessionSizes(files);
    const heavyFiles = files.filter((f) => (sizes.get(f) ?? 0) > LIGHT_FILE_BYTES);
    const lightFiles = files.filter((f) => (sizes.get(f) ?? 0) <= LIGHT_FILE_BYTES);

    await timed(`prewarm ${lightFiles.length} light files`, () => prewarmSessionCaches(lightFiles, sizes));
    await publishDatasets(lightFiles, startGeneration);

    if (heavyFiles.length === 0) { return; }
    // Heavy sessions finish in the background; the next request sees the complete datasets.
    void shareInFlight('heavy-sessions', async () => {
        await timed(`prewarm ${heavyFiles.length} heavy files`, () => prewarmSessionCaches(heavyFiles, sizes));
        await publishDatasets(files, startGeneration);
        console.log('[stats] heavy sessions included');
    }).catch((err) => console.error('Heavy session processing failed:', err));
}

export function getStats(): Promise<DetailedStats> {
    expireCachesOnDateChange();
    if (cachedStats) { return Promise.resolve(cachedStats); }
    return shareInFlight('stats', async () => {
        const files = await getSessionFiles();
        await computeAllDatasets(files);
        return cachedStats!;
    });
}

export function getUsageStats(): Promise<UsageAnalysisStats> {
    expireCachesOnDateChange();
    if (cachedUsageStats) { return Promise.resolve(cachedUsageStats); }
    return shareInFlight('usage', async () => {
        const files = await getSessionFiles();
        await computeAllDatasets(files);
        return cachedUsageStats!;
    });
}

export function getChartPayload(): Promise<object> {
    expireCachesOnDateChange();
    if (cachedChartPayload) { return Promise.resolve(cachedChartPayload); }
    return shareInFlight('chart', async () => {
        const files = await getSessionFiles();
        await computeAllDatasets(files);
        return cachedChartPayload!;
    });
}

export async function refreshStats(): Promise<void> {
    if (isRefreshing) { return; }
    isRefreshing = true;
    try {
        const files = await discoverSessionFiles();
        dataGeneration++;
        cachedSessionFiles = files;
        await computeAllDatasets(files);
        await saveCache();
        saveWebUsageCache();
    } finally {
        isRefreshing = false;
    }
}

let cachedWebviewLocalization: Record<string, string> | undefined;
export function getWebviewLocalization(): Record<string, string> {
    if (!cachedWebviewLocalization) {
        const language = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
        cachedWebviewLocalization = {
            ...buildWebviewLocalization(createTranslator(language)),
            '__language__': language,
        };
    }
    return cachedWebviewLocalization;
}

export function getSystemLocale(): string {
    return resolvedLocale(Intl.DateTimeFormat().resolvedOptions().locale || 'en');
}

export function buildDiagnosticReport(sessionFileCount: number): string {
    return `AI Engineering Fluency — Web Diagnostic Report\n${'='.repeat(50)}\n\nVersion: 0.1.0\nSession files found: ${sessionFileCount}\nTimestamp: ${new Date().toISOString()}`;
}

const DIAGNOSTICS_SESSION_DAYS = 14;
const DIAGNOSTICS_SESSION_LIMIT = 500;

export async function buildDetailedSessionFiles(sessionFiles: { file: string; size: number; modified: string }[]) {
    const cutoff = Date.now() - DIAGNOSTICS_SESSION_DAYS * 24 * 60 * 60 * 1000;
    const candidates = sessionFiles.filter((f) => {
        if (f.file.includes('.db#') || f.file.endsWith('.db')) { return true; }
        const m = Date.parse(f.modified);
        return isNaN(m) || m >= cutoff;
    });

    const rows = await runWithConcurrency(candidates, async (f) => {
        let meta: Awaited<ReturnType<typeof getSessionMeta>> = null;
        let data: { editorSource?: string; lastInteraction?: string } | null = null;
        let sessionData: Awaited<ReturnType<typeof processSessionFile>> = null;
        try {
            sessionData = await processSessionFile(f.file);
        } catch { /* parse failure */ }
        try {
            meta = await getSessionMeta(f.file);
            data = await getSessionLastActivity(f.file).then(d => d ? { lastInteraction: d.toISOString() } : null);
        } catch { /* parse failure */ }
        const lastInteraction = meta?.lastInteraction ?? data?.lastInteraction ?? (sessionData?.lastModified ? sessionData.lastModified.toISOString() : null);
        return {
            file: f.file,
            title: meta?.title || null,
            size: f.size,
            modified: f.modified,
            interactions: sessionData?.interactions ?? (meta as any)?.interactions ?? 0,
            tokens: sessionData?.tokens,
            modelUsage: sessionData?.modelUsage,
            contextReferences: createEmptyContextRefs(),
            firstInteraction: meta?.firstInteraction ?? null,
            lastInteraction,
            editorSource: sessionData?.editorSource || data?.editorSource || sessionEditorName(f.file),
        };
    }, 16);

    return rows
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .filter(r => r.lastInteraction !== null && Date.parse(r.lastInteraction) >= cutoff)
        .sort((a, b) => Date.parse(b.lastInteraction!) - Date.parse(a.lastInteraction!))
        .slice(0, DIAGNOSTICS_SESSION_LIMIT);
}

async function buildDiagnosticsDataInternal(files: string[]) {
    const diagnosticPaths = getDiagnosticPaths();
    const rawSessionFiles = await runWithConcurrency(files, async (f) => {
        try {
            const s = await fs.promises.stat(getSessionBackingPath(f));
            return { file: f, size: s.size, modified: s.mtime.toISOString() };
        } catch {
            return { file: f, size: 0, modified: new Date().toISOString() };
        }
    }, 16);
    const sessionFiles = rawSessionFiles.filter((f): f is { file: string; size: number; modified: string } => f !== undefined);
    const toolFamilies = getToolFamilies();
    const detailedSessionFiles = await buildDetailedSessionFiles(sessionFiles);

    return {
        report: buildDiagnosticReport(files.length),
        sessionFiles,
        detailedSessionFiles,
        sessionFolders: [],
        cacheInfo: { size: usageCache.size, sizeInMB: 0, lastUpdated: new Date().toISOString(), location: 'Disk (~/.copilot-token-tracker)', storagePath: USAGE_CACHE_PATH },
        backendStorageInfo: null,
        backendConfigured: false,
        isDebugMode: false,
        globalStateCounters: { openCount: 0, unknownMcpOpenCount: 0, fluencyBannerDismissed: false, unknownMcpDismissedVersion: '' },
        displaySettings: { showTokens: true, showCost: true, monthlyBudget: 0 },
        quotaEntitlements: null,
        toolCallStats: null,
        toolFamilies,
        diagnosticPaths,
    };
}

export function getDiagnosticsData(): Promise<any> {
    if (cachedDiagnosticsData) { return Promise.resolve(cachedDiagnosticsData); }
    return shareInFlight('diagnostics', async () => {
        const files = await getSessionFiles();
        await computeAllDatasets(files);
        return cachedDiagnosticsData;
    });
}

export function getModelUsageTimeRangeBounds(range: string, now: Date = new Date()): { startMs: number; endMs: number } | null {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const todayStart = startOfDay(now);
    switch (range) {
        case 'today':
            return { startMs: todayStart, endMs: now.getTime() };
        case 'yesterday': {
            const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
            return { startMs: yesterdayStart, endMs: todayStart };
        }
        case 'week': {
            const dayOfWeek = (now.getDay() + 6) % 7;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
            return { startMs: weekStart, endMs: now.getTime() };
        }
        case 'month':
            return { startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), endMs: now.getTime() };
        case 'lastMonth':
            return {
                startMs: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
                endMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
            };
        default:
            return null;
    }
}

export async function analyzeModelUsageData(editor: string = 'all', timeRange: string = 'all') {
    const diagData = await getDiagnosticsData();
    const files = (diagData.detailedSessionFiles || []) as any[];

    const editorMatching = editor === 'all'
        ? files
        : files.filter(f => (f.editorSource || 'Unknown') === editor);

    const bounds = getModelUsageTimeRangeBounds(timeRange);
    const matching = bounds
        ? editorMatching.filter(f => {
            const raw = f.lastInteraction || f.firstInteraction || f.modified;
            if (!raw) { return false; }
            const ts = Date.parse(raw);
            return !isNaN(ts) && ts >= bounds.startMs && ts < bounds.endMs;
        })
        : editorMatching;

    const aggregated: Record<string, any> = {};
    const sessionCounts: Record<string, number> = {};
    let filesWithUsage = 0;

    for (const f of matching) {
        if (!f.modelUsage || Object.keys(f.modelUsage).length === 0) { continue; }
        filesWithUsage++;
        for (const [model, usage] of Object.entries(f.modelUsage as Record<string, any>)) {
            if (!aggregated[model]) {
                aggregated[model] = {
                    inputTokens: 0,
                    outputTokens: 0,
                    cachedReadTokens: 0,
                    cacheCreationTokens: 0,
                    cacheCreation1hTokens: 0,
                    sessions: 0,
                };
            }
            addModelUsage(aggregated, { [model]: { ...usage, sessions: 0 } });
            sessionCounts[model] = (sessionCounts[model] || 0) + 1;
        }
    }

    const rows = Object.entries(aggregated).map(([model, usage]) => ({
        model,
        sessionCount: sessionCounts[model] || 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedReadTokens: usage.cachedReadTokens || 0,
        cacheCreationTokens: usage.cacheCreationTokens || 0,
        cacheCreation1hTokens: usage.cacheCreation1hTokens || 0,
        estimatedCost: calculateEstimatedCost({ [model]: usage }, modelPricing),
    })).sort((a, b) => b.estimatedCost - a.estimatedCost);

    const totalCost = calculateEstimatedCost(aggregated, modelPricing);
    const supportsCache1h = Object.keys(aggregated).some(
        model => (modelPricing as any)[model]?.cacheCreation1hCostPerMillion !== undefined
    );

    return {
        command: 'modelUsageResult',
        editor,
        timeRange,
        fileCount: matching.length,
        filesWithUsage,
        rows,
        totalCost,
        supportsCache1h,
    };
}

export async function getMaturityData() {
    const maturityData = await calculateMaturityScores(undefined, () => getUsageStats());
    return { ...maturityData, backendConfigured: false, dismissedTips: [], isDebugMode: false };
}

export function getFluencyData() {
    return { ...getFluencyLevelData(false), backendConfigured: false };
}

export async function initStats(): Promise<void> {
    await ensureCachesLoaded();
    // Warm all datasets at startup
    const files = await getSessionFiles();
    await computeAllDatasets(files);
}
