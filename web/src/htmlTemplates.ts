import tokenEstimatorsData from '../../src/tokenEstimators.json';
import modelPricingData from '../../src/modelPricing.json';
import toolNamesData from '../../src/toolNames.json';
import automaticToolsData from '../../src/automaticTools.json';
import { getWebviewLocalization, getSystemLocale } from './statsService';
import { LOGVIEWER_ENHANCER_STYLES, LOGVIEWER_ENHANCER_SCRIPT } from './logviewerEnhancer';

const VSCODE_DARK_VARS = `
:root {
    --vscode-editor-background: #1e1e1e;
    --vscode-sideBar-background: #252526;
    --vscode-editorWidget-background: #252526;
    --vscode-editor-foreground: #cccccc;
    --vscode-descriptionForeground: #858585;
    --vscode-disabledForeground: #858585;
    --vscode-panel-border: #80808059;
    --vscode-widget-border: #303031;
    --vscode-button-background: #0e639c;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #1177bb;
    --vscode-button-secondaryBackground: #3a3d41;
    --vscode-button-secondaryForeground: #ffffff;
    --vscode-button-secondaryHoverBackground: #45494e;
    --vscode-input-background: #3c3c3c;
    --vscode-input-foreground: #cccccc;
    --vscode-input-border: transparent;
    --vscode-list-hoverBackground: #2a2d2e;
    --vscode-list-activeSelectionBackground: #04395e;
    --vscode-list-activeSelectionForeground: #ffffff;
    --vscode-list-inactiveSelectionBackground: #37373d;
    --vscode-badge-background: #4d4d4d;
    --vscode-badge-foreground: #ffffff;
    --vscode-focusBorder: #007fd4;
    --vscode-textLink-foreground: #3794ff;
    --vscode-textLink-activeForeground: #3794ff;
    --vscode-errorForeground: #f48771;
    --vscode-editorWarning-foreground: #cca700;
    --vscode-terminal-ansiGreen: #23d18b;
    --vscode-contrastBorder: #6fc3df;
    --vscode-foreground: #cccccc;
    --vscode-button-border: transparent;
    --vscode-dropdown-background: #313131;
    --vscode-dropdown-foreground: #cccccc;
    --vscode-dropdown-border: #3c3c3c;
    --vscode-textBlockQuote-background: #2b2b2b;
    --vscode-editorInfo-foreground: #3794ff;
    --vscode-inputValidation-infoBackground: #063b49;
    --vscode-inputValidation-infoBorder: #1a85ff;
    --vscode-inputValidation-warningBackground: #352a05;
    --vscode-inputValidation-warningBorder: #b89500;
    --vscode-inputValidation-errorBackground: #5a1d1d;
    --vscode-inputValidation-errorBorder: #be1100;
    --vscode-charts-blue: #4daafc;
    --vscode-charts-green: #89d185;
    --vscode-charts-orange: #d18616;
    --vscode-charts-purple: #b180d7;
    --vscode-charts-red: #f14c4c;
    --vscode-charts-yellow: #cca700;
    --vscode-terminal-ansiCyan: #11a8cd;
}
`;

const VSCODE_LIGHT_VARS = `
[data-theme="light"],
:root[data-theme="light"],
body[data-theme="light"],
body[data-vscode-theme-kind="vscode-light"],
.vscode-light {
    --vscode-editor-background: #ffffff;
    --vscode-sideBar-background: #f3f3f3;
    --vscode-editorWidget-background: #f3f3f3;
    --vscode-editor-foreground: #000000;
    --vscode-descriptionForeground: #717171;
    --vscode-disabledForeground: #717171;
    --vscode-panel-border: #e7e7e7;
    --vscode-widget-border: #c8c8c8;
    --vscode-button-background: #007acc;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0062a3;
    --vscode-button-secondaryBackground: #5f6a79;
    --vscode-button-secondaryForeground: #ffffff;
    --vscode-button-secondaryHoverBackground: #4c5561;
    --vscode-input-background: #ffffff;
    --vscode-input-foreground: #616161;
    --vscode-input-border: #cecece;
    --vscode-list-hoverBackground: #e8e8e8;
    --vscode-list-activeSelectionBackground: #0060c0;
    --vscode-list-activeSelectionForeground: #ffffff;
    --vscode-list-inactiveSelectionBackground: #e4e6f1;
    --vscode-badge-background: #c4c4c4;
    --vscode-badge-foreground: #333333;
    --vscode-focusBorder: #0090f1;
    --vscode-textLink-foreground: #006ab1;
    --vscode-textLink-activeForeground: #006ab1;
    --vscode-errorForeground: #a1260d;
    --vscode-editorWarning-foreground: #b89500;
    --vscode-terminal-ansiGreen: #00bc00;
    --vscode-contrastBorder: #6fc3df;
    --vscode-foreground: #3b3b3b;
    --vscode-dropdown-background: #ffffff;
    --vscode-dropdown-foreground: #3b3b3b;
    --vscode-dropdown-border: #cecece;
    --vscode-textBlockQuote-background: #f8f8f8;
    --vscode-editorInfo-foreground: #1a85ff;
    --vscode-inputValidation-infoBackground: #d6ecf2;
    --vscode-inputValidation-infoBorder: #007acc;
    --vscode-inputValidation-warningBackground: #f6f5d2;
    --vscode-inputValidation-warningBorder: #b89500;
    --vscode-inputValidation-errorBackground: #f2dede;
    --vscode-inputValidation-errorBorder: #be1100;
    --vscode-charts-blue: #1a85ff;
    --vscode-charts-green: #388a34;
    --vscode-charts-purple: #652d90;
    --vscode-charts-red: #e51400;
    --vscode-charts-yellow: #bf8803;
    --vscode-terminal-ansiCyan: #0598bc;
}

@media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
        --vscode-editor-background: #ffffff;
        --vscode-sideBar-background: #f3f3f3;
        --vscode-editorWidget-background: #f3f3f3;
        --vscode-editor-foreground: #000000;
        --vscode-descriptionForeground: #717171;
        --vscode-disabledForeground: #717171;
        --vscode-panel-border: #e7e7e7;
        --vscode-widget-border: #c8c8c8;
        --vscode-button-background: #007acc;
        --vscode-button-foreground: #ffffff;
        --vscode-button-hoverBackground: #0062a3;
        --vscode-button-secondaryBackground: #5f6a79;
        --vscode-button-secondaryForeground: #ffffff;
        --vscode-button-secondaryHoverBackground: #4c5561;
        --vscode-input-background: #ffffff;
        --vscode-input-foreground: #616161;
        --vscode-input-border: #cecece;
        --vscode-list-hoverBackground: #e8e8e8;
        --vscode-list-activeSelectionBackground: #0060c0;
        --vscode-list-activeSelectionForeground: #ffffff;
        --vscode-list-inactiveSelectionBackground: #e4e6f1;
        --vscode-badge-background: #c4c4c4;
        --vscode-badge-foreground: #333333;
        --vscode-focusBorder: #0090f1;
        --vscode-textLink-foreground: #006ab1;
        --vscode-textLink-activeForeground: #006ab1;
        --vscode-errorForeground: #a1260d;
        --vscode-editorWarning-foreground: #b89500;
        --vscode-terminal-ansiGreen: #00bc00;
        --vscode-contrastBorder: #6fc3df;
        --vscode-foreground: #3b3b3b;
        --vscode-dropdown-background: #ffffff;
        --vscode-dropdown-foreground: #3b3b3b;
        --vscode-dropdown-border: #cecece;
        --vscode-textBlockQuote-background: #f8f8f8;
        --vscode-editorInfo-foreground: #1a85ff;
        --vscode-inputValidation-infoBackground: #d6ecf2;
        --vscode-inputValidation-infoBorder: #007acc;
        --vscode-inputValidation-warningBackground: #f6f5d2;
        --vscode-inputValidation-warningBorder: #b89500;
        --vscode-inputValidation-errorBackground: #f2dede;
        --vscode-inputValidation-errorBorder: #be1100;
        --vscode-charts-blue: #1a85ff;
        --vscode-charts-green: #388a34;
        --vscode-charts-purple: #652d90;
        --vscode-charts-red: #e51400;
        --vscode-charts-yellow: #bf8803;
        --vscode-terminal-ansiCyan: #0598bc;
    }
}
`;

// App Shell Global Styles (Header, Nav, Viewport, Transitions)
const NAV_AND_GLOBAL_STYLES = `
html, body {
    margin: 0;
    padding: 0;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
#app-header {
    background-color: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 44px;
    user-select: none;
    flex-shrink: 0;
    box-sizing: border-box;
    font-size: 13px;
    z-index: 1000;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
    overflow: visible;
}
.brand-title {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 18px;
    color: var(--vscode-foreground);
    text-decoration: none;
    cursor: pointer;
    flex-shrink: 0;
}
.brand-badge {
    font-size: 10px;
    text-transform: uppercase;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    letter-spacing: 0.5px;
}
.nav-links {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    overflow: visible;
    white-space: nowrap;
    padding: 2px 0;
}
.nav-tab {
    padding: 5px 12px;
    color: var(--vscode-foreground);
    text-decoration: none;
    border-radius: 6px;
    opacity: 0.8;
    transition: all 0.15s ease;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid transparent;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    background: transparent;
    font-family: inherit;
}
.nav-tab:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
    color: var(--vscode-foreground);
}
/* Distinct prominent active tab styling */
.nav-tab.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    opacity: 1;
    font-weight: 600;
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}
.nav-tab.session-tab {
    border: 1px dashed var(--vscode-focusBorder);
}
.nav-tab.session-tab.active {
    border-style: solid;
}
/* Session Dropdown in Row 1 */
.session-dropdown {
    position: relative;
    display: inline-flex;
    align-items: center;
}
.session-dropdown-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    min-width: 340px;
    max-width: 440px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-widget-border, #303031);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    z-index: 2100;
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.session-dropdown-menu.open {
    display: flex;
}
.session-dropdown-header {
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
}
#session-search-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #cccccc);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
}
#session-search-input:focus {
    border-color: var(--vscode-focusBorder);
}
.session-dropdown-list {
    flex: 1;
    overflow-y: auto;
    max-height: 350px;
    display: flex;
    flex-direction: column;
}
.session-item {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    color: var(--vscode-foreground);
    text-decoration: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    transition: background 0.12s ease;
}
.session-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.session-item-subtitle {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #858585);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0.9;
}
.session-item-meta {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #858585);
    display: flex;
    align-items: center;
    gap: 8px;
}
.session-item-workspace {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.session-item-turns {
    font-weight: 500;
}
.session-item-time {
    margin-left: auto;
    font-size: 10px;
    opacity: 0.8;
}
.session-dropdown-loading, .session-dropdown-empty {
    padding: 18px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}

/* Row 2: Sub-header contextual navigation bar */
#app-sub-header {
    background-color: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border);
    display: none;
    align-items: center;
    padding: 0 16px;
    height: 34px;
    user-select: none;
    flex-shrink: 0;
    box-sizing: border-box;
    font-size: 12px;
    z-index: 990;
    overflow-x: auto;
    white-space: nowrap;
    gap: 6px;
}
.sub-nav-container {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
}
.sub-nav-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--vscode-descriptionForeground);
    margin-right: 6px;
    letter-spacing: 0.5px;
}
.sub-nav-tab {
    padding: 4px 10px;
    border-radius: 5px;
    color: var(--vscode-foreground);
    text-decoration: none;
    opacity: 0.75;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 500;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid transparent;
}
.sub-nav-tab:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
}
.sub-nav-tab.active {
    opacity: 1;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ffffff);
    font-weight: 600;
    border-color: var(--vscode-focusBorder);
}

/* Header Actions */
.nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
    flex-shrink: 0;
}
.width-presets {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 5px;
    padding: 2px;
    gap: 2px;
}
.width-btn {
    background: transparent;
    border: none;
    color: var(--vscode-foreground);
    padding: 2px 7px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.15s ease;
    font-family: inherit;
}
.width-btn:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
}
.width-btn.active {
    opacity: 1;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: 600;
}
.nav-btn {
    background: transparent;
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-foreground);
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background 0.15s ease;
    font-family: inherit;
}
.nav-btn:hover {
    background: var(--vscode-list-hoverBackground);
}
.nav-btn:active {
    transform: scale(0.96);
    background: var(--vscode-button-hoverBackground);
}

@keyframes spin-refresh-glyph {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.refreshing .codicon-refresh,
.spinning .codicon-refresh {
    display: inline-block;
    animation: spin-refresh-glyph 0.75s linear infinite;
}

/* Viewport Resizer & Frame */
#app-viewport {
    flex: 1;
    display: flex;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background-color: var(--vscode-editor-background);
}
#resize-drag-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    cursor: col-resize;
    z-index: 99999;
    display: none;
}
.viewport-resizer-container {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    position: relative;
    transition: max-width 0.12s ease-out;
}
.viewport-resizer-container.resizing {
    transition: none !important;
    user-select: none !important;
}
.viewport-inner {
    flex: 1;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--vscode-editor-background);
    box-shadow: 0 0 18px rgba(0, 0, 0, 0.25);
}
.resize-handle {
    width: 10px;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    user-select: none;
    transition: background 0.15s ease;
    flex-shrink: 0;
}
.resize-handle:hover, .resize-handle.active {
    background: rgba(255, 255, 255, 0.08);
}
.resize-handle-bar {
    width: 3px;
    height: 40px;
    border-radius: 2px;
    background: var(--vscode-panel-border);
    transition: background 0.15s ease;
}
.resize-handle:hover .resize-handle-bar, .resize-handle.active .resize-handle-bar {
    background: var(--vscode-focusBorder);
}

.view-loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 2px;
    width: 0%;
    background: var(--vscode-button-background);
    transition: width 0.25s ease, opacity 0.25s ease;
    z-index: 100;
    opacity: 0;
    pointer-events: none;
}
.view-frame {
    flex: 1;
    width: 100%;
    height: 100%;
    border: none;
    display: none;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}
.view-frame.active {
    display: block;
    opacity: 1;
}

/* Modal Dialog for Tool Calls */
.modal-backdrop {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.65);
    z-index: 9999;
    align-items: center;
    justify-content: center;
}
.modal-backdrop.open { display: flex; }
.modal-card {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 8px;
    width: 80%;
    max-width: 860px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.modal-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
}
.modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}
.modal-body pre {
    background: var(--vscode-editor-background);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    border: 1px solid var(--vscode-panel-border);
}
`;

// Embedded View Styles (Clean padding between outer header and inner view header + active buttons)
const VIEW_EMBED_STYLES = `
html, body {
    margin: 0;
    padding: 0;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    height: 100%;
    overflow-y: auto;
}
#root {
    padding: 16px 20px 24px 20px;
    min-height: 100%;
    box-sizing: border-box;
}

/* Remove max width restriction from container and all root containers */
.container,
body .container,
#root .container,
.main-content,
#root,
.content-wrapper,
.panel-container {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
    position: relative !important;
}

/* Completely hide redundant panel headers in all themes */
.container > .header,
.header,
.vscode-light .container .header,
.vscode-dark .container .header,
.header > h1,
.header > .header-title,
.header > p,
.header > .header-desc,
.header-desc,
.group-tabs,
.tabs.group-tabs,
#diagnostics-group-tabs {
    display: none !important;
}

/* Transform top info-box into an unobtrusive hover-only info tip icon */
.top-info-tip {
    position: absolute !important;
    top: 14px !important;
    right: 18px !important;
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    min-height: 26px !important;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 50% !important;
    background: var(--vscode-editorWidget-background, #252526) !important;
    border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35)) !important;
    color: var(--vscode-foreground, #cccccc) !important;
    cursor: pointer !important;
    z-index: 1000 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important;
    transition: all 0.15s ease !important;
}
.top-info-tip:hover {
    border-color: var(--vscode-focusBorder, #007fd4) !important;
    background: var(--vscode-list-hoverBackground, #2a2d2e) !important;
    box-shadow: 0 0 6px var(--vscode-focusBorder, #007fd4) !important;
}
.top-info-tip .info-tip-icon {
    font-size: 13px !important;
    line-height: 1 !important;
    user-select: none !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
}
.top-info-tip .info-tip-popover {
    display: none !important;
    position: absolute !important;
    top: calc(100% + 6px) !important;
    right: 0 !important;
    width: 320px !important;
    max-width: 85vw !important;
    background: var(--vscode-editorWidget-background, #252526) !important;
    border: 1px solid var(--vscode-widget-border, #303031) !important;
    border-radius: 8px !important;
    padding: 12px 14px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
    z-index: 2000 !important;
    pointer-events: auto !important;
    text-align: left !important;
}
.top-info-tip:hover .info-tip-popover {
    display: block !important;
}
.top-info-tip .info-tip-popover .info-tip-title {
    font-weight: 600 !important;
    font-size: 12px !important;
    color: var(--vscode-textLink-foreground, #3794ff) !important;
    margin-bottom: 6px !important;
}
.top-info-tip .info-tip-popover .info-tip-body {
    font-size: 11.5px !important;
    line-height: 1.5 !important;
    color: var(--vscode-descriptionForeground, #858585) !important;
}

/* Fallback: before JS initialization, prevent raw top info-box from pushing layout */
.container > .info-box:first-of-type:not(.top-info-tip) {
    display: none !important;
}

/* Layout .button-row neatly if rendered outside header */
.header .button-row,
.button-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

/* Level 3 Leaf navigation bar inside embedded panel */
.leaf-tabs,
.tabs.leaf-tabs {
    display: flex;
    gap: 6px !important;
    padding: 4px 0 12px 0 !important;
    border-bottom: 1px solid var(--vscode-panel-border) !important;
    margin-bottom: 16px !important;
    flex-wrap: wrap !important;
}
.leaf-tabs[style*="none"],
.tabs.leaf-tabs[style*="none"],
.tab-bar.leaf-tabs[style*="none"] {
    display: none !important;
}
.leaf-tabs .tab-button,
.leaf-tabs .tab,
.tabs.leaf-tabs .tab {
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    padding: 5px 12px;
    border-radius: 16px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.leaf-tabs .tab-button:hover,
.leaf-tabs .tab:hover,
.tabs.leaf-tabs .tab:hover {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-editor-foreground);
}
.leaf-tabs .tab-button.active,
.leaf-tabs .tab.active,
.tabs.leaf-tabs .tab.active {
    background: var(--vscode-button-background) !important;
    color: var(--vscode-button-foreground) !important;
    border-color: var(--vscode-focusBorder) !important;
    font-weight: 600 !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25) !important;
}

/* Distinct prominent active/selected styling for active button in inner header button-row */
/* Host element styling for @vscode-elements vscode-button */
.header .button-row vscode-button.nav-active,
.header .button-row vscode-button[aria-current="page"],
.header .button-row vscode-button[disabled].nav-active,
.button-row vscode-button.nav-active,
.button-row vscode-button[aria-current="page"],
.button-row vscode-button[disabled].nav-active {
    opacity: 1 !important;
    cursor: default !important;
    pointer-events: none !important;
    --vscode-button-secondaryBackground: var(--vscode-button-background) !important;
    --vscode-button-secondaryForeground: var(--vscode-button-foreground) !important;
    --vscode-button-border: var(--vscode-focusBorder) !important;
    --vscode-button-background: var(--vscode-button-background) !important;
    --vscode-button-foreground: var(--vscode-button-foreground) !important;
}

/* Shadow DOM part "base" (@vscode-elements Web Component part) */
.header .button-row vscode-button.nav-active::part(base),
.header .button-row vscode-button[aria-current="page"]::part(base),
.header .button-row vscode-button[disabled].nav-active::part(base),
.button-row vscode-button.nav-active::part(base),
.button-row vscode-button[aria-current="page"]::part(base),
.button-row vscode-button[disabled].nav-active::part(base),
.header .button-row vscode-button.nav-active::part(control),
.button-row vscode-button.nav-active::part(control) {
    background-color: var(--vscode-button-background) !important;
    color: var(--vscode-button-foreground) !important;
    border: 1px solid var(--vscode-focusBorder) !important;
    font-weight: 600 !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3) !important;
    opacity: 1 !important;
    cursor: default !important;
}

/* Standard <button> elements if rendered */
.header .button-row button.nav-active,
.button-row button.nav-active,
.header .button-row button[aria-current="page"] {
    background-color: var(--vscode-button-background) !important;
    color: var(--vscode-button-foreground) !important;
    border: 1px solid var(--vscode-focusBorder) !important;
    font-weight: 600 !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3) !important;
    opacity: 1 !important;
    cursor: default !important;
}

/* Tactile active / pressed state for btn-refresh and all .button-row buttons */
.header .button-row vscode-button:active::part(base),
.button-row vscode-button:active::part(base),
.header .button-row vscode-button:active::part(control),
.button-row vscode-button:active::part(control),
.header .button-row button:active,
.button-row button:active,
#btn-refresh:active::part(base),
#btn-refresh:active,
#btn-refresh-session:active::part(base),
#btn-refresh-readiness:active {
    background-color: var(--vscode-button-hoverBackground) !important;
    color: var(--vscode-button-foreground) !important;
    transform: scale(0.96);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.35) !important;
}

/* Distinct glowing active state during refresh execution */
#btn-refresh.active::part(base),
#btn-refresh.refreshing::part(base),
#btn-refresh.active,
#btn-refresh.refreshing {
    background-color: var(--vscode-button-background) !important;
    color: var(--vscode-button-foreground) !important;
    border-color: var(--vscode-focusBorder) !important;
    box-shadow: 0 0 6px var(--vscode-focusBorder) !important;
}

@keyframes spin-refresh-glyph {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.refreshing .codicon-refresh,
.spinning .codicon-refresh,
#btn-refresh.refreshing .nav-icon {
    display: inline-block;
    animation: spin-refresh-glyph 0.75s linear infinite;
}
`;

const JSON_CONFIG_SCRIPT = [
    `window.__TOKEN_ESTIMATORS__=${JSON.stringify(tokenEstimatorsData).replace(/</g, '\\u003c')};`,
    `window.__MODEL_PRICING__=${JSON.stringify(modelPricingData).replace(/</g, '\\u003c')};`,
    `window.__TOOL_NAMES__=${JSON.stringify(toolNamesData).replace(/</g, '\\u003c')};`,
    `window.__AUTOMATIC_TOOLS__=${JSON.stringify(automaticToolsData).replace(/</g, '\\u003c')};`,
    `window.__EXTENSION_POINT_BUTTONS__=[];`,
].join('');

function buildNavHeader(activeTab: string, sessionTitle?: string, sessionUrl?: string, initialGroup?: string): string {
    const tabs = [
        { id: 'details', href: '/details', label: 'Details' },
        { id: 'usage', href: '/usage', label: 'Usage Analysis' },
        { id: 'chart', href: '/chart', label: 'Token Chart' },
        { id: 'maturity', href: '/maturity', label: 'Fluency Score' },
        { id: 'fluency-level-viewer', href: '/fluency-level-viewer', label: 'Scoring Guide' },
        { id: 'environmental', href: '/environmental', label: 'Environmental' },
        { id: 'diagnostics', href: '/diagnostics', label: 'Diagnostics' },
        { id: 'recent-sessions', href: '/recent-sessions', label: 'Recent Sessions' },
    ];

    const tabHtml = tabs.map(t => {
        const cls = t.id === activeTab ? 'nav-tab active' : 'nav-tab';
        return `<a href="${t.href}" data-tab="${t.id}" class="${cls}">${t.label}</a>`;
    }).join('');

    const displaySessionTitle = sessionTitle ? (sessionTitle.length > 24 ? sessionTitle.slice(0, 24) + '…' : sessionTitle) : 'Sessions';
    const sessionDropdownHtml = `
    <div class="session-dropdown" id="session-dropdown-container">
        <button class="nav-tab session-tab ${activeTab === 'session' ? 'active' : ''}" id="btn-session-dropdown" type="button" title="${sessionTitle || 'Select a session'}">
            <span class="codicon codicon-history"></span>
            <span id="session-dropdown-label">${displaySessionTitle}</span>
            <span class="codicon codicon-chevron-down" style="font-size:10px; margin-left:2px;"></span>
        </button>
        <div class="session-dropdown-menu" id="session-dropdown-menu">
            <div class="session-dropdown-header">
                <input type="text" id="session-search-input" placeholder="🔍 Search recent sessions..." autocomplete="off" />
            </div>
            <div class="session-dropdown-list" id="session-dropdown-items">
                <div class="session-dropdown-loading">Loading recent sessions...</div>
            </div>
        </div>
    </div>`;

    // Row 2 Sub-header: groups for usage and diagnostics
    const usageGroups = [
        { id: 'usage', label: 'Usage', icon: 'graph' },
        { id: 'workspace', label: 'Workspace', icon: 'folder-opened' },
        { id: 'github', label: 'GitHub', icon: 'github' },
        { id: 'coaching', label: 'Coaching', icon: 'mortar-board' },
    ];
    const diagGroups = [
        { id: 'diagnostics', label: 'Diagnostics', icon: 'pulse' },
        { id: 'research', label: 'Research', icon: 'beaker' },
        { id: 'settings', label: 'Settings', icon: 'gear' },
    ];

    let showSubHeader = false;
    let subGroupTabsHtml = '';
    if (activeTab === 'usage' || activeTab === 'recent-sessions') {
        showSubHeader = true;
        const curGroup = initialGroup || (activeTab === 'recent-sessions' ? 'usage' : 'usage');
        subGroupTabsHtml = usageGroups.map(g => {
            const cls = g.id === curGroup ? 'sub-nav-tab active' : 'sub-nav-tab';
            return `<a href="#" class="${cls}" data-group="${g.id}"><span class="codicon codicon-${g.icon}"></span> ${g.label}</a>`;
        }).join('');
    } else if (activeTab === 'diagnostics') {
        showSubHeader = true;
        const curGroup = initialGroup || 'diagnostics';
        subGroupTabsHtml = diagGroups.map(g => {
            const cls = g.id === curGroup ? 'sub-nav-tab active' : 'sub-nav-tab';
            return `<a href="#" class="${cls}" data-group="${g.id}"><span class="codicon codicon-${g.icon}"></span> ${g.label}</a>`;
        }).join('');
    }

    return `
    <header id="app-header">
        <a href="/details" class="brand-title" data-tab="details">
            <span>AI Fluency</span>
            <span class="brand-badge">Web</span>
        </a>
        <nav class="nav-links">
            ${tabHtml}
            ${sessionDropdownHtml}
        </nav>
        <div class="nav-actions">
            <div class="width-presets" id="width-presets" title="Set content max-width">
                <button class="width-btn" data-width="original">Original</button>
                <button class="width-btn" data-width="70%">70%</button>
                <button class="width-btn" data-width="85%">85%</button>
                <button class="width-btn" data-width="100%">100%</button>
            </div>
            <button class="nav-btn" id="btn-global-refresh" title="Refresh session data">
                <span class="codicon codicon-refresh"></span> Refresh
            </button>
            <button class="nav-btn" id="btn-theme-toggle" title="Toggle Theme">
                <span class="codicon codicon-color-mode"></span>
            </button>
        </div>
    </header>
    <nav id="app-sub-header" style="${showSubHeader ? 'display:flex;' : 'display:none;'}">
        <div class="sub-nav-container" id="sub-nav-links">
            ${subGroupTabsHtml}
        </div>
    </nav>
    `;
}

// Shell Script: Permanent shell, Theme sync, Modal logic, and smooth SPA tab transitions
const SHELL_SCRIPT = `
(function() {
    // -------------------------------------------------------------
    // Theme Management
    // -------------------------------------------------------------
    const savedTheme = localStorage.getItem('fluency-theme') || 'auto';
    function applyThemeToDoc(doc, theme) {
        if (!doc) return;
        const root = doc.documentElement;
        const body = doc.body;
        if (theme === 'light') {
            root?.setAttribute('data-theme', 'light');
            root?.classList.remove('vscode-dark');
            root?.classList.add('vscode-light');
            if (body) {
                body.setAttribute('data-theme', 'light');
                body.setAttribute('data-vscode-theme-kind', 'vscode-light');
                body.classList.remove('vscode-dark');
                body.classList.add('vscode-light');
            }
        } else if (theme === 'dark') {
            root?.setAttribute('data-theme', 'dark');
            root?.classList.remove('vscode-light');
            root?.classList.add('vscode-dark');
            if (body) {
                body.setAttribute('data-theme', 'dark');
                body.setAttribute('data-vscode-theme-kind', 'vscode-dark');
                body.classList.remove('vscode-light');
                body.classList.add('vscode-dark');
            }
        } else {
            root?.removeAttribute('data-theme');
            root?.classList.remove('vscode-light', 'vscode-dark');
            const isDark = (typeof window.matchMedia === 'function') ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
            const kind = isDark ? 'vscode-dark' : 'vscode-light';
            if (body) {
                body.setAttribute('data-vscode-theme-kind', kind);
                body.classList.remove('vscode-light', 'vscode-dark');
                body.classList.add(kind);
            }
        }
    }

    function applyTheme(theme) {
        applyThemeToDoc(document, theme);
        document.querySelectorAll('.view-frame').forEach(frame => {
            try {
                applyThemeToDoc(frame.contentDocument, theme);
                frame.contentWindow?.postMessage({ type: 'fluency-theme', theme }, '*');
            } catch (e) {}
        });
    }
    applyTheme(savedTheme);

    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
        const current = localStorage.getItem('fluency-theme') || 'auto';
        const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
        localStorage.setItem('fluency-theme', next);
        applyTheme(next);
    });

    // -------------------------------------------------------------
    // Max-Width Viewport Resizer & Presets
    // -------------------------------------------------------------
    const viewportContainer = document.getElementById('viewport-container');
    const dragOverlay = document.getElementById('resize-drag-overlay');
    function setMaxWidth(widthStr) {
        if (!viewportContainer) return;
        let effectiveWidth = widthStr;
        if (widthStr === 'original') {
            effectiveWidth = '1400px';
        }
        viewportContainer.style.maxWidth = effectiveWidth;
        localStorage.setItem('fluency-max-width', widthStr);
        document.querySelectorAll('.width-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-width') === widthStr);
        });
    }
    const savedWidth = localStorage.getItem('fluency-max-width') || 'original';
    setMaxWidth(savedWidth);

    document.querySelectorAll('.width-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setMaxWidth(btn.getAttribute('data-width') || 'original');
        });
    });

    let isDragging = false;
    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        viewportContainer?.classList.add('resizing');
        if (dragOverlay) dragOverlay.style.display = 'block';
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }
    function onDragMove(e) {
        if (!isDragging) return;
        const windowWidth = window.innerWidth;
        const centerX = windowWidth / 2;
        const distFromCenter = Math.abs(e.clientX - centerX);
        const widthPct = Math.min(100, Math.max(40, Math.round((distFromCenter * 2 / windowWidth) * 100)));
        setMaxWidth(widthPct + '%');
    }
    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        viewportContainer?.classList.remove('resizing');
        if (dragOverlay) dragOverlay.style.display = 'none';
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    }
    document.getElementById('resize-handle-left')?.addEventListener('mousedown', startDrag);
    document.getElementById('resize-handle-right')?.addEventListener('mousedown', startDrag);

    // -------------------------------------------------------------
    // Session Dropdown & Search
    // -------------------------------------------------------------
    let cachedSessionsList = null;
    const sessionBtn = document.getElementById('btn-session-dropdown');
    const sessionMenu = document.getElementById('session-dropdown-menu');
    const sessionSearch = document.getElementById('session-search-input');
    const sessionListEl = document.getElementById('session-dropdown-items');

    function escapeHtmlText(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function setSessionButtonLabel(label) {
        const lbl = document.getElementById('session-dropdown-label');
        if (lbl) {
            lbl.textContent = label ? (label.length > 24 ? label.slice(0, 24) + '…' : label) : 'Sessions';
        }
        if (sessionBtn) {
            sessionBtn.title = label || 'Select a session';
        }
    }

    async function loadSessionDropdown() {
        if (!sessionListEl) return;
        if (!cachedSessionsList) {
            try {
                const res = await fetch('/api/sessions-list');
                cachedSessionsList = await res.json();
            } catch (e) {
                sessionListEl.innerHTML = '<div class="session-dropdown-empty">Failed to load sessions</div>';
                return;
            }
        }
        renderSessionDropdownItems(cachedSessionsList, sessionSearch?.value || '');
    }

    function renderSessionDropdownItems(sessions, filter) {
        if (!sessionListEl) return;
        const q = (filter || '').toLowerCase().trim();
        const filtered = (sessions || []).filter(s => {
            if (!q) return true;
            const t = (s.title || '').toLowerCase();
            const w = (s.workspace || '').toLowerCase();
            const wp = (s.workspacePath || '').toLowerCase();
            return t.includes(q) || w.includes(q) || wp.includes(q);
        });
        if (filtered.length === 0) {
            sessionListEl.innerHTML = '<div class="session-dropdown-empty">No matching sessions found</div>';
            return;
        }
        sessionListEl.innerHTML = filtered.slice(0, 60).map(s => {
            const timeStr = s.lastActivity ? new Date(s.lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const title = s.title || (s.workspace ? s.workspace + ' session' : 'Untitled session');
            const ws = s.workspace || 'Workspace';
            const wsPath = s.workspacePath || ws;
            const filePath = s.filePath || s.file || '';
            const fileParam = encodeURIComponent(filePath);
            return '<a href="/session?file=' + fileParam + '" class="session-item" data-file="' + escapeHtmlText(filePath) + '" data-title="' + escapeHtmlText(title) + '" data-workspace="' + escapeHtmlText(ws) + '">' +
                '<div class="session-item-title">' + escapeHtmlText(title) + '</div>' +
                '<div class="session-item-subtitle" title="' + escapeHtmlText(wsPath) + '"><span class="codicon codicon-folder" style="font-size:11px; flex-shrink:0;"></span> <span>' + escapeHtmlText(wsPath) + '</span></div>' +
                '<div class="session-item-meta">' +
                    '<span class="session-item-workspace">' + escapeHtmlText(ws) + '</span>' +
                    '<span class="session-item-turns">' + (s.interactions || 0) + ' turns</span>' +
                    '<span class="session-item-time">' + timeStr + '</span>' +
                '</div>' +
            '</a>';
        }).join('');
    }

    sessionBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sessionMenu?.classList.toggle('open');
        if (isOpen) {
            loadSessionDropdown();
            setTimeout(() => sessionSearch?.focus(), 50);
        }
    });

    sessionSearch?.addEventListener('input', () => {
        if (cachedSessionsList) renderSessionDropdownItems(cachedSessionsList, sessionSearch.value);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#session-dropdown-container')) {
            sessionMenu?.classList.remove('open');
        }
    });

    sessionListEl?.addEventListener('click', (e) => {
        const item = e.target.closest('.session-item');
        if (!item) return;
        e.preventDefault();
        const href = item.getAttribute('href');
        const title = item.getAttribute('data-title') || '';
        const ws = item.getAttribute('data-workspace') || '';
        sessionMenu?.classList.remove('open');
        if (href) {
            setSessionButtonLabel(title || ws || 'Session');
            switchToTab(href);
        }
    });

    // -------------------------------------------------------------
    // Global Refresh
    // -------------------------------------------------------------
    document.getElementById('btn-global-refresh')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-global-refresh');
        if (btn) btn.classList.add('refreshing');
        try {
            await fetch('/api/refresh', { method: 'POST' });
            cachedSessionsList = null;
            const activeFrame = document.querySelector('.view-frame.active');
            if (activeFrame && activeFrame.contentWindow) {
                activeFrame.contentWindow.location.reload();
            }
        } finally {
            if (btn) setTimeout(() => btn.classList.remove('refreshing'), 800);
        }
    });

    // -------------------------------------------------------------
    // Tool Call Inspection Modal
    // -------------------------------------------------------------
    async function showPrettyToolCall(turnNumber, toolCallIdx, sessionFile) {
        const modal = document.getElementById('toolcall-modal');
        const pre = document.getElementById('toolcall-json');
        const title = document.getElementById('toolcall-title');
        if (!modal || !pre) return;

        try {
            pre.textContent = 'Loading tool call inspection...';
            modal.classList.add('open');
            const res = await fetch('/api/tool-call?file=' + encodeURIComponent(sessionFile || '') + '&turn=' + turnNumber + '&call=' + toolCallIdx);
            const data = await res.json();
            if (title) title.textContent = 'Tool Call: Turn ' + turnNumber + ' (#' + toolCallIdx + ')';
            pre.textContent = JSON.stringify(data, null, 2);
        } catch (e) {
            pre.textContent = 'Failed to load tool call: ' + e;
        }
    }

    document.getElementById('toolcall-close')?.addEventListener('click', () => {
        document.getElementById('toolcall-modal')?.classList.remove('open');
    });

    // -------------------------------------------------------------
    // 3-Layer SPA Navigation (View, Group, Tab)
    // -------------------------------------------------------------
    const USAGE_GROUPS = [
        { id: 'usage', label: 'Usage', icon: 'graph', tabs: ['activity', 'sessions'], defaultTab: 'activity' },
        { id: 'workspace', label: 'Workspace', icon: 'folder-opened', tabs: ['tools', 'health', 'readiness', 'worktrees'], defaultTab: 'tools' },
        { id: 'github', label: 'GitHub', icon: 'github', tabs: ['repos', 'agent'], defaultTab: 'repos' },
        { id: 'coaching', label: 'Coaching', icon: 'mortar-board', tabs: ['insights', 'corrections'], defaultTab: 'insights' },
    ];
    const DIAG_GROUPS = [
        { id: 'diagnostics', label: 'Diagnostics', icon: 'pulse', tabs: ['report', 'sessions', 'cache', 'path-analyzer', 'share'], defaultTab: 'report' },
        { id: 'research', label: 'Research', icon: 'beaker', tabs: ['model-usage', 'tool-analysis', 'skill-usage', 'otel-delta', 'ttft'], defaultTab: 'model-usage' },
        { id: 'settings', label: 'Settings', icon: 'gear', tabs: ['display', 'backend', 'github', 'debug'], defaultTab: 'display' },
    ];

    function getGroupForTab(view, tab) {
        if (view === 'usage' || view === 'recent-sessions') {
            for (const g of USAGE_GROUPS) { if (g.tabs.includes(tab)) return g.id; }
            return 'usage';
        }
        if (view === 'diagnostics') {
            for (const g of DIAG_GROUPS) { if (g.tabs.includes(tab)) return g.id; }
            return 'diagnostics';
        }
        return null;
    }

    function updateSubHeader(view, activeGroup) {
        const subHeader = document.getElementById('app-sub-header');
        const subLinks = document.getElementById('sub-nav-links');
        if (!subHeader || !subLinks) return;

        let groups = null;
        if (view === 'usage' || view === 'recent-sessions') {
            groups = USAGE_GROUPS;
        } else if (view === 'diagnostics') {
            groups = DIAG_GROUPS;
        }

        if (!groups) {
            subHeader.style.display = 'none';
            subLinks.innerHTML = '';
            return;
        }

        subHeader.style.display = 'flex';
        const cur = activeGroup || groups[0].id;
        subLinks.innerHTML = groups.map(g => {
            const cls = g.id === cur ? 'sub-nav-tab active' : 'sub-nav-tab';
            return '<a href="#" class="' + cls + '" data-group="' + g.id + '">' +
                '<span class="codicon codicon-' + g.icon + '"></span> ' + g.label +
            '</a>';
        }).join('');
    }

    function getTabIdFromPath(path) {
        if (path.startsWith('/recent-sessions')) return 'recent-sessions';
        if (path.startsWith('/usage')) return 'usage';
        if (path.startsWith('/chart')) return 'chart';
        if (path.startsWith('/maturity')) return 'maturity';
        if (path.startsWith('/fluency-level-viewer')) return 'fluency-level-viewer';
        if (path.startsWith('/environmental')) return 'environmental';
        if (path.startsWith('/diagnostics')) return 'diagnostics';
        if (path.startsWith('/session')) return 'session';
        return 'details';
    }

    function switchToTab(targetUrl, replaceState, optGroup, optTab) {
        const urlObj = new URL(targetUrl, window.location.origin);
        const view = getTabIdFromPath(urlObj.pathname);
        let group = optGroup || urlObj.searchParams.get('group');
        let tab = optTab || urlObj.searchParams.get('tab');

        if (view === 'recent-sessions') {
            group = 'usage';
            tab = 'sessions';
        } else if (view === 'usage') {
            if (!group) group = tab ? getGroupForTab('usage', tab) : 'usage';
            if (!tab) tab = USAGE_GROUPS.find(g => g.id === group)?.defaultTab || 'activity';
        } else if (view === 'diagnostics') {
            if (!group) group = tab ? getGroupForTab('diagnostics', tab) : 'diagnostics';
            if (!tab) tab = DIAG_GROUPS.find(g => g.id === group)?.defaultTab || 'report';
        }

        // Construct canonical URL for browser history
        const newParams = new URLSearchParams(urlObj.search);
        if (group && (view === 'usage' || view === 'diagnostics')) {
            newParams.set('group', group);
        }
        if (tab && (view === 'usage' || view === 'diagnostics')) {
            newParams.set('tab', tab);
        }
        newParams.delete('embed');
        const paramStr = newParams.toString();
        const browserUrl = urlObj.pathname + (paramStr ? '?' + paramStr : '');

        localStorage.setItem('fluency-last-route', browserUrl);
        if (window.location.pathname + window.location.search !== browserUrl) {
            if (replaceState) {
                history.replaceState({ url: browserUrl, view, group, tab }, '', browserUrl);
            } else {
                history.pushState({ url: browserUrl, view, group, tab }, '', browserUrl);
            }
        }

        // Update Row 1 active tabs
        document.querySelectorAll('.nav-tab').forEach(el => {
            const elTab = el.getAttribute('data-tab');
            el.classList.toggle('active', elTab === view);
        });

        // Update Row 2 sub-header
        updateSubHeader(view, group);

        // Session button highlight
        if (sessionBtn) {
            sessionBtn.classList.toggle('active', view === 'session');
        }

        // Target iframe configuration
        const frameTabId = (view === 'recent-sessions') ? 'usage' : view;
        const embedParams = new URLSearchParams(newParams);
        embedParams.set('embed', '1');
        const embedPath = (view === 'recent-sessions') ? '/usage' : urlObj.pathname;
        const embedUrl = embedPath + '?' + embedParams.toString();

        const viewportInner = document.getElementById('viewport-inner');
        const progressBar = document.getElementById('view-progress');
        const allFrames = document.querySelectorAll('.view-frame');

        let frame = document.getElementById('view-' + frameTabId);
        if (frame && frameTabId === 'session') {
            const currentSrc = frame.getAttribute('src') || '';
            if (currentSrc !== embedUrl) {
                frame.src = embedUrl;
            }
        }

        if (frame && (frameTabId !== 'session' || frame.getAttribute('src') === embedUrl)) {
            allFrames.forEach(f => {
                if (f !== frame) {
                    f.classList.remove('active');
                    f.style.display = 'none';
                }
            });
            frame.style.display = 'block';
            void frame.offsetHeight;
            frame.classList.add('active');
            try { applyThemeToDoc(frame.contentDocument, localStorage.getItem('fluency-theme') || 'auto'); } catch (e) {}

            // Send switch messages to child iframe
            if (frame.contentWindow) {
                if (tab) frame.contentWindow.postMessage({ command: 'switchTab', tab }, '*');
                if (group) frame.contentWindow.postMessage({ type: 'fluency-set-group', group }, '*');
            }
        } else {
            if (progressBar) {
                progressBar.style.width = '40%';
                progressBar.style.opacity = '1';
            }
            if (!frame) {
                frame = document.createElement('iframe');
                frame.id = 'view-' + frameTabId;
                frame.className = 'view-frame';
                viewportInner?.appendChild(frame);
            }
            frame.src = embedUrl;
            frame.onload = function() {
                if (progressBar) {
                    progressBar.style.width = '100%';
                    setTimeout(() => {
                        progressBar.style.opacity = '0';
                        progressBar.style.width = '0%';
                    }, 200);
                }
                allFrames.forEach(f => {
                    if (f !== frame) {
                        f.classList.remove('active');
                        f.style.display = 'none';
                    }
                });
                frame.style.display = 'block';
                void frame.offsetHeight;
                frame.classList.add('active');
                try { applyThemeToDoc(frame.contentDocument, localStorage.getItem('fluency-theme') || 'auto'); } catch (e) {}
                if (frame.contentWindow) {
                    if (tab) frame.contentWindow.postMessage({ command: 'switchTab', tab }, '*');
                    if (group) frame.contentWindow.postMessage({ type: 'fluency-set-group', group }, '*');
                }
            };
        }
    }

    // Intercept Row 2 sub-header group clicks
    document.getElementById('app-sub-header')?.addEventListener('click', (e) => {
        const link = e.target.closest('.sub-nav-tab');
        if (!link) return;
        e.preventDefault();
        const groupId = link.getAttribute('data-group');
        if (!groupId) return;

        const currentView = getTabIdFromPath(window.location.pathname);
        let defaultTab = '';
        if (currentView === 'usage' || currentView === 'recent-sessions') {
            defaultTab = USAGE_GROUPS.find(g => g.id === groupId)?.defaultTab || 'activity';
        } else if (currentView === 'diagnostics') {
            defaultTab = DIAG_GROUPS.find(g => g.id === groupId)?.defaultTab || 'report';
        }

        const targetUrl = (currentView === 'recent-sessions' ? '/usage' : window.location.pathname);
        switchToTab(targetUrl, false, groupId, defaultTab);
    });

    // Intercept Row 1 navbar link clicks
    document.querySelector('.nav-links')?.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-tab');
        if (!link || link.id === 'btn-session-dropdown') return;
        const href = link.getAttribute('data-url') || link.getAttribute('href');
        if (href && !href.startsWith('#')) {
            e.preventDefault();
            switchToTab(href);
        }
    });

    document.querySelector('.brand-title')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchToTab('/details');
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        switchToTab(window.location.pathname + window.location.search, true);
    });

    // Listen for messages from child view frames
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'fluency-tab-activated' && data.tab) {
            const currentView = getTabIdFromPath(window.location.pathname);
            const group = getGroupForTab(currentView, data.tab);
            updateSubHeader(currentView, group);

            // Sync URL parameters without page reload
            const urlObj = new URL(window.location.href);
            if (group) urlObj.searchParams.set('group', group);
            urlObj.searchParams.set('tab', data.tab);
            const newUrl = urlObj.pathname + '?' + urlObj.searchParams.toString();
            history.replaceState({ url: newUrl, view: currentView, group, tab: data.tab }, '', newUrl);
            localStorage.setItem('fluency-last-route', newUrl);
        } else if (data.type === 'fluency-nav' && data.url) {
            switchToTab(data.url);
        } else if (data.type === 'fluency-open-session') {
            const fileName = data.file ? data.file.split(/[\\\\/]/).pop() : 'Session';
            setSessionButtonLabel(data.title || fileName);
            switchToTab(data.url);
        } else if (data.type === 'fluency-tool-call') {
            showPrettyToolCall(data.turnNumber, data.toolCallIdx, data.file);
        } else if (data.type === 'fluency-refresh') {
            document.getElementById('btn-global-refresh')?.click();
        }
    });

    // Automatic route restoration and initial routing on page load
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const queryView = urlParams.get('view') || urlParams.get('tab') || urlParams.get('page');

    if (currentPath === '/' && queryView) {
        const target = queryView.startsWith('/') ? queryView : '/' + queryView;
        switchToTab(target, true);
    } else if (currentPath === '/') {
        const lastRoute = localStorage.getItem('fluency-last-route');
        if (lastRoute && lastRoute !== '/' && lastRoute !== '/details') {
            switchToTab(lastRoute, true);
        } else {
            localStorage.setItem('fluency-last-route', '/details');
        }
    } else {
        localStorage.setItem('fluency-last-route', currentPath + window.location.search);
        const view = getTabIdFromPath(currentPath);
        const group = urlParams.get('group') || getGroupForTab(view, urlParams.get('tab') || '');
        updateSubHeader(view, group);
    }
})();
`;

// Embedded View Client Shim: bridges VS Code API calls to parent window and local APIs
const EMBED_SHIM_SCRIPT = `
(function() {
    // Apply theme from parent/storage immediately
    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.classList.remove('vscode-dark');
            document.documentElement.classList.add('vscode-light');
            document.body.setAttribute('data-theme', 'light');
            document.body.setAttribute('data-vscode-theme-kind', 'vscode-light');
            document.body.classList.remove('vscode-dark');
            document.body.classList.add('vscode-light');
        } else if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.classList.remove('vscode-light');
            document.documentElement.classList.add('vscode-dark');
            document.body.setAttribute('data-theme', 'dark');
            document.body.setAttribute('data-vscode-theme-kind', 'vscode-dark');
            document.body.classList.remove('vscode-light');
            document.body.classList.add('vscode-dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            const isDark = (typeof window.matchMedia === 'function') ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
            const kind = isDark ? 'vscode-dark' : 'vscode-light';
            document.body.setAttribute('data-vscode-theme-kind', kind);
            document.body.classList.remove('vscode-light', 'vscode-dark');
            document.body.classList.add(kind);
        }
    }

    let theme = 'auto';
    try { theme = localStorage.getItem('fluency-theme') || 'auto'; } catch (e) {}
    applyTheme(theme);

    // Listen to messages from parent window
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'fluency-theme' && data.theme) {
            applyTheme(data.theme);
        } else if (data.type === 'fluency-set-group' && data.group) {
            const groupBtn = document.querySelector('.group-tab[data-group="' + data.group + '"]');
            if (groupBtn && !groupBtn.classList.contains('active')) {
                groupBtn.click();
            }
        } else if ((data.command === 'switchTab' || data.type === 'fluency-switch-tab') && data.tab) {
            const tabBtn = document.querySelector('.tab-button[data-tab="' + data.tab + '"], .tab[data-tab="' + data.tab + '"]');
            if (tabBtn) tabBtn.click();
        }
    });

    // Transform top info-box into an unobtrusive hover-only info tip icon
    function setupTopInfoTip() {
        const topInfo = document.querySelector('.container > .info-box:first-of-type, .info-box:has(#about-info-toggle), .container > .header + .info-box');
        if (topInfo && !topInfo.classList.contains('top-info-tip-initialized')) {
            topInfo.classList.add('top-info-tip-initialized');
            topInfo.classList.add('top-info-tip');
            const titleEl = topInfo.querySelector('.info-box-title') || topInfo.querySelector('strong');
            const bodyEl = topInfo.querySelector('.info-box-body') || topInfo.querySelector('div:not(.info-box-title)');
            const titleText = titleEl ? (titleEl.textContent || '').replace(/[▸▾]/g, '').trim() : 'About';
            const bodyHtml = bodyEl ? bodyEl.innerHTML : topInfo.innerHTML;
            topInfo.innerHTML = '<span class="info-tip-icon" title="' + titleText.replace(/"/g, '&quot;') + '">ℹ️</span>' +
                '<div class="info-tip-popover">' +
                    '<div class="info-tip-title">' + titleText + '</div>' +
                    '<div class="info-tip-body">' + bodyHtml + '</div>' +
                '</div>';
        }
    }

    // Automatically ensure recent-sessions table is sorted by Last Active desc
    function ensureSessionsTableSorted() {
        const tableRoot = document.getElementById('data-table-root-recent-sessions');
        if (!tableRoot) return;
        const lastActiveTh = tableRoot.querySelector('th[data-column="lastActivity"]');
        if (!lastActiveTh) return;
        if (lastActiveTh.getAttribute('aria-sort') !== 'descending') {
            const sortBtn = tableRoot.querySelector('[data-table-sort="lastActivity"]');
            if (sortBtn) {
                sortBtn.click();
                if (lastActiveTh.getAttribute('aria-sort') === 'ascending') {
                    sortBtn.click();
                }
            }
        }
    }

    // Ensure each row in the recent-sessions table shows the folder path subtitle
    function ensureRecentSessionsSubtitles() {
        const tableRoot = document.getElementById('data-table-root-recent-sessions');
        if (!tableRoot) return;
        const initial = window.__INITIAL_USAGE__;
        if (!initial) return;
        const allSessions = [
            ...(initial.todaySessions || []),
            ...(initial.recentSessions?.last30 || []),
            ...(initial.recentSessions?.last7 || []),
            ...(initial.recentSessions?.currentMonth || [])
        ];
        const fileMap = new Map();
        for (const s of allSessions) {
            if (s && s.filePath && !fileMap.has(s.filePath)) {
                fileMap.set(s.filePath, s.workspacePath || s.workspace || '');
            }
        }
        const titleCells = tableRoot.querySelectorAll('td.session-col-title');
        titleCells.forEach(cell => {
            if (cell.querySelector('.session-subtitle')) return;
            const link = cell.querySelector('a.session-title-link');
            if (!link) return;
            const filePath = link.getAttribute('data-file');
            const sub = fileMap.get(filePath);
            if (sub) {
                const subEl = document.createElement('div');
                subEl.className = 'session-subtitle';
                subEl.title = sub;
                subEl.style.cssText = 'font-size:11px; color:var(--text-secondary, #8b949e); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:340px;';
                subEl.textContent = sub;
                cell.appendChild(subEl);
            }
        });
    }

    const sortObserver = new MutationObserver(() => {
        ensureSessionsTableSorted();
        ensureRecentSessionsSubtitles();
        setupTopInfoTip();
    });
    sortObserver.observe(document.body, { childList: true, subtree: true });

    // Initial group, tab, and info tip restoration from window globals
    window.addEventListener('DOMContentLoaded', () => {
        setupTopInfoTip();
        function tryRestoreTabs() {
            if (window.__INITIAL_GROUP__) {
                const groupBtn = document.querySelector('.group-tab[data-group="' + window.__INITIAL_GROUP__ + '"]');
                if (groupBtn && !groupBtn.classList.contains('active')) groupBtn.click();
            }
            if (window.__INITIAL_TAB__) {
                const tabBtn = document.querySelector('.tab-button[data-tab="' + window.__INITIAL_TAB__ + '"], .tab[data-tab="' + window.__INITIAL_TAB__ + '"]');
                if (tabBtn) tabBtn.click();
            }
        }
        tryRestoreTabs();
        setTimeout(tryRestoreTabs, 50);
        setTimeout(tryRestoreTabs, 150);
    });

    // Tactile active / refreshing animation on refresh button clicks
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-refresh, #btn-refresh-session, #btn-refresh-readiness');
        if (btn) {
            btn.classList.add('refreshing');
            setTimeout(() => btn.classList.remove('refreshing'), 1000);
        }
    });

    // Intercept internal link clicks to trigger parent SPA navigation
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        const href = a.getAttribute('href');
        if (href && (href.startsWith('/') || href.startsWith('http://localhost') || href.startsWith('http://127.0.0.1'))) {
            if (!a.getAttribute('target') && !href.startsWith('/session/raw') && !href.startsWith('/api/')) {
                e.preventDefault();
                window.parent.postMessage({ type: 'fluency-nav', url: href }, '*');
            }
        }
    });

    // Intercept leaf tab clicks to notify parent of 3-layer sync
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-button, .tab');
        if (btn) {
            const tab = btn.getAttribute('data-tab');
            if (tab) {
                window.parent.postMessage({ type: 'fluency-tab-activated', tab }, '*');
            }
        }
    });

    // In-browser acquireVsCodeApi shim routed to parent window
    window.acquireVsCodeApi = function() {
        return {
            getState: function() {
                try { return JSON.parse(localStorage.getItem('state:' + location.pathname)); } catch (e) { return undefined; }
            },
            setState: function(state) {
                try { localStorage.setItem('state:' + location.pathname, JSON.stringify(state)); } catch (e) {}
            },
            postMessage: function(msg) {
                if (!msg || !msg.command) return;
                switch (msg.command) {
                    case 'viewTabOpened':
                        window.parent.postMessage({ type: 'fluency-tab-activated', view: msg.view, tab: msg.tab }, '*');
                        break;
                    case 'showDetails': window.parent.postMessage({ type: 'fluency-nav', url: '/details' }, '*'); break;
                    case 'showUsageAnalysis': window.parent.postMessage({ type: 'fluency-nav', url: '/usage' }, '*'); break;
                    case 'showChart': window.parent.postMessage({ type: 'fluency-nav', url: '/chart' }, '*'); break;
                    case 'showDiagnostics': window.parent.postMessage({ type: 'fluency-nav', url: '/diagnostics' }, '*'); break;
                    case 'showMaturity':
                    case 'showDashboard': window.parent.postMessage({ type: 'fluency-nav', url: '/maturity' }, '*'); break;
                    case 'showFluencyLevelViewer': window.parent.postMessage({ type: 'fluency-level-viewer' }, '*'); break;
                    case 'showEnvironmental': window.parent.postMessage({ type: 'fluency-nav', url: '/environmental' }, '*'); break;

                    case 'openSessionFile': {
                        const file = msg.file;
                        if (!file) break;
                        const turnParam = msg.turnNumber ? '&turn=' + msg.turnNumber : '';
                        window.parent.postMessage({
                            type: 'fluency-open-session',
                            file: file,
                            turn: msg.turnNumber,
                            url: '/session?file=' + encodeURIComponent(file) + turnParam
                        }, '*');
                        break;
                    }

                    case 'refresh':
                    case 'refreshSession':
                        window.parent.postMessage({ type: 'fluency-refresh' }, '*');
                        break;

                    case 'copyText':
                    case 'copyReport':
                        if (msg.text) navigator.clipboard.writeText(msg.text);
                        break;

                    case 'openIssue':
                        window.open('https://github.com/rajbos/ai-engineering-fluency/issues/new', '_blank');
                        break;

                    case 'openMethodologySource':
                        if (msg.source) window.open(msg.source, '_blank');
                        break;

                    case 'revealPath':
                        if (msg.path) {
                            fetch('/api/reveal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: msg.path })
                            });
                        }
                        break;

                    case 'showToolCallPretty':
                        window.parent.postMessage({
                            type: 'fluency-tool-call',
                            turnNumber: msg.turnNumber,
                            toolCallIdx: msg.toolCallIdx,
                            file: window.__SESSION_FILE__
                        }, '*');
                        break;

                    case 'loadRecentSessions': {
                        const period = msg.period || 'last7';
                        fetch('/api/recent-sessions?period=' + encodeURIComponent(period))
                            .then(r => r.json())
                            .then(data => {
                                window.postMessage({ command: 'recentSessionsLoaded', period: data.period, sessions: data.sessions || [] }, '*');
                            })
                            .catch(() => {
                                window.postMessage({ command: 'recentSessionsLoaded', period: period, sessions: [] }, '*');
                            });
                        break;
                    }

                    case 'analyzeModelUsage': {
                        const editor = msg.editor || 'all';
                        const timeRange = msg.timeRange || 'all';
                        fetch('/api/analyze-model-usage?editor=' + encodeURIComponent(editor) + '&timeRange=' + encodeURIComponent(timeRange))
                            .then(r => {
                                if (!r.ok) throw new Error('HTTP ' + r.status);
                                return r.json();
                            })
                            .then(data => {
                                window.postMessage(data, '*');
                            })
                            .catch(err => {
                                console.error('Failed to analyze model usage:', err);
                                window.postMessage({
                                    command: 'modelUsageResult',
                                    editor: editor,
                                    timeRange: timeRange,
                                    fileCount: 0,
                                    filesWithUsage: 0,
                                    rows: [],
                                    totalCost: 0,
                                    supportsCache1h: false,
                                }, '*');
                            });
                        break;
                    }

                    case 'analyzeTtft': {
                        const granularity = msg.granularity || 'day';
                        const scanRange = msg.scanRange || '14d';
                        fetch('/api/analyze-ttft?granularity=' + encodeURIComponent(granularity) + '&scanRange=' + encodeURIComponent(scanRange))
                            .then(r => r.json())
                            .then(data => {
                                window.postMessage(data, '*');
                            })
                            .catch(() => {
                                window.postMessage({
                                    command: 'ttftResult',
                                    granularity: granularity,
                                    buckets: [],
                                    series: [],
                                    sampleCount: 0,
                                    fileCount: 0,
                                }, '*');
                            });
                        break;
                    }

                    case 'clearCache': {
                        fetch('/api/refresh', { method: 'POST' })
                            .then(() => {
                                window.postMessage({ command: 'cacheCleared' }, '*');
                            })
                            .catch(() => {
                                window.postMessage({ command: 'cacheCleared' }, '*');
                            });
                        break;
                    }

                    case 'openFormattedJsonlFile': {
                        if (msg.file) {
                            window.parent.postMessage({
                                type: 'fluency-open-session',
                                file: msg.file,
                                url: '/session?file=' + encodeURIComponent(msg.file)
                            }, '*');
                        }
                        break;
                    }

                    case 'openRawFile':
                        if (window.__SESSION_FILE__) {
                            window.open('/session/raw?file=' + encodeURIComponent(window.__SESSION_FILE__), '_blank');
                        }
                        break;
                }
            }
        };
    };
})();
`;

const MODAL_HTML = `
<div id="toolcall-modal" class="modal-backdrop">
    <div class="modal-card">
        <div class="modal-header">
            <span id="toolcall-title">Tool Call Inspection</span>
            <button id="toolcall-close" class="nav-btn">&times; Close</button>
        </div>
        <div class="modal-body">
            <pre id="toolcall-json"></pre>
        </div>
    </div>
</div>
`;

export function renderFullHtml(options: {
    title: string;
    activeTab: string;
    scriptFile: string;
    initialPayloadKey: string;
    initialPayloadData: object;
    sessionTitle?: string;
    sessionFile?: string;
    sessionUrl?: string;
    initialGroup?: string;
    initialTab?: string;
    afterBundleScript?: string;
    isEmbed?: boolean;
}): string {
    const locale = getSystemLocale();
    const payloadWithLocale = {
        ...options.initialPayloadData,
        localization: getWebviewLocalization(),
        language: locale,
    };
    const payloadJson = JSON.stringify(payloadWithLocale).replace(/</g, '\\u003c');
    const sessionFileVar = options.sessionFile ? `window.__SESSION_FILE__ = ${JSON.stringify(options.sessionFile)};` : '';

    if (options.isEmbed) {
        // Embedded View (Rendered inside view frame with top padding and distinct active styling)
        const isSessionTab = options.activeTab === 'session';
        return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.title}</title>
    <link rel="stylesheet" href="/static/codicons/codicon.css" />
    <style>
        ${VSCODE_DARK_VARS}
        ${VSCODE_LIGHT_VARS}
        ${VIEW_EMBED_STYLES}
        ${isSessionTab ? LOGVIEWER_ENHANCER_STYLES : ''}
    </style>
</head>
<body data-vscode-theme-kind="vscode-dark">
    <div id="root"></div>
    <script>
        ${EMBED_SHIM_SCRIPT}
        ${sessionFileVar}
        window.__INITIAL_GROUP__ = ${JSON.stringify(options.initialGroup || '')};
        window.__INITIAL_TAB__ = ${JSON.stringify(options.initialTab || '')};
        window.${options.initialPayloadKey} = ${payloadJson};
        ${JSON_CONFIG_SCRIPT}
    </script>
    <script src="/static/${options.scriptFile}"></script>
    ${isSessionTab ? `<script>${LOGVIEWER_ENHANCER_SCRIPT}</script>` : ''}
    ${options.afterBundleScript ? `<script>${options.afterBundleScript}</script>` : ''}
</body>
</html>`;
    }

    // Top-Level App Shell (Maintains permanent header & shell, handles smooth SPA navigation)
    let embedUrl = `/${options.activeTab}?embed=1`;
    if (options.activeTab === 'session' && options.sessionUrl) {
        embedUrl = options.sessionUrl + (options.sessionUrl.includes('?') ? '&embed=1' : '?embed=1');
    } else if (options.activeTab === 'recent-sessions') {
        embedUrl = `/usage?embed=1&group=usage&tab=sessions`;
    } else {
        const queryParts: string[] = ['embed=1'];
        if (options.initialGroup) queryParts.push('group=' + encodeURIComponent(options.initialGroup));
        if (options.initialTab) queryParts.push('tab=' + encodeURIComponent(options.initialTab));
        embedUrl = `/${options.activeTab}?` + queryParts.join('&');
    }

    const frameTabId = (options.activeTab === 'recent-sessions') ? 'usage' : options.activeTab;

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.title} — AI Engineering Fluency</title>
    <link rel="stylesheet" href="/static/codicons/codicon.css" />
    <style>
        ${VSCODE_DARK_VARS}
        ${VSCODE_LIGHT_VARS}
        ${NAV_AND_GLOBAL_STYLES}
    </style>
</head>
<body data-vscode-theme-kind="vscode-dark">
    ${buildNavHeader(options.activeTab, options.sessionTitle, options.sessionUrl, options.initialGroup)}
    <main id="app-viewport">
        <div id="resize-drag-overlay"></div>
        <div class="viewport-resizer-container" id="viewport-container">
            <div class="resize-handle resize-handle-left" id="resize-handle-left" title="Drag to adjust width">
                <div class="resize-handle-bar"></div>
            </div>
            <div class="viewport-inner" id="viewport-inner">
                <div class="view-loading-bar" id="view-progress"></div>
                <iframe id="view-${frameTabId}" class="view-frame active" src="${embedUrl}"></iframe>
            </div>
            <div class="resize-handle resize-handle-right" id="resize-handle-right" title="Drag to adjust width">
                <div class="resize-handle-bar"></div>
            </div>
        </div>
    </main>
    ${MODAL_HTML}
    <script>
        ${SHELL_SCRIPT}
        window.${options.initialPayloadKey} = ${payloadJson};
    </script>
</body>
</html>`;
}
