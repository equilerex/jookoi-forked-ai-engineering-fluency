// ---------------------------------------------------------------------------
// Session Log Viewer Enhancer: Rich Markdown Rendering & Glanceable Tool Cards
// Inspired by jookoi-universal-mdx-render
// ---------------------------------------------------------------------------

export const LOGVIEWER_ENHANCER_STYLES = `
/* ==========================================================================
   Markdown & MDX Rendering Styles (Inspired by jookoi-universal-mdx-render)
   ========================================================================== */
.turn-content .message-text,
.turn-card .message-text,
.message.user-message .message-text,
.message.assistant-message .message-text {
    white-space: normal !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    max-height: none !important;
    overflow-y: visible !important;
}

.tools-toggle-fab {
    position: fixed;
    left: 0;
    bottom: 16px;
    z-index: 1000;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    box-shadow: 0 2px 8px var(--shadow-color);
    cursor: pointer;
}

.tools-toggle-fab:hover {
    background: var(--bg-tertiary);
}

.tools-toggle-fab[hidden] {
    display: none;
}

.pasted-content-banner {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    margin: 4px 0 8px;
    background: rgba(96, 165, 250, 0.15);
    border: 1px solid rgba(96, 165, 250, 0.35);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.pasted-content-banner.caveat-banner {
    background: rgba(234, 179, 8, 0.15);
    border-color: rgba(234, 179, 8, 0.35);
    color: #eab308;
}

/* Disable distracting hover bounce/lift on turn cards */
.turn-card:hover {
    transform: none !important;
    box-shadow: 0 4px 12px rgb(0, 0, 0, 0.3), 0 1px 3px rgb(0, 0, 0, 0.2) !important;
}

/* Telemetry Ribbon for Tool Calls */
.tool-vtelemetry-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.22);
    border-bottom: 1px solid rgba(128, 128, 128, 0.18);
    font-size: 11.5px;
    color: var(--vscode-descriptionForeground);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.tool-vtel-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.tool-vtel-item strong {
    color: var(--vscode-foreground);
    font-weight: 600;
}
.tool-vtel-tok {
    color: var(--vscode-descriptionForeground);
    font-size: 10.5px;
}
.tool-vtel-cost {
    color: #38bdf8;
    font-weight: 600;
}
.tool-vtel-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10.5px;
    font-weight: 600;
}
.tool-vtel-status-ok {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
}
.tool-vtel-status-err {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.jookoi-mdx-renderer tr:nth-child(even) {
    background: rgba(128, 128, 128, 0.04);
}

.jookoi-mdx-renderer {
    display: block;
    box-sizing: border-box;
    font-size: 13.5px;
    line-height: 1.65;
    color: var(--vscode-editor-foreground);
    word-break: break-word;
    white-space: normal !important;
}
.jookoi-mdx-renderer > :first-child { margin-top: 0 !important; }
.jookoi-mdx-renderer > :last-child { margin-bottom: 0 !important; }

.jookoi-mdx-renderer h1,
.jookoi-mdx-renderer h2,
.jookoi-mdx-renderer h3,
.jookoi-mdx-renderer h4,
.jookoi-mdx-renderer h5,
.jookoi-mdx-renderer h6 {
    margin: 1.4em 0 0.5em;
    font-weight: 600;
    line-height: 1.3;
    color: var(--vscode-foreground);
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
    padding-bottom: 4px;
}
.jookoi-mdx-renderer h1 { font-size: 1.5em; }
.jookoi-mdx-renderer h2 { font-size: 1.35em; }
.jookoi-mdx-renderer h3 { font-size: 1.2em; border-bottom: none; }
.jookoi-mdx-renderer h4 { font-size: 1.1em; border-bottom: none; }

.jookoi-mdx-renderer p {
    margin: 0 0 0.85em;
}

.jookoi-mdx-renderer a {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
}
.jookoi-mdx-renderer a:hover {
    text-decoration: underline;
}

.jookoi-mdx-renderer ul,
.jookoi-mdx-renderer ol {
    margin: 0 0 0.85em;
    padding-left: 1.6em;
}
.jookoi-mdx-renderer li {
    margin-bottom: 0.3em;
}

.jookoi-mdx-renderer blockquote {
    margin: 0.85em 0;
    padding: 6px 14px;
    color: var(--vscode-descriptionForeground);
    border-left: 4px solid var(--vscode-focusBorder);
    background: rgba(128, 128, 128, 0.08);
    border-radius: 0 6px 6px 0;
}
.jookoi-mdx-renderer blockquote p {
    margin: 0;
}

/* Inline code */
.jookoi-mdx-renderer :not(pre) > code {
    padding: 2px 6px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    color: var(--vscode-editor-foreground);
    background: rgba(128, 128, 128, 0.18);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 4px;
}

/* Code Blocks with Header & Copy Button */
.code-block-wrapper {
    margin: 0.85em 0;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--vscode-editor-background);
}
.code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 10px;
    background: rgba(128, 128, 128, 0.12);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    user-select: none;
}
.code-lang-tag {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.code-copy-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-foreground);
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
}
.code-copy-btn:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-panel-border);
}

.code-block-wrapper pre {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    white-space: pre;
}
.code-block-wrapper pre code {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: transparent;
    border: none;
    padding: 0;
}

/* Tables */
.table-scroll-wrapper {
    margin: 0.85em 0;
    overflow-x: auto;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
}
.jookoi-mdx-renderer table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.jookoi-mdx-renderer th,
.jookoi-mdx-renderer td {
    padding: 6px 12px;
    text-align: left;
    border: 1px solid var(--vscode-panel-border);
}
.jookoi-mdx-renderer th {
    background: rgba(128, 128, 128, 0.12);
    font-weight: 600;
}

/* Horizontal separator */
.jookoi-mdx-renderer hr {
    margin: 1.4em 0;
    border: 0;
    border-top: 1px solid var(--vscode-panel-border);
}

/* ==========================================================================
   Message Header & Rendered / Raw Controls
   ========================================================================== */
.message-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.message-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}
.msg-btn {
    background: rgba(128, 128, 128, 0.08);
    border: 1px solid var(--vscode-widget-border);
    color: var(--vscode-foreground);
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    opacity: 0.85;
    transition: all 0.15s ease;
    user-select: none;
}
.msg-btn:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
    border-color: var(--vscode-panel-border);
}
.msg-btn.active-mode {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-focusBorder);
    font-weight: 600;
}

.message-raw {
    display: none;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 12px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    margin: 0;
}

/* ==========================================================================
   Tool Call Visualization Cards (Vertical Property Blocks)
   ========================================================================== */
.tool-visual-card, .tool-glance-card {
    background: var(--vscode-editorWidget-background, rgba(30, 30, 30, 0.6));
    border: 1px solid var(--vscode-widget-border, #303031);
    border-left: 3px solid var(--vscode-button-background, #0e639c);
    border-radius: 6px;
    padding: 8px 10px;
    margin: 6px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
}
.tool-visual-card.tool-type-cmd, .tool-glance-card.tool-type-cmd {
    border-left-color: var(--vscode-terminal-ansiGreen, #23d18b);
}
.tool-visual-card.tool-type-edit, .tool-glance-card.tool-type-edit {
    border-left-color: #38bdf8;
}
.tool-visual-card.tool-type-read, .tool-glance-card.tool-type-read {
    border-left-color: #a855f7;
}
.tool-visual-card.tool-type-search, .tool-glance-card.tool-type-search {
    border-left-color: #f59e0b;
}
.tool-visual-card.tool-type-agent, .tool-glance-card.tool-type-agent {
    border-left-color: #ec4899;
}

.tool-vrow {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.tool-vlabel {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground, #858585);
    display: flex;
    align-items: center;
    gap: 4px;
}
.tool-vval {
    font-size: 12px;
    line-height: 1.4;
    color: var(--vscode-foreground);
}
.tool-vpath {
    font-family: Consolas, 'Courier New', monospace;
    color: var(--vscode-textLink-foreground, #3794ff);
    word-break: break-all;
}
.tool-vbadge-skill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(236, 72, 153, 0.15);
    color: #ec4899;
    border: 1px solid rgba(236, 72, 153, 0.4);
    font-weight: 600;
    font-family: Consolas, monospace;
    width: fit-content;
}
.tool-vcode-wrap {
    overflow-x: auto;
}
.tool-vcode {
    font-family: Consolas, 'Courier New', monospace;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border);
    padding: 4px 8px;
    border-radius: 4px;
    color: #ffffff;
    display: block;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 11px;
    line-height: 1.45;
}
/* Light themes: white command text is unreadable on a light editor background. */
:root[data-theme="light"] .tool-vcode,
body[data-theme="light"] .tool-vcode,
.vscode-light .tool-vcode {
    color: #000000;
}
@media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) .tool-vcode {
        color: #000000;
    }
}
.tool-vcode-pattern {
    color: var(--vscode-charts-orange, #d18616);
}
.tool-vpill {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.15);
    border: 1px solid var(--vscode-widget-border);
    color: var(--vscode-descriptionForeground);
    display: inline-block;
    width: fit-content;
}
.tool-vdiff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
}
.tool-vdiff-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
}
.tool-vdiff-tag-old {
    background: rgba(244, 63, 94, 0.2);
    color: #f43f5e;
    border: 1px solid rgba(244, 63, 94, 0.4);
}
.tool-vdiff-tag-new {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.4);
}
.tool-vdiff-lines {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
.tool-vdiff-pre {
    margin: 0;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.45;
    overflow-x: auto;
    max-height: 220px;
    white-space: pre-wrap;
    word-break: break-all;
}
.tool-vdiff-pre-old {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.25);
    color: #fda4af;
}
.tool-vdiff-pre-new {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.25);
    color: #86efac;
}
/* Light themes: the pastel diff text is unreadable on a light background. */
:root[data-theme="light"] .tool-vdiff-pre-old,
body[data-theme="light"] .tool-vdiff-pre-old,
.vscode-light .tool-vdiff-pre-old {
    color: #361b1e;
}
:root[data-theme="light"] .tool-vdiff-pre-new,
body[data-theme="light"] .tool-vdiff-pre-new,
.vscode-light .tool-vdiff-pre-new {
    color: #000000;
}
@media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) .tool-vdiff-pre-old {
        color: #361b1e;
    }
    :root:not([data-theme="dark"]) .tool-vdiff-pre-new {
        color: #000000;
    }
}
.tool-vcode-block {
    margin: 0;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.45;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border);
    color: var(--vscode-editor-foreground);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 180px;
    overflow-y: auto;
}
.tool-vchips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.tool-vchip {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(128, 128, 128, 0.12);
    border: 1px solid var(--vscode-widget-border);
    font-family: Consolas, monospace;
}
.tool-vchip-k {
    color: var(--vscode-descriptionForeground);
    font-weight: 600;
}
.tool-vchip-v {
    color: var(--vscode-foreground);
}
.tool-details summary {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    margin-top: 4px;
    opacity: 0.8;
}
.tool-details summary:hover {
    color: var(--vscode-textLink-foreground);
    opacity: 1;
}
`;

export const LOGVIEWER_ENHANCER_SCRIPT = `
(function() {
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseInlineMarkdown(str) {
        if (!str) return '';
        let res = escapeHtml(str);
        return res
            // Inline code \`...\`
            .replace(/\`([^\`]+)\`/g, (m, code) => '<code>' + code + '</code>')
            // Bold **...**
            .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
            // Italic *...*
            .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
            // Strikethrough ~~...~~
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            // Links [text](url)
            .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    function renderMarkdownToHtml(src) {
        if (!src) return '';
        let text = src.replace(/\\r\\n/g, '\\n');

        // Un-wrap common agent XML container tags (Claude Code pasted content, caveats, etc.)
        text = text.replace(/<pasted_content[^>]*>([\\s\\S]*?)<\\/pasted_content[^>]*>/gi, (m, inner) => {
            return '\\n\\n<div class="pasted-content-banner">📎 Pasted File / Content</div>\\n\\n' + inner.trim() + '\\n\\n';
        });
        text = text.replace(/<local-command-caveat[^>]*>([\\s\\S]*?)<\\/local-command-caveat[^>]*>/gi, (m, inner) => {
            return '\\n\\n<div class="pasted-content-banner caveat-banner">⚠️ Local Command Caveat</div>\\n\\n' + inner.trim() + '\\n\\n';
        });
        text = text.replace(/<\\/?(?:system_reminder|command-output|environment_context|antml)[^>]*>/gi, '');

        // 1. Extract fenced code blocks first
        const codeBlocks = [];
        text = text.replace(/\`\`\`([a-zA-Z0-9_-]*)\\n([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
            const placeholder = '___CODE_BLOCK_' + codeBlocks.length + '___';
            const cleanLang = (lang || 'code').toLowerCase();
            codeBlocks.push({
                placeholder: placeholder,
                html: '<div class="code-block-wrapper">' +
                      '<div class="code-block-header">' +
                      '<span class="code-lang-tag">' + escapeHtml(cleanLang) + '</span>' +
                      '<button class="code-copy-btn" title="Copy code snippet">📋 Copy</button>' +
                      '</div>' +
                      '<pre><code class="language-' + escapeHtml(cleanLang) + '">' + escapeHtml(code.trimEnd()) + '</code></pre>' +
                      '</div>'
            });
            return placeholder;
        });

        // 2. Headings (# H1 to ###### H6)
        text = text.replace(/^(#{1,6})\\s+(.+)$/gm, (m, hashes, content) => {
            const level = hashes.length;
            return '<h' + level + '>' + parseInlineMarkdown(content) + '</h' + level + '>';
        });

        // 3. Blockquotes (> quote)
        text = text.replace(/^(?:>\\s*.+\\n?)+/gm, (block) => {
            const lines = block.split('\\n').map(l => l.replace(/^>\\s?/, '')).join('\\n');
            return '<blockquote><p>' + parseInlineMarkdown(lines).replace(/\\n/g, '<br>') + '</p></blockquote>';
        });

        // 4. Tables (| a | b |) - matching multi-line table blocks starting and ending with |
        text = text.replace(/(?:^[ \\t]*\\|[^\\n]+\\|[ \\t]*(?:\\r?\\n|$))+/gm, (tableBlock) => {
            const lines = tableBlock.trim().split('\\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
            if (lines.length < 2) return tableBlock;
            let html = '<div class="table-scroll-wrapper"><table>';
            let isHead = true;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Check separator row like |---|---|
                if (/^\\|[-:\\s|]+\\|$/.test(line)) {
                    isHead = false;
                    continue;
                }
                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                const tag = isHead ? 'th' : 'td';
                html += (i === 0 ? '<thead><tr>' : (isHead ? '<tr>' : (html.includes('<tbody>') ? '<tr>' : '<tbody><tr>')));
                for (const cell of cells) {
                    html += '<' + tag + '>' + parseInlineMarkdown(cell) + '</' + tag + '>';
                }
                html += isHead ? '</tr></thead>' : '</tr>';
            }
            html += (html.includes('<tbody>') ? '</tbody>' : '') + '</table></div>';
            return html;
        });

        // 5. Unordered lists (- item, * item)
        text = text.replace(/^(?:[*-]\\s+.+\\n?)+/gm, (block) => {
            const items = block.trim().split('\\n').map(l => l.replace(/^[*-]\\s+/, ''));
            return '<ul>' + items.map(it => '<li>' + parseInlineMarkdown(it) + '</li>').join('') + '</ul>';
        });

        // 6. Ordered lists (1. item)
        text = text.replace(/^(?:\\d+\\.\\s+.+\\n?)+/gm, (block) => {
            const items = block.trim().split('\\n').map(l => l.replace(/^\\d+\\.\\s+/, ''));
            return '<ol>' + items.map(it => '<li>' + parseInlineMarkdown(it) + '</li>').join('') + '</ol>';
        });

        // 7. Horizontal rules (--- or ***)
        text = text.replace(/^(?:---|\\*\\*\\*|___)\\s*$/gm, '<hr>');

        // 8. Paragraphs & line breaks
        const paragraphs = text.split(/\\n{2,}/);
        text = paragraphs.map(p => {
            p = p.trim();
            if (!p) return '';
            if (/^<(?:h[1-6]|ul|ol|blockquote|div|hr|table)/i.test(p) || p.startsWith('___CODE_BLOCK_')) {
                return p;
            }
            return '<p>' + parseInlineMarkdown(p).replace(/\\n/g, '<br>') + '</p>';
        }).join('\\n');

        // 9. Restore code blocks
        codeBlocks.forEach(cb => {
            text = text.replace(new RegExp(cb.placeholder, 'g'), cb.html);
        });

        return text;
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    // -------------------------------------------------------------
    // Comprehensive Tool Call Visualization (Vertical Blocks & Telemetry)
    // -------------------------------------------------------------
    function renderToolCallVisualization(toolName, argsStr, resultStr, turnMeta, subAgentData) {
        let obj = null;
        let isJson = false;
        if (argsStr) {
            try {
                obj = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                if (obj && typeof obj === 'object') isJson = true;
            } catch {
                obj = null;
            }
        }
        if (!obj || typeof obj !== 'object') {
            obj = {};
        }

        const nameLower = (toolName || '').toLowerCase();
        const rows = [];
        const chips = [];
        const handledKeys = {};

        // Telemetry Ribbon Items
        const telItems = [];

        // 1. Executing Model / Subagent
        if (subAgentData && subAgentData.subAgentModel) {
            telItems.push('<span class="tool-vtel-item" title="Sub-agent model"><span class="tool-vtel-icon">🤖</span> <strong>' + escapeHtml(subAgentData.subAgentModel) + '</strong></span>');
        } else if (turnMeta && turnMeta.model) {
            const cleanModel = String(turnMeta.model).replace(/^[🎯\\s]+/, '');
            telItems.push('<span class="tool-vtel-item" title="Executing model"><span class="tool-vtel-icon">🎯</span> <strong>' + escapeHtml(cleanModel) + '</strong></span>');
        }

        // 2. Sub-agent tokens / cost if present
        if (subAgentData && subAgentData.subAgentTokens) {
            const inTok = subAgentData.subAgentTokens.input || 0;
            const outTok = subAgentData.subAgentTokens.output || 0;
            telItems.push('<span class="tool-vtel-item" title="Sub-agent tokens">📊 ↑' + inTok.toLocaleString() + ' · ↓' + outTok.toLocaleString() + '</span>');
            if (subAgentData.subAgentCost) {
                telItems.push('<span class="tool-vtel-item tool-vtel-cost" title="Sub-agent cost">💰 $' + Number(subAgentData.subAgentCost).toFixed(4) + '</span>');
            }
        } else if (argsStr) {
            // 3. Payload tokens estimate
            const argLen = argsStr.length;
            const argTok = estimateTokens(argsStr);
            telItems.push('<span class="tool-vtel-item" title="Input argument payload"><span class="tool-vtel-icon">📥</span> Args: <strong>' + formatBytes(argLen) + '</strong> <span class="tool-vtel-tok">(~' + argTok.toLocaleString() + ' tok)</span></span>');
        }

        // 4. Result size & tokens if present
        if (resultStr) {
            const resLen = resultStr.length;
            const resTok = estimateTokens(resultStr);
            const lineCount = resultStr.split('\\n').length;
            const isError = /error|failed|exception|exit code [1-9]|command failed/i.test(resultStr.slice(0, 300));

            telItems.push('<span class="tool-vtel-item" title="Tool execution output size"><span class="tool-vtel-icon">📤</span> Result: <strong>' + formatBytes(resLen) + '</strong> <span class="tool-vtel-tok">(~' + resTok.toLocaleString() + ' tok · ' + lineCount + ' lines)</span></span>');

            if (isError) {
                telItems.push('<span class="tool-vtel-tag tool-vtel-status-err">⚠️ Warning/Error</span>');
            } else {
                telItems.push('<span class="tool-vtel-tag tool-vtel-status-ok">✓ Output</span>');
            }
        }

        const telemetryHtml = telItems.length > 0 ? '<div class="tool-vtelemetry-bar">' + telItems.join('') + '</div>' : '';

        // If args wasn\'t JSON but had string content, show as plain argument block
        if (!isJson && argsStr && argsStr.trim()) {
            rows.push(
                '<div class="tool-vrow">' +
                '<span class="tool-vlabel">ARGUMENTS</span>' +
                '<div class="tool-vcode-wrap"><code class="tool-vcode">' + escapeHtml(argsStr.trim()) + '</code></div>' +
                '</div>'
            );
        }

        function markHandled(keys) {
            for (let i = 0; i < keys.length; i++) { handledKeys[keys[i]] = true; }
        }

        // Determine tool category for colored border
        let category = 'generic';
        if (nameLower.includes('command') || nameLower.includes('bash') || nameLower.includes('terminal') || nameLower.includes('shell')) category = 'cmd';
        else if (nameLower.includes('edit') || nameLower.includes('replace') || nameLower.includes('diff')) category = 'edit';
        else if (nameLower.includes('read') || nameLower.includes('view') || nameLower.includes('cat')) category = 'read';
        else if (nameLower.includes('grep') || nameLower.includes('glob') || nameLower.includes('search') || nameLower.includes('find')) category = 'search';
        else if (nameLower.includes('skill') || nameLower.includes('agent') || nameLower.includes('task')) category = 'agent';

        // 1. Skill / Custom Agent
        if (obj.skill || nameLower === 'skill') {
            const skillName = obj.skill || obj.name || obj.Skill;
            if (skillName) {
                category = 'agent';
                rows.push(
                    '<div class="tool-vrow tool-vrow-skill">' +
                    '<span class="tool-vlabel">🎯 SKILL</span>' +
                    '<span class="tool-vval tool-vbadge-skill">' + escapeHtml(skillName) + '</span>' +
                    '</div>'
                );
                markHandled(['skill', 'Skill', 'name']);
            }
        }

        // 2. Command execution
        const cmd = obj.CommandLine || obj.command || obj.cmd || obj.input;
        if (cmd && (nameLower.includes('command') || nameLower.includes('bash') || nameLower.includes('terminal') || nameLower.includes('shell') || !obj.file_path)) {
            category = 'cmd';
            rows.push(
                '<div class="tool-vrow tool-vrow-cmd">' +
                '<span class="tool-vlabel">💻 COMMAND</span>' +
                '<div class="tool-vcode-wrap"><code class="tool-vcode">' + escapeHtml(cmd) + '</code></div>' +
                '</div>'
            );
            markHandled(['CommandLine', 'command', 'cmd', 'input']);

            const cwd = obj.Cwd || obj.cwd || obj.working_directory;
            if (cwd) {
                rows.push(
                    '<div class="tool-vrow">' +
                    '<span class="tool-vlabel">📂 DIRECTORY</span>' +
                    '<span class="tool-vval tool-vpath">' + escapeHtml(cwd) + '</span>' +
                    '</div>'
                );
                markHandled(['Cwd', 'cwd', 'working_directory']);
            }
        }

        // 3. Search pattern
        const pattern = obj.pattern || obj.query || obj.regex || obj.search_term || obj.search_query;
        if (pattern) {
            category = 'search';
            rows.push(
                '<div class="tool-vrow tool-vrow-pattern">' +
                '<span class="tool-vlabel">🔍 PATTERN</span>' +
                '<code class="tool-vcode tool-vcode-pattern">' + escapeHtml(pattern) + '</code>' +
                '</div>'
            );
            markHandled(['pattern', 'query', 'regex', 'search_term', 'search_query']);
        }

        // 4. File Path
        const filePath = obj.file_path || obj.path || obj.TargetFile || obj.target_file || obj.AbsolutePath || obj.filePath || obj.file || obj.filename;
        if (filePath && !cmd) {
            let label = '📄 FILE';
            if (nameLower.includes('read') || nameLower.includes('view') || nameLower.includes('cat')) { label = '📖 READ FILE'; category = 'read'; }
            else if (nameLower.includes('edit') || nameLower.includes('replace') || nameLower.includes('diff')) { label = '📝 EDIT FILE'; category = 'edit'; }
            else if (nameLower.includes('write') || nameLower.includes('create') || nameLower.includes('save')) { label = '💾 WRITE FILE'; category = 'edit'; }
            else if (pattern || nameLower.includes('grep') || nameLower.includes('glob') || nameLower.includes('find')) { label = '📂 PATH'; category = 'search'; }

            rows.push(
                '<div class="tool-vrow tool-vrow-file">' +
                '<span class="tool-vlabel">' + label + '</span>' +
                '<span class="tool-vval tool-vpath" title="' + escapeHtml(filePath) + '">' + escapeHtml(filePath) + '</span>' +
                '</div>'
            );
            markHandled(['file_path', 'path', 'TargetFile', 'target_file', 'AbsolutePath', 'filePath', 'file', 'filename']);
        }

        // 5. Line ranges / Offsets / Limits
        const offset = obj.offset !== undefined ? obj.offset : undefined;
        const limit = obj.limit !== undefined ? obj.limit : undefined;
        const startLine = obj.StartLine !== undefined ? obj.StartLine : (obj.line_start !== undefined ? obj.line_start : obj.lineStart);
        const endLine = obj.EndLine !== undefined ? obj.EndLine : (obj.line_end !== undefined ? obj.line_end : obj.lineEnd);

        if (offset !== undefined || limit !== undefined || startLine !== undefined) {
            let rangeText = '';
            if (startLine !== undefined && endLine !== undefined) {
                rangeText = 'Lines ' + startLine + '–' + endLine;
            } else if (startLine !== undefined) {
                rangeText = 'Line ' + startLine;
            }
            if (offset !== undefined && limit !== undefined) {
                rangeText += (rangeText ? ' · ' : '') + 'Offset: ' + offset + ', Limit: ' + limit + ' (Lines ~' + offset + '–' + (offset + limit) + ')';
            } else if (offset !== undefined) {
                rangeText += (rangeText ? ' · ' : '') + 'Offset: ' + offset;
            } else if (limit !== undefined) {
                rangeText += (rangeText ? ' · ' : '') + 'Limit: ' + limit;
            }
            rows.push(
                '<div class="tool-vrow">' +
                '<span class="tool-vlabel">📏 RANGE</span>' +
                '<span class="tool-vval tool-vpill">' + escapeHtml(rangeText) + '</span>' +
                '</div>'
            );
            markHandled(['offset', 'limit', 'StartLine', 'EndLine', 'line_start', 'line_end', 'lineStart', 'lineEnd']);
        }

        // 6. Diff (old_string / new_string)
        const oldStr = obj.old_string !== undefined ? obj.old_string : (obj.old_text !== undefined ? obj.old_text : obj.before);
        const newStr = obj.new_string !== undefined ? obj.new_string : (obj.new_text !== undefined ? obj.new_text : obj.after);
        if (oldStr !== undefined || newStr !== undefined) {
            category = 'edit';
            if (oldStr !== undefined) {
                const oldLines = String(oldStr).split(/\\r?\\n/).length;
                rows.push(
                    '<div class="tool-vrow tool-vrow-diff tool-vrow-diff-old">' +
                    '<div class="tool-vdiff-header"><span class="tool-vdiff-tag tool-vdiff-tag-old">− REMOVED / REPLACE</span><span class="tool-vdiff-lines">' + oldLines + ' lines</span></div>' +
                    '<pre class="tool-vdiff-pre tool-vdiff-pre-old"><code>' + escapeHtml(oldStr) + '</code></pre>' +
                    '</div>'
                );
            }
            if (newStr !== undefined) {
                const newLines = String(newStr).split(/\\r?\\n/).length;
                rows.push(
                    '<div class="tool-vrow tool-vrow-diff tool-vrow-diff-new">' +
                    '<div class="tool-vdiff-header"><span class="tool-vdiff-tag tool-vdiff-tag-new">+ ADDED / WITH</span><span class="tool-vdiff-lines">' + newLines + ' lines</span></div>' +
                    '<pre class="tool-vdiff-pre tool-vdiff-pre-new"><code>' + escapeHtml(newStr) + '</code></pre>' +
                    '</div>'
                );
            }
            markHandled(['old_string', 'new_string', 'old_text', 'new_text', 'before', 'after']);
        }

        // 7. File Write content
        if (obj.content !== undefined && (nameLower.includes('write') || nameLower.includes('create'))) {
            category = 'edit';
            const contentStr = String(obj.content);
            const linesCount = contentStr.split(/\\r?\\n/).length;
            const previewLines = contentStr.split(/\\r?\\n/).slice(0, 6).join('\\n');
            const preview = linesCount > 6 ? previewLines + '\\n... (' + (linesCount - 6) + ' more lines)' : contentStr;
            rows.push(
                '<div class="tool-vrow tool-vrow-content">' +
                '<div class="tool-vdiff-header"><span class="tool-vlabel">📄 FILE CONTENT</span><span class="tool-vdiff-lines">' + linesCount + ' lines</span></div>' +
                '<pre class="tool-vcode-block"><code>' + escapeHtml(preview) + '</code></pre>' +
                '</div>'
            );
            markHandled(['content']);
        }

        // 8. Description / Instruction
        const desc = obj.Instruction || obj.instruction || obj.Description || obj.description || obj.toolAction || obj.toolSummary;
        if (desc) {
            rows.push(
                '<div class="tool-vrow">' +
                '<span class="tool-vlabel">💬 INSTRUCTION</span>' +
                '<span class="tool-vval tool-vdesc">' + escapeHtml(desc) + '</span>' +
                '</div>'
            );
            markHandled(['Instruction', 'instruction', 'Description', 'description', 'toolAction', 'toolSummary']);
        }

        // 9. All remaining properties become metadata chips
        for (const key of Object.keys(obj)) {
            if (handledKeys[key]) continue;
            const val = obj[key];
            if (val === null || val === undefined) continue;
            let valDisplay = '';
            if (typeof val === 'boolean') {
                valDisplay = val ? 'true' : 'false';
            } else if (typeof val === 'object') {
                valDisplay = JSON.stringify(val);
            } else {
                valDisplay = String(val);
            }
            chips.push(
                '<span class="tool-vchip"><span class="tool-vchip-k">' + escapeHtml(key) + ':</span> <span class="tool-vchip-v">' + escapeHtml(valDisplay) + '</span></span>'
            );
        }

        if (chips.length > 0) {
            rows.push(
                '<div class="tool-vrow tool-vrow-chips">' +
                '<span class="tool-vlabel">⚙️ OPTIONS</span>' +
                '<div class="tool-vchips-list">' + chips.join('') + '</div>' +
                '</div>'
            );
        }

        if (rows.length === 0 && !telemetryHtml) return '';

        return '<div class="tool-visual-card tool-glance-card tool-type-' + category + '">' + telemetryHtml + rows.join('') + '</div>';
    }

    // -------------------------------------------------------------
    // Fixed bottom-left toggle: expands or collapses every tool-calls section
    // -------------------------------------------------------------
    const TOOLS_TOGGLE_ID = 'jookoi-tools-toggle';

    function getToolCallsSections() {
        return document.querySelectorAll('details.tool-calls-details');
    }

    function updateToolsToggleLabel() {
        const toggleButton = document.getElementById(TOOLS_TOGGLE_ID);
        if (!toggleButton) return;
        const sections = getToolCallsSections();
        toggleButton.hidden = sections.length === 0;
        const anyClosed = Array.from(sections).some(section => !section.open);
        toggleButton.textContent = anyClosed ? '▸ Expand all tools' : '▾ Collapse all tools';
        toggleButton.title = anyClosed ? 'Open every tool-calls section' : 'Close every tool-calls section';
    }

    function ensureToolsToggle() {
        if (document.getElementById(TOOLS_TOGGLE_ID) || !document.body) return;
        const toggleButton = document.createElement('button');
        toggleButton.id = TOOLS_TOGGLE_ID;
        toggleButton.type = 'button';
        toggleButton.className = 'tools-toggle-fab';
        toggleButton.addEventListener('click', () => {
            const sections = getToolCallsSections();
            const openAll = Array.from(sections).some(section => !section.open);
            sections.forEach(section => { section.open = openAll; });
            updateToolsToggleLabel();
        });
        // details "toggle" does not bubble, so listen in the capture phase to catch single-section clicks.
        document.addEventListener('toggle', event => {
            if (event.target && event.target.matches && event.target.matches('details.tool-calls-details')) {
                updateToolsToggleLabel();
            }
        }, true);
        document.body.appendChild(toggleButton);
        updateToolsToggleLabel();
    }

    // -------------------------------------------------------------
    // Step sides: hide the User or Assistant block when it has no text.
    // The bundled renderer writes <em>No message</em> / <em>No response</em> placeholders.
    // -------------------------------------------------------------
    function isEmptyPlaceholderSide(messageEl) {
        const textEl = messageEl.querySelector('.message-text');
        if (!textEl) return true;
        const onlyChild = textEl.children.length === 1 ? textEl.firstElementChild : null;
        return !textEl.textContent.trim() || (onlyChild !== null && onlyChild.tagName === 'EM');
    }

    function hideEmptyStepSides() {
        document.querySelectorAll('.turn-content').forEach(contentEl => {
            const messageEls = contentEl.querySelectorAll(':scope > .message');
            let visibleCount = 0;
            messageEls.forEach(messageEl => {
                const empty = isEmptyPlaceholderSide(messageEl);
                messageEl.hidden = empty;
                if (!empty) visibleCount++;
            });
            contentEl.hidden = visibleCount === 0;
        });
    }

    // -------------------------------------------------------------
    // Tool-calls sections start open. Opened once per section, so a section the user
    // collapses stays collapsed when the list re-renders.
    // -------------------------------------------------------------
    function openToolSectionsOnce() {
        getToolCallsSections().forEach(section => {
            if (section.hasAttribute('data-jookoi-default-open')) return;
            section.setAttribute('data-jookoi-default-open', 'true');
            section.open = true;
        });
    }

    // -------------------------------------------------------------
    // Main Enhancer Execution
    // -------------------------------------------------------------
    function enhanceLogViewer() {
        ensureToolsToggle();
        updateToolsToggleLabel();
        hideEmptyStepSides();
        openToolSectionsOnce();

        // 1. Enhance Turn Messages with Markdown & Raw Toggles
        const messageElements = document.querySelectorAll('.turn-content .message, .turn-card .message, .message.user-message, .message.assistant-message');
        messageElements.forEach(msgEl => {
            try {
                if (msgEl.hasAttribute('data-enhanced') && msgEl.querySelector('.jookoi-mdx-renderer')) return;
                msgEl.setAttribute('data-enhanced', 'true');

                const labelEl = msgEl.querySelector('.message-label');
                const textEl = msgEl.querySelector('.message-text');
                if (!textEl) return;
                if (textEl.querySelector('.jookoi-mdx-renderer')) return;

                const rawText = textEl.textContent || '';
                if (!rawText.trim()) return;

                // Build Header Bar
                const headerBar = document.createElement('div');
                headerBar.className = 'message-header-bar';

                const labelSpan = document.createElement('span');
                labelSpan.innerHTML = labelEl ? labelEl.innerHTML : (msgEl.classList.contains('user-message') ? '👤 User' : '🤖 Assistant');
                if (labelEl) labelEl.remove();

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'msg-btn active-mode';
                toggleBtn.innerHTML = '👁️ Rendered';
                toggleBtn.title = 'Toggle between Rendered Markdown and Raw Text';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'msg-btn';
                copyBtn.innerHTML = '📋 Copy Raw';
                copyBtn.title = 'Copy exact raw markdown to clipboard';

                actionsDiv.append(toggleBtn, copyBtn);
                headerBar.append(labelSpan, actionsDiv);

                // Build Rendered and Raw Content Containers
                const renderedDiv = document.createElement('div');
                renderedDiv.className = 'jookoi-mdx-renderer';
                renderedDiv.innerHTML = renderMarkdownToHtml(rawText);

                const rawPre = document.createElement('pre');
                rawPre.className = 'message-raw';
                rawPre.textContent = rawText;

                // Wire up Copy Raw
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(rawText).then(() => {
                        const orig = copyBtn.innerHTML;
                        copyBtn.innerHTML = '✓ Copied!';
                        setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
                    });
                });

                // Wire up Toggle Raw / Rendered
                let isRendered = true;
                toggleBtn.addEventListener('click', () => {
                    isRendered = !isRendered;
                    if (isRendered) {
                        renderedDiv.style.display = 'block';
                        rawPre.style.display = 'none';
                        toggleBtn.innerHTML = '👁️ Rendered';
                        toggleBtn.classList.add('active-mode');
                    } else {
                        renderedDiv.style.display = 'none';
                        rawPre.style.display = 'block';
                        toggleBtn.innerHTML = '📝 Raw MD';
                        toggleBtn.classList.remove('active-mode');
                    }
                });

                textEl.innerHTML = '';
                textEl.append(renderedDiv, rawPre);
                msgEl.prepend(headerBar);
            } catch (err) {
                console.error('Error enhancing message element:', err);
            }
        });

        // 2. Wire up Code Block Copy Buttons
        document.querySelectorAll('.code-block-wrapper .code-copy-btn').forEach(btn => {
            if (btn.hasAttribute('data-bound')) return;
            btn.setAttribute('data-bound', 'true');
            btn.addEventListener('click', () => {
                const wrapper = btn.closest('.code-block-wrapper');
                const codeEl = wrapper ? wrapper.querySelector('code') : null;
                if (!codeEl) return;
                navigator.clipboard.writeText(codeEl.textContent || '').then(() => {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '✓ Copied!';
                    setTimeout(() => { btn.innerHTML = orig; }, 1500);
                });
            });
        });

        // 3. Enhance Tool Call Rows with Structured Vertical Property Cards
        document.querySelectorAll('.turn-tools-table tbody tr').forEach(row => {
            try {
                if (row.hasAttribute('data-glance-enhanced')) return;
                row.setAttribute('data-glance-enhanced', 'true');

                const nameCell = row.querySelector('.tool-name-cell');
                if (!nameCell) return;

                const toolLink = nameCell.querySelector('.tool-name-link, .tool-call-link, .tool-name');
                const toolName = toolLink ? (toolLink.getAttribute('title') || toolLink.textContent || '') : '';
                const turnNumStr = toolLink ? toolLink.getAttribute('data-turn') : null;
                const callIdxStr = toolLink ? toolLink.getAttribute('data-toolcall') : null;

                const detailsList = nameCell.querySelectorAll('details.tool-details');
                let argsPre = null;
                let resultPre = null;
                detailsList.forEach(det => {
                    const sum = det.querySelector('summary');
                    if (sum && (sum.textContent.includes('Arguments') || sum.textContent.includes('Raw JSON'))) {
                        argsPre = det.querySelector('pre');
                        sum.textContent = '🔍 View Raw JSON';
                        det.open = false; // keep raw JSON collapsed
                    } else if (sum && sum.textContent.includes('Result')) {
                        resultPre = det.querySelector('pre');
                        sum.textContent = '📋 Result Output';
                    }
                });

                // Extract turn metadata & subagent data from window.__INITIAL_LOGDATA__ if available
                let turnObj = null;
                if (window.__INITIAL_LOGDATA__ && Array.isArray(window.__INITIAL_LOGDATA__.turns) && turnNumStr !== null) {
                    const tNum = parseInt(turnNumStr, 10);
                    turnObj = window.__INITIAL_LOGDATA__.turns.find(t => t.turnNumber === tNum);
                }
                let tcObj = null;
                if (turnObj && Array.isArray(turnObj.toolCalls) && callIdxStr !== null) {
                    const cIdx = parseInt(callIdxStr, 10);
                    tcObj = turnObj.toolCalls[cIdx];
                }

                const turnCard = row.closest('.turn-card');
                const turnModelEl = turnCard ? turnCard.querySelector('.turn-model') : null;
                const turnModel = turnModelEl ? turnModelEl.textContent.trim() : (turnObj ? turnObj.model : null);
                const turnMeta = { model: turnModel, turnNumber: turnObj ? turnObj.turnNumber : turnNumStr };

                const argsText = (argsPre && argsPre.textContent) ? argsPre.textContent : (tcObj && tcObj.arguments ? tcObj.arguments : '');
                const resultText = (resultPre && resultPre.textContent) ? resultPre.textContent : (tcObj && tcObj.result ? tcObj.result : '');

                if (argsText || tcObj) {
                    const cardHtml = renderToolCallVisualization(toolName, argsText, resultText, turnMeta, tcObj);
                    if (cardHtml) {
                        const cardContainer = document.createElement('div');
                        cardContainer.innerHTML = cardHtml;
                        // Insert above the first details element
                        const firstDetails = nameCell.querySelector('details.tool-details');
                        if (firstDetails) {
                            nameCell.insertBefore(cardContainer.firstElementChild, firstDetails);
                        } else {
                            nameCell.appendChild(cardContainer.firstElementChild);
                        }
                    }
                }
            } catch (err) {
                console.error('Error enhancing tool call row:', err);
            }
        });
    }

    // Run enhancement immediately and poll briefly to handle async bootstrap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceLogViewer);
    } else {
        enhanceLogViewer();
    }

    let retries = 0;
    const retryInterval = setInterval(() => {
        enhanceLogViewer();
        retries++;
        if (retries > 30) {
            clearInterval(retryInterval);
        }
    }, 100);

    // Re-run on layout mutations (paging, filtering, turn expanding)
    const root = document.getElementById('root');
    if (root) {
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(enhanceLogViewer, 30);
        });
        observer.observe(root, { childList: true, subtree: true });
    }
})();
`;
