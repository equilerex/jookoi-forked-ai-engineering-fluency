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

export function extractSessionTitleAndWorkspace(filePath: string, content?: string): { title: string; workspace: string } {
    let title: string | null = null;
    let workspace: string | null = null;

    // Fast heuristic from path for workspace/repository
    const claudeMatch = filePath.match(/[\\/]\.claude[\\/]projects[\\/]([^\\/]+)/);
    if (claudeMatch) {
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
            content = fs.readFileSync(backing, 'utf8');
        } catch {
            return {
                title: workspace ? `${workspace} session` : path.basename(filePath, path.extname(filePath)),
                workspace: workspace || 'Workspace',
            };
        }
    }

    const lines = content.split('\n');
    let firstUserText: string | null = null;

    for (let i = 0; i < Math.min(120, lines.length); i++) {
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

            // 2. Workspace from cwd or git
            if (!workspace) {
                if (typeof obj.cwd === 'string' && obj.cwd.trim()) {
                    workspace = path.basename(obj.cwd.replace(/\\/g, '/').replace(/\/$/, ''));
                } else if (typeof obj.payload?.cwd === 'string' && obj.payload.cwd.trim()) {
                    workspace = path.basename(obj.payload.cwd.replace(/\\/g, '/').replace(/\/$/, ''));
                } else if (obj.git?.repository_url || obj.payload?.git?.repository_url) {
                    const repoUrl = String(obj.git?.repository_url || obj.payload?.git?.repository_url);
                    workspace = path.basename(repoUrl, '.git');
                }
            }

            // 3. User message
            if (!firstUserText) {
                let msg = '';
                if (obj.type === 'user' && obj.message?.content) {
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
                    msg = msg.replace(/<(?:environment_context|system_reminder|pasted_content)[^>]*>[\s\S]*?<\/(?:environment_context|system_reminder|pasted_content)>/gi, '');
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
            if (parentDir && !parentDir.startsWith('.') && parentDir !== 'sessions' && parentDir !== 'projects') {
                workspace = parentDir;
            } else {
                workspace = 'Workspace';
            }
        }
    }

    if (!title) {
        title = firstUserText || `${workspace} session`;
    }

    return {
        title: title || `${workspace} session`,
        workspace: workspace || 'Workspace',
    };
}

async function getSessionUsageAnalysisCached(file: string, mtimeMs: number, size: number): Promise<{ analysis: SessionUsageAnalysis; title: string; workspace: string }> {
    const cached = usageCache.get(file);
    if (cached && cached.mtime === mtimeMs && cached.size === size && cached.title && cached.workspace) {
        return { analysis: cached.analysis, title: cached.title, workspace: cached.workspace };
    }
    const deps = {
        warn: () => { /* quiet */ },
        tokenEstimators,
        modelPricing,
        toolNameMap,
        ecosystems: getEcosystems(),
    };
    const analysis = await analyzeSessionUsage(deps, file);
    const { title, workspace } = extractSessionTitleAndWorkspace(file);
    usageCache.set(file, { mtime: mtimeMs, size, analysis, title, workspace });
    usageCacheDirty = true;
    return { analysis, title, workspace };
}

export async function calculateUsageAnalysisStatsFast(sessionFiles: string[]): Promise<UsageAnalysisStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last30DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cutoffStart = lastMonthStart < last30DaysStart ? lastMonthStart : last30DaysStart;

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
            const { analysis, title, workspace } = await getSessionUsageAnalysisCached(file, stats.mtimeMs, stats.size);
            const data = stats.mtime >= last30DaysStart ? await processSessionFile(file) : undefined;
            return { file, stats, analysis, data, title, workspace };
        } catch {
            return null;
        }
    }, 16);

    for (const res of analyzedResults) {
        if (!res) { continue; }
        const { file, stats, analysis, data, title, workspace } = res;
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
    title: string;
    workspace: string;
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
        title: s.title || 'Session',
        workspace: s.workspace || 'Workspace',
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

async function computeAllDatasets(files: string[]): Promise<void> {
    const startGeneration = dataGeneration;
    await loadCache();
    loadWebUsageCache();

    const [stats, { labels, days, allDaysMap }, usageStats, diagData] = await Promise.all([
        calculateDetailedStats(files),
        calculateDailyStats(files),
        calculateUsageAnalysisStatsFast(files),
        buildDiagnosticsDataInternal(files),
    ]);

    if (startGeneration === dataGeneration) {
        cachedStats = stats;
        cachedChartPayload = buildChartPayload(labels, days, allDaysMap);
        cachedUsageStats = usageStats;
        cachedDiagnosticsData = diagData;
        cachedDataDay = toLocalDayKey(stats.lastUpdated);
    }
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
        try {
            meta = await getSessionMeta(f.file);
            data = await getSessionLastActivity(f.file).then(d => d ? { lastInteraction: d.toISOString() } : null);
        } catch { /* parse failure */ }
        const lastInteraction = meta?.lastInteraction ?? data?.lastInteraction ?? null;
        return {
            file: f.file,
            title: meta?.title || null,
            size: f.size,
            modified: f.modified,
            interactions: (meta as any)?.interactions ?? 0,
            contextReferences: createEmptyContextRefs(),
            firstInteraction: meta?.firstInteraction ?? null,
            lastInteraction,
            editorSource: data?.editorSource || sessionEditorName(f.file),
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

export async function getMaturityData() {
    const maturityData = await calculateMaturityScores(undefined, () => getUsageStats());
    return { ...maturityData, backendConfigured: false, dismissedTips: [], isDebugMode: false };
}

export function getFluencyData() {
    return { ...getFluencyLevelData(false), backendConfigured: false };
}

export async function initStats(): Promise<void> {
    await loadCache();
    loadWebUsageCache();
    // Warm all datasets in parallel at startup
    const files = await getSessionFiles();
    await computeAllDatasets(files);
}
