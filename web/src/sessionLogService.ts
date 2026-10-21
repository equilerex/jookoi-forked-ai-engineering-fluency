import * as fs from 'fs';
import * as path from 'path';
import {
    reconstructJsonlStateAsync,
    buildReasoningEffortTimeline,
    extractResponseItemText,
    extractSubAgentData,
    getModelFromRequest,
    estimateTokensFromText,
    createEmptyContextRefs,
    attachEstimatedTurnCosts,
    isCopilotAutoRequest,
} from '../../src/tokenEstimation';
import { isMcpTool, extractMcpServerName } from '../../src/workspaceHelpers';
import { analyzeContextReferences } from '../../src/usageAnalysis';
import { getEcosystems, modelPricing, getSessionBackingPath } from '../../cli/src/sessionProcessing';
import { getPricingSourceForEditor } from '../../src/chartDataBuilder';
import { analyzeHydraFusionSession } from '../../src/hydrafusion';
import type { SessionLogData, ChatTurn, ContextReferenceUsage, ActualUsage } from '../../src/types';
import type { IEcosystemAdapter } from '../../src/ecosystemAdapter';
import { sessionEditorName, getSessionFiles, extractSessionTitleAndWorkspace } from './statsService';
import { getSessionMeta } from '../../cli/src/helpers';
import { buildClaudeCodeTurnsForWeb } from './claudeTurnsWeb';

function detectIsDeltaBased(lines: string[]): boolean {
    if (lines.length === 0) { return false; }
    try {
        const firstLine = JSON.parse(lines[0]);
        return firstLine && typeof firstLine.kind === 'number';
    } catch { return false; }
}

function resolveToolInvocationName(item: any): string {
    return item.toolId || item.toolName || item.invocationMessage?.toolName || item.toolSpecificData?.kind || 'unknown';
}

function formatToolResult(result: any): string | undefined {
    if (!result) { return undefined; }
    return typeof result === 'string' ? result : JSON.stringify(result);
}

function extractResponseData(response: any[]): {
    responseText: string;
    thinkingText: string;
    toolCalls: { toolName: string; arguments?: string; result?: string; isSubAgent?: boolean; subAgentModel?: string }[];
    mcpTools: { server: string; tool: string }[];
} {
    const acc = { responseText: '', thinkingText: '', toolCalls: [] as any[], mcpTools: [] as any[] };
    for (const item of response) {
        if (!item || typeof item !== 'object') { continue; }
        const { text, isThinking } = extractResponseItemText(item);
        if (text) {
            if (isThinking) { acc.thinkingText += text; } else { acc.responseText += text; }
        }
        if (item.kind === 'toolInvocationSerialized' || item.kind === 'prepareToolInvocation') {
            const subAgentData = extractSubAgentData(item);
            if (subAgentData) {
                acc.toolCalls.push({
                    toolName: (item.toolSpecificData?.agentName as string | undefined) || 'Sub-Agent',
                    arguments: subAgentData.prompt || undefined,
                    isSubAgent: true,
                    subAgentModel: subAgentData.modelName || undefined,
                });
            } else {
                const toolName = resolveToolInvocationName(item);
                if (isMcpTool(toolName)) {
                    acc.mcpTools.push({ server: extractMcpServerName(toolName), tool: toolName });
                } else {
                    acc.toolCalls.push({
                        toolName,
                        arguments: item.input ? JSON.stringify(item.input) : undefined,
                        result: formatToolResult(item.result),
                    });
                }
            }
        }
        if (item.kind === 'mcpServersStarting' && item.didStartServerIds) {
            for (const serverId of item.didStartServerIds) {
                acc.mcpTools.push({ server: serverId, tool: 'start' });
            }
        }
    }
    return acc;
}

function extractActualUsage(request: any): ActualUsage | undefined {
    const usage = request.result?.usage;
    if (usage && typeof usage.completionTokens === 'number' && typeof usage.promptTokens === 'number') {
        return {
            completionTokens: usage.completionTokens,
            promptTokens: usage.promptTokens,
            promptTokenDetails: Array.isArray(usage.promptTokenDetails) ? usage.promptTokenDetails : undefined,
            details: typeof request.result?.details === 'string' ? request.result.details : undefined,
        };
    }
    return undefined;
}

async function buildDeltaJsonlTurns(lines: string[]): Promise<ChatTurn[]> {
    const turns: ChatTurn[] = [];
    const { sessionState } = await reconstructJsonlStateAsync(lines);
    const { effortByRequestId } = buildReasoningEffortTimeline(lines);

    let sessionMode: 'ask' | 'edit' | 'agent' | 'plan' | 'customAgent' = 'ask';
    let currentModel: string | null = null;
    if (sessionState.inputState?.mode) {
        const rawMode = sessionState.inputState.mode;
        sessionMode = (rawMode === 'edit' || rawMode === 'agent' || rawMode === 'plan' || rawMode === 'customAgent') ? rawMode : 'ask';
        if (sessionState.inputState?.selectedModel?.metadata?.id) {
            currentModel = sessionState.inputState.selectedModel.metadata.id;
        }
    }

    const requests = sessionState.requests || [];
    for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        if (!request || !request.requestId) { continue; }
        const contextRefs = createEmptyContextRefs();
        const userMessage = request.message?.text || '';
        analyzeContextReferences(userMessage, contextRefs);

        const requestModel = getModelFromRequest(request, modelPricing, currentModel || 'gpt-4');
        const { responseText, thinkingText, toolCalls, mcpTools } = extractResponseData(request.response || []);
        const actualUsage = extractActualUsage(request);

        turns.push({
            turnNumber: i + 1,
            timestamp: request.timestamp ? new Date(request.timestamp).toISOString() : null,
            mode: sessionMode,
            userMessage,
            assistantResponse: responseText,
            model: requestModel,
            autoRouted: isCopilotAutoRequest(request),
            toolCalls,
            contextReferences: contextRefs,
            mcpTools,
            inputTokensEstimate: estimateTokensFromText(userMessage, requestModel),
            outputTokensEstimate: estimateTokensFromText(responseText, requestModel),
            thinkingTokensEstimate: estimateTokensFromText(thinkingText, requestModel),
            actualUsage,
            thinkingEffort: effortByRequestId.get(request.requestId),
        });
    }
    return turns;
}

function buildCliJsonlTurns(lines: string[]): { turns: ChatTurn[]; subAgentsStarted: number | undefined } {
    const turns: ChatTurn[] = [];
    let subAgentsStarted: number | undefined;
    let cliSessionModel = 'unknown';

    for (const line of lines) {
        try {
            const ev = JSON.parse(line);
            if (ev.type === 'session.start' && ev.data) {
                cliSessionModel = ev.data.selectedModel || ev.data.model || cliSessionModel;
            } else if (ev.type === 'session.model_change' && ev.data?.newModel) {
                cliSessionModel = ev.data.newModel;
            } else if (ev.type === 'subagent.started') {
                subAgentsStarted = (subAgentsStarted ?? 0) + 1;
            } else if (ev.type === 'user.message' && ev.data?.content) {
                const contextRefs = createEmptyContextRefs();
                analyzeContextReferences(ev.data.content, contextRefs);
                turns.push({
                    turnNumber: turns.length + 1,
                    timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : null,
                    mode: 'ask',
                    userMessage: ev.data.content,
                    assistantResponse: '',
                    model: ev.model || ev.data?.model || cliSessionModel,
                    toolCalls: [],
                    contextReferences: contextRefs,
                    mcpTools: [],
                    inputTokensEstimate: estimateTokensFromText(ev.data.content, cliSessionModel),
                    outputTokensEstimate: 0,
                    thinkingTokensEstimate: 0,
                });
            } else if (ev.type === 'assistant.message' && ev.data?.content && turns.length > 0) {
                const last = turns[turns.length - 1];
                last.assistantResponse += ev.data.content;
                last.outputTokensEstimate = estimateTokensFromText(last.assistantResponse, last.model || cliSessionModel);
            } else if ((ev.type === 'tool.call' || ev.type === 'tool.result') && turns.length > 0) {
                const toolName = ev.data?.toolName || ev.toolName || 'tool';
                if (isMcpTool(toolName)) {
                    turns[turns.length - 1].mcpTools.push({ server: extractMcpServerName(toolName), tool: toolName });
                } else {
                    turns[turns.length - 1].toolCalls.push({
                        toolName,
                        arguments: ev.data?.arguments ? JSON.stringify(ev.data.arguments) : undefined,
                        result: ev.data?.output ? String(ev.data.output) : undefined,
                    });
                }
            }
        } catch { /* skip line */ }
    }
    return { turns, subAgentsStarted };
}

function buildJsonSessionTurns(data: any): ChatTurn[] {
    const turns: ChatTurn[] = [];
    const requests = Array.isArray(data.requests) ? data.requests : [];
    for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const userMessage = req.message?.text || req.prompt || '';
        const assistantResponse = req.response?.text || req.response || '';
        const model = req.model || req.selectedModel || 'gpt-4';
        turns.push({
            turnNumber: i + 1,
            timestamp: req.timestamp ? new Date(req.timestamp).toISOString() : null,
            mode: 'ask',
            userMessage,
            assistantResponse,
            model,
            toolCalls: [],
            contextReferences: createEmptyContextRefs(),
            mcpTools: [],
            inputTokensEstimate: estimateTokensFromText(userMessage, model),
            outputTokensEstimate: estimateTokensFromText(assistantResponse, model),
            thinkingTokensEstimate: 0,
        });
    }
    return turns;
}

export async function getSessionLogData(sessionFilePath: string): Promise<SessionLogData & { workspace?: string | null; workspacePath?: string | null }> {
    const backingPath = getSessionBackingPath(sessionFilePath);
    let stat = { size: 0, mtime: new Date() };
    try {
        const s = await fs.promises.stat(backingPath);
        stat = { size: s.size, mtime: s.mtime };
    } catch { /* ignore */ }

    const meta = await getSessionMeta(sessionFilePath).catch(() => null);
    const editorName = sessionEditorName(sessionFilePath);

    let turns: ChatTurn[] = [];
    let subAgentsStarted: number | undefined;
    let hydraFusion: any;
    let actualTokens = 0;

    const eco = getEcosystems().find(e => e.handles(sessionFilePath));
    if (eco?.buildTurns) {
        try {
            const res = eco.id === 'claudecode'
                ? await buildClaudeCodeTurnsForWeb(sessionFilePath)
                : await eco.buildTurns(sessionFilePath);
            turns = res.turns;
            actualTokens = res.actualTokens ?? 0;
        } catch (err) {
            console.error('Ecosystem buildTurns error:', err);
        }
    } else {
        try {
            const content = await fs.promises.readFile(backingPath, 'utf8');
            const lines = content.trim().split('\n').filter(l => l.trim());
            if (sessionFilePath.endsWith('.jsonl') || detectIsDeltaBased(lines) || content.startsWith('{')) {
                if (detectIsDeltaBased(lines)) {
                    turns = await buildDeltaJsonlTurns(lines);
                } else if (sessionFilePath.endsWith('.jsonl')) {
                    const cliResult = buildCliJsonlTurns(lines);
                    turns = cliResult.turns;
                    subAgentsStarted = cliResult.subAgentsStarted;
                    hydraFusion = analyzeHydraFusionSession(content);
                } else {
                    const json = JSON.parse(content);
                    turns = buildJsonSessionTurns(json);
                }
            }
        } catch (err) {
            console.error('Session file parse error:', err);
        }
    }

    attachEstimatedTurnCosts(turns, modelPricing, getPricingSourceForEditor(editorName));

    const resolved = extractSessionTitleAndWorkspace(sessionFilePath);
    const resolvedTitle = meta?.title || resolved.title;

    return {
        file: sessionFilePath,
        title: resolvedTitle,
        workspace: resolved.workspace,
        // Project folder the session ran in. Relative paths in its text resolve against it.
        workspacePath: resolved.workspacePath ?? null,
        editorSource: editorName,
        editorName,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        interactions: (meta as any)?.interactions ?? turns.length,
        contextReferences: createEmptyContextRefs(),
        firstInteraction: meta?.firstInteraction ?? (turns[0]?.timestamp ?? null),
        lastInteraction: meta?.lastInteraction ?? (turns[turns.length - 1]?.timestamp ?? null),
        turns,
        actualTokens,
        subAgentsStarted,
        hydraFusion,
    };
}

export async function getToolCallPrettyPayload(sessionFilePath: string, turnNumber: number, toolCallIdx: number) {
    const logData = await getSessionLogData(sessionFilePath);
    const turn = logData.turns.find(t => t.turnNumber === turnNumber);
    const turnIndex = logData.turns.findIndex(t => t.turnNumber === turnNumber);
    const toolCall = turn?.toolCalls?.[toolCallIdx];
    if (!toolCall) { return null; }

    const safeParse = (s?: string) => {
        if (!s) { return null; }
        try { return JSON.parse(s); } catch { return s; }
    };

    return {
        turnBefore: turnIndex > 0 ? logData.turns[turnIndex - 1] : null,
        toolCall: {
            turn: turnNumber,
            toolCallIdx,
            toolName: toolCall.toolName,
            model: turn?.model,
            mode: turn?.mode,
            timestamp: turn?.timestamp,
            userMessage: turn?.userMessage,
            assistantResponse: turn?.assistantResponse,
            argumentsRaw: toolCall.arguments ?? null,
            argumentsParsed: safeParse(toolCall.arguments),
            resultRaw: toolCall.result ?? null,
            resultParsed: safeParse(toolCall.result),
        },
        turnAfter: (turnIndex >= 0 && turnIndex < logData.turns.length - 1) ? logData.turns[turnIndex + 1] : null,
    };
}
