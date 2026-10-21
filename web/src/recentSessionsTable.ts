/**
 * Web-owned Recent Sessions table for the usage embed (`/usage?embed=1`, Sessions tab).
 *
 * The shared table from the VS Code usage bundle stays in the DOM, hidden. This table is mounted
 * after it and renders from `window.__INITIAL_USAGE__`. It keeps the shared features (sort, period,
 * pill filters, Columns menu, full column set) and adds search, Load more, and remembered sort,
 * period and column visibility. Search and pill state live for the page only.
 *
 * Ported, not imported: the model display-name and billing-provider helpers, the pill filter rules
 * and the column definitions are copies of `vscode-extension/src/webview/usage/main.ts` and
 * `vscode-extension/src/webview/shared/modelUtils.ts`. An upstream change does not reach this file.
 *
 * `installRecentSessionsTable` is serialised with `toString()` and runs inside the embedded page.
 * It must stay self-contained: no imports and no references to module-level values. Types are erased
 * at build time and may stay.
 */

type RecentSessionPeriod = 'today' | 'last7' | 'last30' | 'currentMonth';
type RecentSessionSortDirection = 'asc' | 'desc';

export const RECENT_SESSIONS_STORAGE_KEYS = {
    sort: 'fluency-recent-sessions-sort',
    period: 'fluency-recent-sessions-period',
    columns: 'fluency-recent-sessions-columns',
} as const;

const RECENT_SESSIONS_BATCH_SIZE = 50;

export const RECENT_SESSIONS_STYLES = `
body.web-recent-sessions-active #tab-panel-sessions #sessions-panel-body,
body.web-recent-sessions-active #tab-panel-sessions #sessions-lookback-wrapper,
body.web-recent-sessions-active #tab-panel-sessions .columns-menu-wrap,
body.web-recent-sessions-active #tab-panel-sessions .section-subtitle {
    display: none !important;
}
#web-recent-sessions [hidden] {
    display: none !important;
}
#web-recent-sessions {
    margin-top: 8px;
}
#web-recent-sessions .web-recent-sessions-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
#web-recent-sessions .web-recent-sessions-search {
    flex: 1 1 180px;
    min-width: 0;
    font: inherit;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle, transparent);
    background: var(--vscode-input-background, var(--bg-secondary, transparent));
    color: var(--vscode-input-foreground, var(--text-primary, inherit));
}
#web-recent-sessions .web-recent-sessions-search:focus {
    outline: 1px solid var(--vscode-focusBorder, var(--link-color, currentColor));
    outline-offset: -1px;
}
#web-recent-sessions .web-recent-sessions-columns-wrap {
    position: relative;
}
#web-recent-sessions .web-recent-sessions-columns-toggle,
#web-recent-sessions .web-recent-sessions-load-more,
#web-recent-sessions .web-recent-sessions-empty button {
    font: inherit;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle, transparent);
    background: var(--vscode-dropdown-background, var(--bg-secondary, transparent));
    color: var(--vscode-dropdown-foreground, var(--text-primary, inherit));
    cursor: pointer;
}
#web-recent-sessions .web-recent-sessions-columns-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 4px 0;
    border-radius: 6px;
    border: 1px solid var(--border-color, var(--border-subtle, transparent));
    background: var(--bg-secondary, var(--vscode-dropdown-background, transparent));
    box-shadow: 0 4px 10px var(--shadow-color, transparent);
}
#web-recent-sessions .web-recent-sessions-column-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
}
#web-recent-sessions .web-recent-sessions-count {
    margin: 6px 0;
    font-size: 11px;
    color: var(--text-secondary, inherit);
}
#web-recent-sessions .web-recent-sessions-empty {
    padding: 16px;
    font-size: 13px;
    color: var(--text-secondary, inherit);
}
#web-recent-sessions .web-recent-sessions-empty button {
    margin-left: 8px;
}
#web-recent-sessions .web-recent-sessions-load-more {
    margin-top: 8px;
}
#web-recent-sessions .data-table-scroll {
    overflow-x: auto;
}
#web-recent-sessions .web-recent-sessions-near-limit {
    color: var(--warning-color, #cca700);
}
`;

interface RecentSessionsConfig {
    storageKeys: { sort: string; period: string; columns: string };
    batchSize: number;
}

const RECENT_SESSIONS_CONFIG: RecentSessionsConfig = {
    storageKeys: RECENT_SESSIONS_STORAGE_KEYS,
    batchSize: RECENT_SESSIONS_BATCH_SIZE,
};

function installRecentSessionsTable(config: RecentSessionsConfig): void {
    interface SessionRow {
        title?: string;
        workspace?: string;
        workspacePath?: string;
        filePath: string;
        interactions: number;
        toolCalls: number;
        subAgentCalls?: number;
        inputTokens: number;
        outputTokens: number;
        thinkingTokens: number;
        cachedTokens: number;
        totalTokens: number;
        estimatedCost: number;
        editor?: string;
        models: string[];
        lastActivity?: string;
        durationMs?: number;
        activeDurationMs?: number;
        contextWindowLimit?: number;
        contextReachedTokens?: number;
        truncationCount?: number;
    }
    interface UsagePayload {
        todaySessions?: unknown;
        recentSessions?: Record<string, unknown>;
        use24HourTime?: boolean;
    }
    interface VsCodeApi {
        postMessage(message: unknown): void;
    }
    interface ModelPricingEntry {
        displayNames?: string[];
    }
    interface RecentSessionsWindow extends Window {
        __webRecentSessionsInstalled?: boolean;
        __INITIAL_USAGE__?: unknown;
        __MODEL_PRICING__?: { pricing?: Record<string, ModelPricingEntry | null> };
        acquireVsCodeApi?: () => VsCodeApi;
    }
    type SortValue = string | number | null | undefined;
    interface CellContent {
        text: string;
        title?: string;
        className?: string;
    }
    interface ColumnDef {
        id: string;
        label: string;
        align: 'left' | 'right';
        cellClass?: string;
        sortValue?: (row: SessionRow) => SortValue;
        cell?: (row: SessionRow) => CellContent;
    }
    interface FilterOption {
        value: string;
        label: string;
        count: number;
    }
    interface RecentSessionsState {
        period: RecentSessionPeriod;
        sortColumn: string;
        sortDirection: RecentSessionSortDirection;
        visibleColumns: Set<string>;
        search: string;
        editorFilters: Set<string>;
        vendorFilters: Set<string>;
        modelFilters: Set<string>;
        hydraFusionOnly: boolean;
        nearLimitOnly: boolean;
    }
    interface MountedView {
        root: HTMLElement;
        searchInput: HTMLInputElement;
        pillHost: HTMLElement;
        countLine: HTMLElement;
        emptyBlock: HTMLElement;
        emptyText: HTMLElement;
        emptyClear: HTMLButtonElement;
        tableScroll: HTMLElement;
        tableHead: HTMLTableSectionElement;
        tableBody: HTMLTableSectionElement;
        loadMoreButton: HTMLButtonElement;
        loadObserver: IntersectionObserver;
        rows: SessionRow[];
        renderedCount: number;
    }

    const pageWindow = window as RecentSessionsWindow;
    if (!document.body || pageWindow.__webRecentSessionsInstalled) { return; }
    pageWindow.__webRecentSessionsInstalled = true;

    const batchSize = config.batchSize;
    const storageKeys = config.storageKeys;
    const NEAR_LIMIT_RATIO = 0.8;
    const NEAR_LIMIT_PERCENT = Math.round(NEAR_LIMIT_RATIO * 100);
    const NO_CONTEXT_DATA_TITLE = 'No context-window fill recorded for this session (only GitHub Copilot CLI sessions report one)';
    const PERIOD_OPTIONS: Array<{ value: RecentSessionPeriod; label: string }> = [
        { value: 'today', label: 'Today' },
        { value: 'last7', label: 'Last 7 days' },
        { value: 'last30', label: 'Last 30 days' },
        { value: 'currentMonth', label: 'Current month' },
    ];
    const UUID_PREFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
    const ROUTER_DISPLAY_NAMES: Record<string, string> = Object.assign(Object.create(null), {
        hydrafusion: 'HydraFusion',
        auto: 'Auto',
    });
    // Prefix-to-billing-provider lookup, checked in order. Copy of `MODEL_PROVIDER_PREFIXES` in src/chartDataBuilder.ts.
    const MODEL_PROVIDER_PREFIXES: Array<[string, string]> = [
        ['anthropic', 'Anthropic'],
        ['claude', 'Anthropic'],
        ['codestral', 'Mistral AI'],
        ['devstral', 'Mistral AI'],
        ['gemini', 'Google'],
        ['glm', 'Z.ai'],
        ['goldeneye', 'xAI'],
        ['google', 'Google'],
        ['gpt', 'OpenAI'],
        ['grok', 'xAI'],
        ['magistral', 'Mistral AI'],
        ['mai-', 'Microsoft'],
        ['ministral', 'Mistral AI'],
        ['mistral', 'Mistral AI'],
        ['o1', 'OpenAI'],
        ['o3', 'OpenAI'],
        ['o4', 'OpenAI'],
        ['pixtral', 'Mistral AI'],
        ['qwen', 'Alibaba'],
        ['raptor', 'xAI'],
    ];
    const compactNumberFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    const costFormat = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    let vscodeApi: VsCodeApi | undefined;
    try {
        vscodeApi = pageWindow.acquireVsCodeApi ? pageWindow.acquireVsCodeApi() : undefined;
    } catch (error) {
        vscodeApi = undefined;
    }
    let activeView: MountedView | undefined;
    let mountQueued = false;
    let searchFrameQueued = false;
    let pricingDisplayNames: Record<string, string> | undefined;
    let rowsByPeriod: Record<RecentSessionPeriod, SessionRow[]> = { today: [], last7: [], last30: [], currentMonth: [] };
    let use24HourTime = true;

    function classNames(...names: Array<string | undefined | false>): string {
        return names.filter(Boolean).join(' ');
    }

    function createElement<Tag extends keyof HTMLElementTagNameMap>(
        tag: Tag,
        options: { className?: string; text?: string; attributes?: Record<string, string> } = {},
    ): HTMLElementTagNameMap[Tag] {
        const element = document.createElement(tag);
        if (options.className) { element.className = options.className; }
        if (options.text !== undefined) { element.textContent = options.text; }
        for (const [name, value] of Object.entries(options.attributes ?? {})) {
            element.setAttribute(name, value);
        }
        return element;
    }

    function isPeriod(value: string): value is RecentSessionPeriod {
        return PERIOD_OPTIONS.some(option => option.value === value);
    }

    function decodeSegment(segment: string): string {
        try {
            return decodeURIComponent(segment);
        } catch (error) {
            return segment;
        }
    }

    /** Three-part custom-endpoint ids: `<source>/<provider name>/<model id>`. */
    function parseCustomProviderModel(model: string): { providerName: string; modelId: string } | undefined {
        const parts = model.split('/');
        if (parts.length !== 3 || parts.some(part => part.trim() === '')) { return undefined; }
        return { providerName: decodeSegment(parts[1]), modelId: decodeSegment(parts[2]) };
    }

    function modelLookupCandidates(model: string): string[] {
        const candidates: string[] = [];
        const add = (id: string) => {
            if (id && candidates.indexOf(id) === -1) { candidates.push(id); }
        };
        const addWithVersionVariant = (id: string) => {
            add(id);
            add(id.replace(/(\d+)-(\d+)(?=-|$)/, '$1.$2'));
        };
        const base = model.replace(/^copilot\//, '');
        addWithVersionVariant(base);
        const custom = parseCustomProviderModel(base);
        if (custom) { addWithVersionVariant(custom.modelId); }
        if (UUID_PREFIX_PATTERN.test(base)) { addWithVersionVariant(base.replace(UUID_PREFIX_PATTERN, '')); }
        return candidates;
    }

    function displayNameFromPricing(modelId: string): string | undefined {
        if (!pricingDisplayNames) {
            pricingDisplayNames = Object.create(null) as Record<string, string>;
            const pricing: Record<string, ModelPricingEntry | null> = pageWindow.__MODEL_PRICING__?.pricing ?? {};
            for (const [pricedId, entry] of Object.entries(pricing)) {
                if (entry?.displayNames && entry.displayNames.length > 0) {
                    pricingDisplayNames[pricedId] = entry.displayNames[0];
                }
            }
        }
        const name = pricingDisplayNames[modelId];
        return typeof name === 'string' && name ? name : undefined;
    }

    function modelDisplayName(model: string): string {
        if (ROUTER_DISPLAY_NAMES[model]) { return ROUTER_DISPLAY_NAMES[model]; }
        for (const candidate of modelLookupCandidates(model)) {
            const name = displayNameFromPricing(candidate);
            if (name) { return name; }
        }
        const custom = parseCustomProviderModel(model);
        if (custom) { return custom.modelId; }
        if (UUID_PREFIX_PATTERN.test(model)) { return model.replace(UUID_PREFIX_PATTERN, ''); }
        return decodeSegment(model);
    }

    function billingProviderOf(modelId: string): string {
        const custom = parseCustomProviderModel(modelId);
        if (custom) { return `${custom.providerName} (Custom)`; }
        // HydraFusion is Copilot's own router, so the provider is Copilot.
        if (modelId === 'hydrafusion') { return 'GitHub Copilot'; }
        const match = modelLookupCandidates(modelId)
            .flatMap(candidate => MODEL_PROVIDER_PREFIXES.filter(([prefix]) => candidate.toLowerCase().startsWith(prefix)))[0];
        return match ? match[1] : 'Other';
    }

    function isHydraFusionModel(model: string): boolean {
        return modelLookupCandidates(model)
            .some(candidate => candidate.toLowerCase().replace(/[-_. ]/g, '').startsWith('hydrafusion'));
    }

    function formatDuration(durationMs: number | undefined): string {
        if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) { return '—'; }
        const totalMinutes = Math.round(durationMs / 60000);
        if (totalMinutes < 1) { return '<1m'; }
        if (totalMinutes < 60) { return `${totalMinutes}m`; }
        return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
    }

    function timestampValue(iso: string | undefined): number | null {
        const time = iso ? Date.parse(iso) : NaN;
        return Number.isFinite(time) ? time : null;
    }

    function formatLastActive(iso: string | undefined): string {
        if (!iso) { return '—'; }
        const date = new Date(iso);
        const hour12 = !use24HourTime;
        return state.period === 'today'
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12 })
            : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12 });
    }

    function effectiveDurationMs(row: SessionRow): number | undefined {
        return row.activeDurationMs ? row.activeDurationMs : row.durationMs;
    }

    function contextFillPercent(row: SessionRow): number | undefined {
        const limit = row.contextWindowLimit;
        const reached = row.contextReachedTokens;
        if (!limit || !reached || reached <= 0) { return undefined; }
        return Math.min(100, Math.floor((reached / limit) * 100));
    }

    function isNearContextLimit(row: SessionRow): boolean {
        if (row.truncationCount) { return false; }
        const limit = row.contextWindowLimit;
        const reached = row.contextReachedTokens;
        if (!limit || !reached || reached <= 0) { return false; }
        return reached >= limit * NEAR_LIMIT_RATIO;
    }

    function countCell(value: number): CellContent {
        const safeValue = Number.isFinite(value) ? value : 0;
        return { text: compactNumberFormat.format(safeValue), title: safeValue.toLocaleString() };
    }

    function subAgentCell(row: SessionRow): CellContent {
        if (row.subAgentCalls) {
            return {
                text: compactNumberFormat.format(row.subAgentCalls),
                title: `${row.subAgentCalls.toLocaleString()} sub-agent tool call${row.subAgentCalls === 1 ? '' : 's'} detected in this session`,
            };
        }
        return row.subAgentCalls === undefined
            ? { text: '—', title: 'Not recorded for this session in the web view' }
            : { text: '—', title: 'No sub-agent calls detected in this session' };
    }

    function costCell(row: SessionRow): CellContent {
        return row.estimatedCost > 0
            ? { text: costFormat.format(row.estimatedCost), title: `$${row.estimatedCost.toFixed(4)}` }
            : { text: '—' };
    }

    function modelsCell(row: SessionRow): CellContent {
        const names = row.models.map(modelDisplayName).join(', ') || '—';
        return { text: names, title: names };
    }

    function durationCell(row: SessionRow): CellContent {
        const wallTime = row.durationMs !== undefined ? `Wall time: ${formatDuration(row.durationMs)}` : undefined;
        return { text: formatDuration(effectiveDurationMs(row)), title: wallTime };
    }

    function contextCell(row: SessionRow): CellContent {
        const percent = contextFillPercent(row);
        if (percent === undefined) { return { text: '—', title: NO_CONTEXT_DATA_TITLE }; }
        const reached = (row.contextReachedTokens ?? 0).toLocaleString();
        const limit = (row.contextWindowLimit ?? 0).toLocaleString();
        const near = isNearContextLimit(row);
        return {
            text: `${near ? '⚠️ ' : ''}${percent}%`,
            title: near
                ? `${reached} of ${limit} context tokens used — at or past ${NEAR_LIMIT_PERCENT}% of the window`
                : `${reached} of ${limit} context tokens used`,
            className: near ? 'web-recent-sessions-near-limit' : undefined,
        };
    }

    // Column order and labels match SESSION_COLUMN_DEFS in vscode-extension/src/webview/usage/main.ts.
    // `#` and Title are always shown; the rest can be hidden from the Columns menu.
    const optionalColumns: ColumnDef[] = [
        { id: 'interactions', label: 'Turns', align: 'right', sortValue: row => row.interactions, cell: row => countCell(row.interactions) },
        { id: 'toolCalls', label: 'Tools', align: 'right', sortValue: row => row.toolCalls, cell: row => countCell(row.toolCalls) },
        { id: 'subAgentCalls', label: 'Sub-Agents', align: 'right', sortValue: row => row.subAgentCalls ?? 0, cell: subAgentCell },
        { id: 'inputTokens', label: 'Input', align: 'right', sortValue: row => row.inputTokens, cell: row => countCell(row.inputTokens) },
        { id: 'outputTokens', label: 'Output', align: 'right', sortValue: row => row.outputTokens, cell: row => countCell(row.outputTokens) },
        { id: 'thinkingTokens', label: 'Thinking', align: 'right', sortValue: row => row.thinkingTokens, cell: row => countCell(row.thinkingTokens) },
        { id: 'cachedTokens', label: 'Cached', align: 'right', sortValue: row => row.cachedTokens, cell: row => countCell(row.cachedTokens) },
        { id: 'totalTokens', label: 'Total', align: 'right', sortValue: row => row.totalTokens, cell: row => countCell(row.totalTokens) },
        { id: 'estimatedCost', label: 'Cost', align: 'right', sortValue: row => row.estimatedCost, cell: costCell },
        { id: 'editor', label: 'Editor', align: 'left', sortValue: row => row.editor || '', cell: row => ({ text: row.editor || 'unknown' }) },
        {
            id: 'workspace', label: 'Workspace', align: 'left', cellClass: 'session-col-workspace',
            sortValue: row => row.workspace || '',
            cell: row => ({ text: row.workspace || '—', title: row.workspace || '—' }),
        },
        { id: 'models', label: 'Models', align: 'left', cellClass: 'session-col-models', cell: modelsCell },
        { id: 'durationMs', label: 'Duration', align: 'right', cellClass: 'session-col-nowrap', sortValue: effectiveDurationMs, cell: durationCell },
        { id: 'contextFill', label: 'Context', align: 'right', cellClass: 'session-col-nowrap', sortValue: contextFillPercent, cell: contextCell },
        {
            id: 'lastActivity', label: 'Last Active', align: 'right', cellClass: 'session-col-nowrap',
            sortValue: row => timestampValue(row.lastActivity),
            cell: row => ({ text: formatLastActive(row.lastActivity) }),
        },
    ];
    const titleColumn: ColumnDef = {
        id: 'title', label: 'Title', align: 'left', cellClass: 'session-col-title',
        sortValue: row => row.title || '',
    };
    const columnDefs: ColumnDef[] = [titleColumn, ...optionalColumns];
    const sortableIds = columnDefs.filter(def => def.sortValue).map(def => def.id);

    function readSort(): { column: string; direction: RecentSessionSortDirection } {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(storageKeys.sort) || 'null');
            if (parsed && sortableIds.indexOf(parsed.column) !== -1 && (parsed.direction === 'asc' || parsed.direction === 'desc')) {
                return { column: parsed.column, direction: parsed.direction };
            }
        } catch (error) {
            // Unreadable or blocked storage: fall through to the default.
        }
        return { column: 'lastActivity', direction: 'desc' };
    }

    function readPeriod(): RecentSessionPeriod {
        try {
            const stored = window.localStorage.getItem(storageKeys.period);
            if (stored !== null && isPeriod(stored)) { return stored; }
        } catch (error) {
            // Unreadable or blocked storage: fall through to the default.
        }
        return 'today';
    }

    function readColumns(): Set<string> {
        const allIds = optionalColumns.map(def => def.id);
        try {
            const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKeys.columns) || 'null');
            if (Array.isArray(parsed)) {
                const validIds = parsed.filter((id): id is string => typeof id === 'string' && allIds.indexOf(id) !== -1);
                if (validIds.length > 0) { return new Set(validIds); }
            }
        } catch (error) {
            // Unreadable or blocked storage: fall through to all columns.
        }
        return new Set(allIds);
    }

    function writeSort(): void {
        try {
            window.localStorage.setItem(storageKeys.sort, JSON.stringify({ column: state.sortColumn, direction: state.sortDirection }));
        } catch (error) {
            // Blocked storage: state stays in memory for this page.
        }
    }

    function writePeriod(): void {
        try {
            window.localStorage.setItem(storageKeys.period, state.period);
        } catch (error) {
            // Blocked storage: state stays in memory for this page.
        }
    }

    function writeColumns(): void {
        try {
            window.localStorage.setItem(storageKeys.columns, JSON.stringify(Array.from(state.visibleColumns)));
        } catch (error) {
            // Blocked storage: state stays in memory for this page.
        }
    }

    const savedSort = readSort();
    const state: RecentSessionsState = {
        period: readPeriod(),
        sortColumn: savedSort.column,
        sortDirection: savedSort.direction,
        visibleColumns: readColumns(),
        search: '',
        editorFilters: new Set(),
        vendorFilters: new Set(),
        modelFilters: new Set(),
        hydraFusionOnly: false,
        nearLimitOnly: false,
    };

    function keepUsableRows(raw: unknown): SessionRow[] {
        if (!Array.isArray(raw)) { return []; }
        const usable: SessionRow[] = [];
        for (const item of raw) {
            if (item && typeof item === 'object' && typeof item.filePath === 'string') {
                const row = item as SessionRow;
                const models = Array.isArray(row.models) ? row.models.filter(model => typeof model === 'string') : [];
                usable.push({ ...row, models });
            }
        }
        return usable;
    }

    /** Swaps in the rows present in the payload. Periods missing from it keep their current rows. */
    function applyUsageData(payload: unknown): void {
        if (!payload || typeof payload !== 'object') { return; }
        const usage = payload as UsagePayload;
        if ('todaySessions' in usage) { rowsByPeriod.today = keepUsableRows(usage.todaySessions); }
        const recent: Record<string, unknown> = usage.recentSessions && typeof usage.recentSessions === 'object'
            ? usage.recentSessions
            : {};
        for (const period of ['last7', 'last30', 'currentMonth'] as const) {
            if (period in recent) { rowsByPeriod[period] = keepUsableRows(recent[period]); }
        }
        if (typeof usage.use24HourTime === 'boolean') { use24HourTime = usage.use24HourTime; }
    }

    function matchesFilters(row: SessionRow): boolean {
        if (state.nearLimitOnly && !isNearContextLimit(row)) { return false; }
        if (state.hydraFusionOnly && !row.models.some(isHydraFusionModel)) { return false; }
        if (state.editorFilters.size > 0 && !state.editorFilters.has(row.editor || 'unknown')) { return false; }
        if (state.modelFilters.size > 0 && !row.models.some(model => state.modelFilters.has(model))) { return false; }
        if (state.vendorFilters.size > 0 && !row.models.some(model => state.vendorFilters.has(billingProviderOf(model)))) { return false; }
        return true;
    }

    function matchesSearch(row: SessionRow, query: string): boolean {
        if (!query) { return true; }
        return [row.title, row.workspace, row.workspacePath]
            .some(value => typeof value === 'string' && value.toLowerCase().includes(query));
    }

    function hasActiveFilters(): boolean {
        return state.hydraFusionOnly || state.nearLimitOnly
            || state.editorFilters.size > 0 || state.vendorFilters.size > 0 || state.modelFilters.size > 0
            || state.search.trim() !== '';
    }

    function computeFilterOptions(rows: SessionRow[]): {
        editors: FilterOption[];
        vendors: FilterOption[];
        models: FilterOption[];
        hydraFusionCount: number;
        nearLimitCount: number;
    } {
        const editorCounts = new Map<string, number>();
        const vendorCounts = new Map<string, number>();
        const modelCounts = new Map<string, number>();
        let hydraFusionCount = 0;
        let nearLimitCount = 0;
        for (const row of rows) {
            if (isNearContextLimit(row)) { nearLimitCount += 1; }
            const editor = row.editor || 'unknown';
            editorCounts.set(editor, (editorCounts.get(editor) || 0) + 1);
            const vendorsInSession = new Set<string>();
            let hasHydraFusion = false;
            for (const model of row.models) {
                modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
                vendorsInSession.add(billingProviderOf(model));
                if (isHydraFusionModel(model)) { hasHydraFusion = true; }
            }
            for (const vendor of vendorsInSession) { vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1); }
            if (hasHydraFusion) { hydraFusionCount += 1; }
        }
        const toOptions = (counts: Map<string, number>, labelOf: (value: string) => string): FilterOption[] =>
            Array.from(counts.entries())
                .map(([value, count]) => ({ value, label: labelOf(value), count }))
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
        return {
            editors: toOptions(editorCounts, value => value),
            vendors: toOptions(vendorCounts, value => value),
            models: toOptions(modelCounts, modelDisplayName),
            hydraFusionCount,
            nearLimitCount,
        };
    }

    function createPill(
        filterType: string,
        value: string,
        text: string,
        count: number,
        active: boolean,
        title: string,
        extraClass?: string,
    ): HTMLButtonElement {
        const pill = createElement('button', {
            className: classNames('session-filter-pill', extraClass, active ? 'active' : undefined),
            attributes: {
                type: 'button',
                'data-web-filter': filterType,
                'data-web-value': value,
                'aria-pressed': String(active),
                title,
            },
        });
        pill.append(text, ' ', createElement('span', { className: 'session-filter-pill-count', text: String(count) }));
        return pill;
    }

    function createPillGroup(groupLabel: string, filterType: string, options: FilterOption[], activeValues: Set<string>): HTMLElement | undefined {
        if (options.length === 0) { return undefined; }
        const group = createElement('div', { className: 'session-filter-group' });
        group.append(createElement('span', { className: 'session-filter-group-label', text: groupLabel }));
        const pills = createElement('div', { className: 'session-filter-pills' });
        for (const option of options) {
            const isActive = activeValues.has(option.value);
            const plural = option.count === 1 ? '' : 's';
            pills.append(createPill(
                filterType,
                option.value,
                option.label,
                option.count,
                isActive,
                `${option.label}: ${option.count} session${plural}`,
            ));
        }
        group.append(pills);
        return group;
    }

    function buildPillBar(rows: SessionRow[]): HTMLElement | undefined {
        if (rows.length === 0) { return undefined; }
        const options = computeFilterOptions(rows);
        if (options.editors.length === 0 && options.vendors.length === 0 && options.models.length === 0) { return undefined; }
        const bar = createElement('div', { className: 'session-filter-bar' });
        // Shown while any session nearly filled its window, or while the filter is on.
        if (options.nearLimitCount > 0 || state.nearLimitOnly) {
            const group = createElement('div', { className: 'session-filter-group' });
            group.append(createPill(
                'nearcontextlimit',
                'true',
                '🧠 Near context limit',
                options.nearLimitCount,
                state.nearLimitOnly,
                `Show only sessions that reached at least ${NEAR_LIMIT_PERCENT}% of their context window without compacting`,
            ));
            bar.append(group);
        }
        if (options.hydraFusionCount > 0) {
            const group = createElement('div', { className: 'session-filter-group' });
            group.append(createPill(
                'hydrafusion',
                'true',
                '⚡ HydraFusion',
                options.hydraFusionCount,
                state.hydraFusionOnly,
                'Show only sessions that used HydraFusion',
                'session-filter-pill-hydrafusion',
            ));
            bar.append(group);
        }
        for (const group of [
            createPillGroup('Editor', 'editor', options.editors, state.editorFilters),
            createPillGroup('Vendor', 'vendor', options.vendors, state.vendorFilters),
            createPillGroup('Model', 'model', options.models, state.modelFilters),
        ]) {
            if (group) { bar.append(group); }
        }
        if (hasActiveFilters()) {
            bar.append(createElement('button', {
                className: 'session-filter-pill session-filter-pill-clear',
                text: '✕ Clear filters',
                attributes: { type: 'button', 'data-web-action': 'clear' },
            }));
        }
        return bar;
    }

    /** Toggles the pill under `target`. Returns false when `target` is not a filter pill. */
    function togglePillFilter(target: Element): boolean {
        const pill = target.closest('button[data-web-filter]');
        if (!pill) { return false; }
        const filterType = pill.getAttribute('data-web-filter');
        const value = pill.getAttribute('data-web-value') || '';
        if (filterType === 'hydrafusion') {
            state.hydraFusionOnly = !state.hydraFusionOnly;
            return true;
        }
        if (filterType === 'nearcontextlimit') {
            state.nearLimitOnly = !state.nearLimitOnly;
            return true;
        }
        const targetSet = filterType === 'editor' ? state.editorFilters
            : filterType === 'vendor' ? state.vendorFilters
            : filterType === 'model' ? state.modelFilters
            : undefined;
        if (!targetSet) { return false; }
        if (targetSet.has(value)) { targetSet.delete(value); } else { targetSet.add(value); }
        return true;
    }

    function clearFilters(): void {
        state.editorFilters.clear();
        state.vendorFilters.clear();
        state.modelFilters.clear();
        state.hydraFusionOnly = false;
        state.nearLimitOnly = false;
        state.search = '';
        if (activeView) { activeView.searchInput.value = ''; }
        renderTable(true);
    }

    function sortRows(rows: SessionRow[], column: ColumnDef | undefined, direction: RecentSessionSortDirection): SessionRow[] {
        if (!column || !column.sortValue) { return rows.slice(); }
        const valueOf = column.sortValue;
        return rows
            .map((row, index) => ({ row, index, value: valueOf(row) }))
            .sort((a, b) => {
                const aMissing = a.value === null || a.value === undefined;
                const bMissing = b.value === null || b.value === undefined;
                // Missing values sort last in both directions.
                if (aMissing || bMissing) {
                    if (aMissing && bMissing) { return a.index - b.index; }
                    return aMissing ? 1 : -1;
                }
                const result = typeof a.value === 'number' && typeof b.value === 'number'
                    ? a.value - b.value
                    : String(a.value).localeCompare(String(b.value), undefined, { sensitivity: 'base', numeric: true });
                if (result === 0) { return a.index - b.index; }
                return direction === 'asc' ? result : -result;
            })
            .map(item => item.row);
    }

    function visibleColumnDefs(): ColumnDef[] {
        return columnDefs.filter(def => def.id === 'title' || state.visibleColumns.has(def.id));
    }

    function alignClassOf(def: ColumnDef): string | undefined {
        return def.align === 'right' ? 'data-table-align-right' : undefined;
    }

    function buildHeaderRow(defs: ColumnDef[]): HTMLTableRowElement {
        const row = createElement('tr');
        row.append(createElement('th', { className: 'session-col-rank', text: '#', attributes: { scope: 'col' } }));
        for (const def of defs) {
            const isSortKey = state.sortColumn === def.id;
            const sortable = Boolean(def.sortValue);
            const header = createElement('th', {
                className: classNames(alignClassOf(def), def.cellClass, sortable ? 'data-table-sortable' : undefined, isSortKey ? 'data-table-sorted' : undefined),
                attributes: { scope: 'col' },
            });
            if (sortable) {
                const direction = state.sortDirection === 'asc' ? 'ascending' : 'descending';
                header.setAttribute('aria-sort', isSortKey ? direction : 'none');
                const sortButton = createElement('button', {
                    className: 'data-table-sort',
                    attributes: { type: 'button', 'data-web-sort': def.id, title: `Sort by ${def.label}` },
                });
                const indicator = isSortKey ? (state.sortDirection === 'asc' ? '↑' : '↓') : '';
                sortButton.append(
                    createElement('span', { className: 'data-table-sort-label', text: def.label }),
                    createElement('span', { className: 'data-table-sort-indicator', text: indicator, attributes: { 'aria-hidden': 'true' } }),
                );
                header.append(sortButton);
            } else {
                header.textContent = def.label;
            }
            row.append(header);
        }
        return row;
    }

    function buildTitleCell(row: SessionRow): HTMLTableCellElement {
        const cell = createElement('td', { className: 'session-col-title' });
        const titleText = row.title || 'Untitled session';
        const link = createElement('a', {
            className: 'session-title-link',
            attributes: {
                href: '#',
                'data-file': row.filePath,
                title: `Open viewer for session "${titleText}"`,
            },
        });
        if (row.models.some(isHydraFusionModel)) {
            link.append(createElement('span', {
                className: 'hydrafusion-session-badge',
                text: 'HydraFusion',
                attributes: { title: 'This session used HydraFusion' },
            }));
        }
        link.append(titleText);
        cell.append(link);
        const pathText = row.workspacePath || row.workspace;
        if (pathText) {
            cell.append(createElement('div', { className: 'session-subtitle', text: pathText, attributes: { title: pathText } }));
        }
        return cell;
    }

    function buildBodyCell(def: ColumnDef, row: SessionRow): HTMLTableCellElement {
        if (def.id === 'title') { return buildTitleCell(row); }
        const content: CellContent = def.cell ? def.cell(row) : { text: '' };
        const cell = createElement('td', { className: classNames(alignClassOf(def), def.cellClass) });
        if (content.title !== undefined || content.className) {
            cell.append(createElement('span', {
                className: content.className,
                text: content.text,
                attributes: content.title !== undefined ? { title: content.title } : undefined,
            }));
        } else {
            cell.textContent = content.text;
        }
        return cell;
    }

    function buildBodyRow(row: SessionRow, rank: number, defs: ColumnDef[]): HTMLTableRowElement {
        const tableRow = createElement('tr');
        tableRow.append(createElement('td', { className: 'session-col-rank', text: String(rank) }));
        for (const def of defs) { tableRow.append(buildBodyCell(def, row)); }
        return tableRow;
    }

    function appendRows(view: MountedView, from: number, to: number): void {
        const defs = visibleColumnDefs();
        const fragment = document.createDocumentFragment();
        for (let index = from; index < to; index += 1) {
            fragment.append(buildBodyRow(view.rows[index], index + 1, defs));
        }
        view.tableBody.append(fragment);
        view.renderedCount = to;
    }

    function updateLoadMore(view: MountedView): void {
        const remaining = view.rows.length - view.renderedCount;
        view.countLine.textContent = `Showing ${view.renderedCount} of ${view.rows.length}`;
        view.loadMoreButton.textContent = `Load more (${remaining} remaining)`;
        view.loadMoreButton.hidden = remaining <= 0;
        // Re-observing a button that is still on screen fires again, so auto-load continues.
        view.loadObserver.disconnect();
        if (!view.loadMoreButton.hidden) { view.loadObserver.observe(view.loadMoreButton); }
    }

    function showMoreRows(): void {
        const view = activeView;
        if (!view) { return; }
        const target = Math.min(view.rows.length, view.renderedCount + batchSize);
        if (target > view.renderedCount) { appendRows(view, view.renderedCount, target); }
        updateLoadMore(view);
    }

    /** Rebuilds the pills, count, header and body. `resetLimit` drops back to the first batch. */
    function renderTable(resetLimit: boolean): void {
        const view = activeView;
        if (!view) { return; }
        const periodRows = rowsByPeriod[state.period];
        const query = state.search.trim().toLowerCase();
        const matching = periodRows.filter(row => matchesFilters(row) && matchesSearch(row, query));
        view.rows = sortRows(matching, columnDefs.find(def => def.id === state.sortColumn), state.sortDirection);

        const pillBar = buildPillBar(periodRows);
        view.pillHost.replaceChildren(...(pillBar ? [pillBar] : []));

        const hasRows = periodRows.length > 0;
        const hasMatches = view.rows.length > 0;
        view.emptyBlock.hidden = hasRows && hasMatches;
        view.emptyClear.hidden = !hasRows;
        view.emptyText.textContent = hasRows
            ? 'No sessions match the selected filters.'
            : state.period === 'today' ? 'No sessions recorded today yet.' : 'No sessions recorded in this period.';
        view.tableScroll.hidden = !hasMatches;
        view.countLine.hidden = !hasRows;

        const previousCount = view.renderedCount;
        const target = Math.min(view.rows.length, resetLimit ? batchSize : Math.max(previousCount, batchSize));
        view.tableHead.replaceChildren(buildHeaderRow(visibleColumnDefs()));
        view.tableBody.replaceChildren();
        view.renderedCount = 0;
        appendRows(view, 0, target);
        updateLoadMore(view);
    }

    function queueSearchRender(): void {
        if (searchFrameQueued) { return; }
        searchFrameQueued = true;
        requestAnimationFrame(() => {
            searchFrameQueued = false;
            renderTable(true);
        });
    }

    function sortBy(columnId: string): void {
        if (sortableIds.indexOf(columnId) === -1) { return; }
        if (state.sortColumn === columnId) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            const def = columnDefs.find(candidate => candidate.id === columnId);
            state.sortColumn = columnId;
            state.sortDirection = def && def.align === 'right' ? 'desc' : 'asc';
        }
        writeSort();
        renderTable(true);
    }

    function openSessionViewer(filePath: string): void {
        if (!vscodeApi) {
            try {
                vscodeApi = pageWindow.acquireVsCodeApi ? pageWindow.acquireVsCodeApi() : undefined;
            } catch (error) {
                vscodeApi = undefined;
            }
        }
        vscodeApi?.postMessage({ command: 'openSessionFile', file: filePath });
    }

    function buildView(): MountedView {
        const root = createElement('div', { className: 'web-recent-sessions', attributes: { id: 'web-recent-sessions' } });

        const toolbar = createElement('div', { className: 'web-recent-sessions-toolbar' });
        const periodSelect = createElement('select', { className: 'period-selector-select', attributes: { 'aria-label': 'Period' } });
        for (const option of PERIOD_OPTIONS) {
            periodSelect.append(createElement('option', { text: option.label, attributes: { value: option.value } }));
        }
        periodSelect.value = state.period;
        const searchInput = createElement('input', {
            className: 'web-recent-sessions-search',
            attributes: { type: 'search', placeholder: 'Search title or workspace', 'aria-label': 'Search sessions' },
        });
        searchInput.value = state.search;
        const columnsWrap = createElement('div', { className: 'web-recent-sessions-columns-wrap' });
        const columnsToggle = createElement('button', {
            className: 'web-recent-sessions-columns-toggle',
            text: '⚙ Columns',
            attributes: { type: 'button' },
        });
        const columnsMenu = createElement('div', { className: 'web-recent-sessions-columns-menu' });
        columnsMenu.hidden = true;
        for (const def of optionalColumns) {
            const option = createElement('label', { className: 'web-recent-sessions-column-option' });
            const checkbox = createElement('input', { attributes: { type: 'checkbox', 'data-web-column': def.id } });
            checkbox.checked = state.visibleColumns.has(def.id);
            option.append(checkbox, def.label);
            columnsMenu.append(option);
        }
        columnsWrap.append(columnsToggle, columnsMenu);
        toolbar.append(periodSelect, searchInput, columnsWrap);

        const pillHost = createElement('div', { className: 'web-recent-sessions-pills' });
        const countLine = createElement('div', { className: 'web-recent-sessions-count' });
        const emptyBlock = createElement('div', { className: 'web-recent-sessions-empty' });
        const emptyText = createElement('span');
        const emptyClear = createElement('button', { text: '✕ Clear filters', attributes: { type: 'button', 'data-web-action': 'clear' } });
        emptyBlock.append(emptyText, emptyClear);
        emptyBlock.hidden = true;

        const tableScroll = createElement('div', {
            className: 'data-table-scroll',
            attributes: { role: 'region', tabindex: '0', 'aria-label': 'Recent Sessions' },
        });
        const table = createElement('table', { className: 'data-table sessions-table', attributes: { 'aria-label': 'Recent Sessions' } });
        const tableHead = createElement('thead');
        const tableBody = createElement('tbody');
        table.append(tableHead, tableBody);
        tableScroll.append(table);

        const loadMoreButton = createElement('button', { className: 'web-recent-sessions-load-more', attributes: { type: 'button' } });
        loadMoreButton.hidden = true;
        root.append(toolbar, pillHost, countLine, emptyBlock, tableScroll, loadMoreButton);

        const view: MountedView = {
            root,
            searchInput,
            pillHost,
            countLine,
            emptyBlock,
            emptyText,
            emptyClear,
            tableScroll,
            tableHead,
            tableBody,
            loadMoreButton,
            loadObserver: new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) { showMoreRows(); }
            }, { rootMargin: '0px 0px 400px 0px' }),
            rows: [],
            renderedCount: 0,
        };

        root.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) { return; }
            // Clicks inside the menu must not reach the document listener that closes it.
            if (target.closest('.web-recent-sessions-columns-menu')) {
                event.stopPropagation();
                return;
            }
            if (target.closest('.web-recent-sessions-columns-toggle')) {
                event.stopPropagation();
                columnsMenu.hidden = !columnsMenu.hidden;
                return;
            }
            const sortButton = target.closest('button[data-web-sort]');
            if (sortButton) {
                sortBy(sortButton.getAttribute('data-web-sort') || '');
                return;
            }
            const titleLink = target.closest('a.session-title-link');
            if (titleLink) {
                event.preventDefault();
                openSessionViewer(titleLink.getAttribute('data-file') || '');
                return;
            }
            if (target.closest('[data-web-action="clear"]')) {
                clearFilters();
                return;
            }
            if (togglePillFilter(target)) {
                renderTable(true);
                return;
            }
            if (target.closest('.web-recent-sessions-load-more')) {
                showMoreRows();
            }
        });

        root.addEventListener('change', event => {
            const target = event.target;
            if (target === periodSelect) {
                const selected = periodSelect.value;
                if (isPeriod(selected)) { state.period = selected; }
                writePeriod();
                renderTable(true);
                return;
            }
            if (target instanceof HTMLInputElement && target.hasAttribute('data-web-column')) {
                const columnId = target.getAttribute('data-web-column') || '';
                if (target.checked) { state.visibleColumns.add(columnId); } else { state.visibleColumns.delete(columnId); }
                writeColumns();
                renderTable(false);
            }
        });

        root.addEventListener('input', event => {
            if (event.target !== searchInput) { return; }
            state.search = searchInput.value;
            queueSearchRender();
        });

        return view;
    }

    function mountView(): void {
        const panelBody = document.getElementById('sessions-panel-body');
        const section = document.querySelector('#tab-panel-sessions .section');
        if (!panelBody || !section || !section.contains(panelBody)) { return; }
        if (document.getElementById('web-recent-sessions')) { return; }
        if (activeView) { activeView.loadObserver.disconnect(); }
        const view = buildView();
        activeView = view;
        // Render before inserting and hiding the shared table, so a throw leaves the shared table visible.
        renderTable(true);
        panelBody.insertAdjacentElement('afterend', view.root);
        document.body.classList.add('web-recent-sessions-active');
    }

    function queueMount(): void {
        if (mountQueued) { return; }
        mountQueued = true;
        requestAnimationFrame(() => {
            mountQueued = false;
            if (!document.getElementById('web-recent-sessions')) { mountView(); }
        });
    }

    applyUsageData(pageWindow.__INITIAL_USAGE__);

    window.addEventListener('message', event => {
        const message = event.data as { command?: unknown; data?: unknown } | null;
        if (!message || message.command !== 'updateStats') { return; }
        const data = message.data;
        if (!data || typeof data !== 'object') { return; }
        if (!('todaySessions' in data) && !('recentSessions' in data)) { return; }
        applyUsageData(data);
        renderTable(true);
    });

    // Closes the Columns menu on any click that is not inside the menu or on its toggle. Installed once per page.
    document.addEventListener('click', () => {
        for (const menu of Array.from(document.querySelectorAll<HTMLElement>('.web-recent-sessions-columns-menu'))) {
            menu.hidden = true;
        }
    });

    // Re-mounts after the bundle re-renders #root. Observes direct children only, so mount writes
    // inside `.section` cannot retrigger it.
    const rootElement = document.getElementById('root');
    if (rootElement) {
        new MutationObserver(() => queueMount()).observe(rootElement, { childList: true });
    }
    mountView();
}

export const RECENT_SESSIONS_SCRIPT = `(${installRecentSessionsTable.toString()})(${JSON.stringify(RECENT_SESSIONS_CONFIG)});`;
