import { createEmptyContextRefs, estimateTokensFromText } from '../../src/tokenEstimation';
import { readClaudeCodeEventsForAnalysis } from '../../src/usageAnalysis';
import { normalizeClaudeModelId } from '../../src/claudecode';
import { isMcpTool, extractMcpServerName } from '../../src/workspaceHelpers';
import { tokenEstimators } from '../../cli/src/sessionProcessing';
import type { ChatTurn, ActualUsage } from '../../src/types';

/**
 * Claude turn grouping owned by the web dashboard.
 * Same shape as the shared adapter output, with four deliberate differences:
 * caveat events do not start a turn, compaction summaries start an AI-only turn,
 * the displayed prompt is wrapper-stripped, and empty turns are dropped.
 */

const FALLBACK_MODEL = 'claude-sonnet-4-6';

// Harness-injected wrappers that carry no human-authored text.
const SYNTHETIC_USER_WRAPPER = /<(system-reminder|task-notification|local-command-caveat|local-command-stdout|local-command-stderr|command-message|command-name|command-args|command-contents)>[\s\S]*?<\/\1>/g;

interface AssistantTurnData {
    assistantText: string;
    model: string | null;
    actualInputTokens: number;
    actualOutputTokens: number;
    toolCalls: { toolName: string; arguments?: string }[];
    mcpTools: { server: string; tool: string }[];
}

type TokenEstimator = (text: string, model?: string) => number;

function stripSyntheticWrappers(text: string): string {
    return text ? text.replace(SYNTHETIC_USER_WRAPPER, '').trim() : '';
}

/** Human-authored text of a user event, or null for tool results and wrapper-only events. */
function extractHumanText(event: any): string | null {
    const content = event?.message?.content;
    if (typeof content === 'string') {
        return stripSyntheticWrappers(content) || null;
    }
    if (!Array.isArray(content)) { return null; }
    if (content.some((block: any) => block?.type === 'tool_result')) { return null; }
    const text = stripSyntheticWrappers(
        content.filter((block: any) => block?.type === 'text').map((block: any) => block?.text || '').join('\n')
    );
    return text || null;
}

function isTurnBoundary(event: any): boolean {
    return event.isCompactSummary === true || extractHumanText(event) !== null;
}

function sumInputTokens(usage: any): number {
    return (usage.input_tokens || 0)
        + (usage.cache_creation_input_tokens || 0)
        + (usage.cache_read_input_tokens || 0);
}

function readContentBlock(
    block: any,
    toolCalls: AssistantTurnData['toolCalls'],
    mcpTools: AssistantTurnData['mcpTools']
): string {
    if (block.type === 'text') { return block.text || ''; }
    if (block.type === 'tool_use') {
        const toolName: string = block.name || 'unknown';
        if (isMcpTool(toolName)) {
            mcpTools.push({ server: extractMcpServerName(toolName), tool: toolName });
        } else {
            toolCalls.push({ toolName, arguments: block.input ? JSON.stringify(block.input) : undefined });
        }
    }
    return '';
}

function readAssistantEvents(pendingAssistantEvents: any[]): AssistantTurnData {
    let assistantText = '';
    let actualInputTokens = 0;
    let actualOutputTokens = 0;
    let model: string | null = null;
    const toolCalls: AssistantTurnData['toolCalls'] = [];
    const mcpTools: AssistantTurnData['mcpTools'] = [];
    // Claude Code writes several entries per API request; usage counts once per message.id.
    const seenMessageIds = new Set<string>();
    for (const assistantEvent of pendingAssistantEvents) {
        const message = assistantEvent.message;
        if (!model && message?.model) { model = normalizeClaudeModelId(message.model); }
        const messageId = message?.id as string | undefined;
        const isFirstOccurrence = !messageId || !seenMessageIds.has(messageId);
        if (messageId) { seenMessageIds.add(messageId); }
        if (message?.usage && isFirstOccurrence) {
            actualInputTokens += sumInputTokens(message.usage);
            actualOutputTokens += message.usage.output_tokens || 0;
        }
        for (const block of (Array.isArray(message?.content) ? message.content : [])) {
            assistantText += readContentBlock(block, toolCalls, mcpTools);
        }
    }
    return { assistantText, model, actualInputTokens, actualOutputTokens, toolCalls, mcpTools };
}

function buildTurn(
    userEvent: any,
    pendingAssistantEvents: any[],
    turnNumber: number,
    estimateTokens: TokenEstimator
): ChatTurn | null {
    if (!userEvent) { return null; }
    const userMessage = userEvent.isCompactSummary === true ? '' : (extractHumanText(userEvent) ?? '');
    if (!userMessage && pendingAssistantEvents.length === 0) { return null; }
    const { assistantText, model, actualInputTokens, actualOutputTokens, toolCalls, mcpTools } =
        readAssistantEvents(pendingAssistantEvents);
    const usedModel = model || FALLBACK_MODEL;
    const actualUsage: ActualUsage | undefined = (actualInputTokens > 0 || actualOutputTokens > 0)
        ? { promptTokens: actualInputTokens, completionTokens: actualOutputTokens }
        : undefined;
    return {
        turnNumber,
        timestamp: userEvent.timestamp ? new Date(userEvent.timestamp).toISOString() : null,
        mode: 'agent',
        userMessage,
        assistantResponse: assistantText,
        model: usedModel,
        toolCalls,
        contextReferences: createEmptyContextRefs(),
        mcpTools,
        inputTokensEstimate: actualInputTokens || estimateTokens(userMessage, usedModel),
        outputTokensEstimate: actualOutputTokens || estimateTokens(assistantText, usedModel),
        thinkingTokensEstimate: 0,
        actualUsage,
    };
}

/** Group Claude JSONL events into chat turns. Pure, so it can be reused and tested. */
export function groupClaudeEventsIntoTurns(events: any[], estimateTokens: TokenEstimator): ChatTurn[] {
    const turns: ChatTurn[] = [];
    let currentUserEvent: any = null;
    const pendingAssistantEvents: any[] = [];

    const closeCurrentTurn = (): void => {
        const turn = buildTurn(currentUserEvent, pendingAssistantEvents, turns.length + 1, estimateTokens);
        if (turn) { turns.push(turn); }
    };

    for (const event of events) {
        if (event.type === 'user' && !event.isSidechain && event.message?.role === 'user' && isTurnBoundary(event)) {
            closeCurrentTurn();
            currentUserEvent = event;
            pendingAssistantEvents.length = 0;
        } else if (event.type === 'assistant' && event.message?.stop_reason && event.message?.role === 'assistant') {
            pendingAssistantEvents.push(event);
        }
    }
    closeCurrentTurn();
    return turns;
}

export async function buildClaudeCodeTurnsForWeb(sessionFilePath: string): Promise<{ turns: ChatTurn[]; actualTokens?: number }> {
    const events = await readClaudeCodeEventsForAnalysis(sessionFilePath);
    const estimateTokens: TokenEstimator = (text, model) => estimateTokensFromText(text, model ?? 'gpt-4', tokenEstimators);
    return { turns: groupClaudeEventsIntoTurns(events, estimateTokens) };
}
