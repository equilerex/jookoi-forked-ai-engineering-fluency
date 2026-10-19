/**
 * Browser side of the path links. Local file and folder paths in embedded page text become links.
 * A click asks the server to open the file, or reveal it in its folder, per the top-bar setting.
 *
 * Matching runs over the text of a whole block (a paragraph, list item or table cell), not over each
 * DOM text node. Renderers split one line into several nodes (emphasis, code, highlight spans), and a
 * path split that way would otherwise lose its tail.
 *
 * Matches are not trusted as written. Each one yields candidates, longest first (`C:\dir\my file.md`,
 * then `C:\dir\my`, then `C:\dir\`). The server reports which exist, and the match keeps the longest
 * one that does. Relative paths (`_architecture/plans/x.md`) resolve against the session's project.
 *
 * `installPathLinks` is serialised with `toString()` and runs inside each embedded page, so it must
 * stay self-contained: no imports and no references to module-level values.
 */

export const PATH_LINK_MODE_STORAGE_KEY = 'fluency-path-open-mode';

export const PATH_LINK_STYLES = `
a.path-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline dotted;
    cursor: pointer;
    word-break: break-all;
}
a.path-link:hover {
    text-decoration-style: solid;
}
a.path-link.path-link-pending {
    color: inherit;
    text-decoration: none;
    cursor: text;
}
a.path-link.path-link-failed {
    color: var(--vscode-errorForeground, #f48771);
    text-decoration: underline wavy;
}
`;

function installPathLinks(modeStorageKey: string): void {
    if (!document.body) { return; }

    // Windows drive paths with `\` or `/` separators; the last segment may have no extension and may be empty.
    const WINDOWS_PATH = /(?<![A-Za-z0-9])[A-Za-z]:[\\\/](?:[^\\\/:*?"<>|\r\n\t]+[\\\/])*[^\\\/:*?"<>|\r\n\t]*/;
    // Home-style POSIX paths. Spaces are allowed; candidates below cut trailing words back off.
    const POSIX_PATH = /(?<![\w.~:\/-])(?:~|\/(?:Users|home|Volumes|private|tmp|var|opt|mnt|root|srv))(?:\/[^\/\\"'`<>|:*?\r\n\t]+)+/;
    // Project-relative paths: at least one `/`, no spaces, optional trailing `/` for a folder.
    const RELATIVE_PATH = /(?<![\w.\/\\:~@+-])(?:[A-Za-z0-9_.@+-]+\/)+[A-Za-z0-9_.@+-]*/;
    const PATH_PATTERN = new RegExp(WINDOWS_PATH.source + '|' + POSIX_PATH.source + '|' + RELATIVE_PATH.source, 'g');
    const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;
    const MAX_CANDIDATES = 12;
    const MIN_CANDIDATE_LENGTH = 4;
    const SKIPPED_ANCESTORS = 'a, script, style, textarea, input, select, button, .path-skip';
    const BLOCK_SELECTOR = 'p, li, td, th, pre, div, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, summary, figcaption, section, article, tr';
    const OBSERVER_OPTIONS = { childList: true, subtree: true };

    interface PathGroup {
        /** The match as written, including trailing punctuation. */
        text: string;
        /** Longest first. Each candidate is a prefix of `text`. */
        candidates: string[];
        /** One anchor per text-node slice of the match, in document order. */
        pieces: HTMLAnchorElement[];
    }

    // Pending matches, keyed by group id, waiting for the server's answer.
    const groups = new Map<number, PathGroup>();
    let nextGroupId = 1;
    // Resolution per candidate for this page: an absolute path, or null when nothing exists.
    const resolutions = new Map<string, string | null>();
    const requestedCandidates = new Set<string>();

    // A session page knows the folder it ran in, so its relative paths resolve there first.
    const sessionBases: string[] = (() => {
        const logData = (window as unknown as { __INITIAL_LOGDATA__?: { workspacePath?: unknown } }).__INITIAL_LOGDATA__;
        return typeof logData?.workspacePath === 'string' ? [logData.workspacePath] : [];
    })();

    function candidatesFor(matchedText: string): string[] {
        const full = matchedText.replace(TRAILING_PUNCTUATION, '');
        const candidates = [full];
        for (let index = full.length - 1; index > 0 && candidates.length < MAX_CANDIDATES; index--) {
            const character = full.charAt(index);
            if (character !== ' ' && character !== '/' && character !== '\\') { continue; }
            const prefix = (character === ' ' ? full.slice(0, index) : full.slice(0, index + 1))
                .replace(TRAILING_PUNCTUATION, '')
                .replace(/ +$/, '');
            if (prefix.length >= MIN_CANDIDATE_LENGTH && candidates.indexOf(prefix) < 0) { candidates.push(prefix); }
        }
        return candidates;
    }

    // Every DOM change this script makes goes through here, so the observer never sees its own work.
    // Calls can nest, so the observer restarts only when the outermost one finishes.
    let suspendDepth = 0;
    function withoutObserving(change: () => void): void {
        if (suspendDepth === 0) { observer.disconnect(); }
        suspendDepth += 1;
        try {
            change();
        } finally {
            suspendDepth -= 1;
            if (suspendDepth === 0) { observer.observe(document.body, OBSERVER_OPTIONS); }
        }
    }

    function blockOf(textNode: Text): Element {
        return textNode.parentElement?.closest(BLOCK_SELECTOR) ?? document.body;
    }

    /** Finds matches across one block's text nodes and replaces each affected node with pieces. */
    function linkifyRun(textNodes: Text[]): void {
        const offsets: number[] = [];
        let joined = '';
        for (const textNode of textNodes) {
            offsets.push(joined.length);
            joined += textNode.nodeValue ?? '';
        }
        if (!/[\\\/~]/.test(joined)) { return; }

        const segments: Array<{ start: number; end: number; groupId: number }> = [];
        PATH_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = PATH_PATTERN.exec(joined)) !== null) {
            const matchedText = match[0];
            const candidates = candidatesFor(matchedText);
            if (candidates[0].length < MIN_CANDIDATE_LENGTH) { continue; }
            const groupId = nextGroupId++;
            groups.set(groupId, { text: matchedText, candidates, pieces: [] });
            segments.push({ start: match.index, end: match.index + matchedText.length, groupId });
        }
        if (segments.length === 0) { return; }

        withoutObserving(() => {
            textNodes.forEach((textNode, index) => {
                const nodeStart = offsets[index];
                const nodeText = textNode.nodeValue ?? '';
                const nodeEnd = nodeStart + nodeText.length;
                const overlapping = segments.filter(segment => segment.start < nodeEnd && segment.end > nodeStart);
                if (overlapping.length === 0) { return; }

                const fragment = document.createDocumentFragment();
                let cursor = 0;
                for (const segment of overlapping) {
                    const from = Math.max(segment.start, nodeStart) - nodeStart;
                    const to = Math.min(segment.end, nodeEnd) - nodeStart;
                    if (from > cursor) { fragment.appendChild(document.createTextNode(nodeText.slice(cursor, from))); }
                    const piece = document.createElement('a');
                    piece.className = 'path-link path-link-pending';
                    piece.href = '#';
                    piece.dataset.group = String(segment.groupId);
                    piece.dataset.offset = String(Math.max(segment.start, nodeStart) - segment.start);
                    piece.textContent = nodeText.slice(from, to);
                    fragment.appendChild(piece);
                    groups.get(segment.groupId)?.pieces.push(piece);
                    cursor = to;
                }
                if (cursor < nodeText.length) { fragment.appendChild(document.createTextNode(nodeText.slice(cursor))); }
                textNode.parentNode?.replaceChild(fragment, textNode);
            });
        });
    }

    function linkifyRoot(root: Node): void {
        const textNodes: Text[] = [];
        if (root.nodeType === Node.TEXT_NODE) {
            textNodes.push(root as Text);
        } else if (root instanceof Element) {
            if (root.closest(SKIPPED_ANCESTORS)) { return; }
            // Collect first: replacing text nodes while the walker runs would skip the next one.
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) { textNodes.push(walker.currentNode as Text); }
        } else {
            return;
        }

        const runs = new Map<Element, Text[]>();
        for (const textNode of textNodes) {
            if (textNode.parentElement?.closest(SKIPPED_ANCESTORS)) { continue; }
            const block = blockOf(textNode);
            const run = runs.get(block);
            if (run) { run.push(textNode); } else { runs.set(block, [textNode]); }
        }
        runs.forEach(run => linkifyRun(run));
    }

    async function requestResolutions(candidates: string[]): Promise<void> {
        for (let offset = 0; offset < candidates.length; offset += 200) {
            const chunk = candidates.slice(offset, offset + 200);
            try {
                const response = await fetch('/api/resolve-paths', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paths: chunk, bases: sessionBases }),
                });
                if (!response.ok) { throw new Error('HTTP ' + response.status); }
                const body: { resolved?: Record<string, string | null> } = await response.json();
                for (const candidate of chunk) {
                    resolutions.set(candidate, body.resolved?.[candidate] ?? null);
                }
            } catch {
                // Not cached: a later refresh asks again.
                for (const candidate of chunk) { requestedCandidates.delete(candidate); }
            }
        }
    }

    /** Turns pending matches into links once every candidate is answered, keeping the longest that exists. */
    function applyResolutions(): void {
        withoutObserving(() => {
            for (const [groupId, group] of Array.from(groups.entries())) {
                if (group.candidates.some(candidate => !resolutions.has(candidate))) { continue; }
                groups.delete(groupId);
                const chosen = group.candidates.find(candidate => resolutions.get(candidate));
                const absolutePath = chosen === undefined ? null : resolutions.get(chosen) ?? null;
                for (const piece of group.pieces) {
                    if (!piece.isConnected) { continue; }
                    const pieceText = piece.textContent ?? '';
                    const offset = Number(piece.dataset.offset ?? 0);
                    const keepLength = chosen === undefined || absolutePath === null
                        ? 0
                        : Math.max(0, Math.min(pieceText.length, chosen.length - offset));
                    if (keepLength === 0) {
                        piece.replaceWith(document.createTextNode(pieceText));
                        continue;
                    }
                    piece.dataset.path = absolutePath ?? '';
                    piece.title = absolutePath ?? '';
                    piece.classList.remove('path-link-pending');
                    if (keepLength < pieceText.length) {
                        piece.textContent = pieceText.slice(0, keepLength);
                        piece.after(document.createTextNode(pieceText.slice(keepLength)));
                    }
                }
            }
        });
    }

    async function refreshPendingGroups(): Promise<void> {
        const unknown = new Set<string>();
        groups.forEach(group => {
            for (const candidate of group.candidates) {
                if (!resolutions.has(candidate) && !requestedCandidates.has(candidate)) {
                    unknown.add(candidate);
                    requestedCandidates.add(candidate);
                }
            }
        });
        if (unknown.size > 0) { await requestResolutions([...unknown]); }
        applyResolutions();
    }

    async function openPathLink(link: HTMLAnchorElement): Promise<void> {
        let mode = 'file';
        try {
            if (localStorage.getItem(modeStorageKey) === 'folder') { mode = 'folder'; }
        } catch {
            // Storage blocked: fall back to opening the file.
        }
        link.classList.remove('path-link-failed');
        try {
            const response = await fetch('/api/open-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: link.dataset.path, mode: mode }),
            });
            const body: { error?: string; fallbackReason?: string } = await response.json().catch(() => ({}));
            if (!response.ok) { throw new Error(body.error || 'HTTP ' + response.status); }
            if (body.fallbackReason) {
                link.title = (link.dataset.path ?? '') + '\nExecutables are not opened. The containing folder was revealed instead.';
            }
        } catch (error) {
            link.classList.add('path-link-failed');
            link.title = 'Could not open: ' + (error instanceof Error ? error.message : String(error));
        }
    }

    // Mutations are batched per frame and linkified outside the observer, so the links this code
    // inserts never re-trigger it (the page froze on exactly that loop before).
    let pendingRoots: Node[] = [];
    let frameRequest = 0;
    const observer = new MutationObserver((records: MutationRecord[]) => {
        for (const record of records) {
            record.addedNodes.forEach(node => { pendingRoots.push(node); });
        }
        if (pendingRoots.length > 0 && frameRequest === 0) {
            frameRequest = requestAnimationFrame(flushPendingRoots);
        }
    });

    function flushPendingRoots(): void {
        frameRequest = 0;
        const roots = pendingRoots;
        pendingRoots = [];
        withoutObserving(() => {
            for (const root of roots) {
                if (root.isConnected) { linkifyRoot(root); }
            }
        });
        void refreshPendingGroups();
    }

    document.addEventListener('click', event => {
        const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a.path-link') : null;
        if (!link) { return; }
        event.preventDefault();
        // Capture phase: stopping here keeps the page's own click handlers from also reacting.
        event.stopPropagation();
        if (link.classList.contains('path-link-pending')) { return; }
        void openPathLink(link);
    }, true);

    withoutObserving(() => linkifyRoot(document.body));
    void refreshPendingGroups();
}

/** Script text for an embedded page. Runs after the page bundle so the content it links exists. */
export const PATH_LINKIFIER_SCRIPT = `(${installPathLinks.toString()})(${JSON.stringify(PATH_LINK_MODE_STORAGE_KEY)});`;
