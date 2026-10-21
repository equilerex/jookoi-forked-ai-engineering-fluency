import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalPathError } from './localPathOpener';
import { getAllRecentSessionsList } from './statsService';

export const MAX_RESOLVE_CANDIDATES = 200;
export const MAX_RESOLVE_BASES = 40;

/** A directory with one of these is a project root: relative paths climb no higher than it. */
const PROJECT_MARKERS = ['.git', '_architecture', '_jookoi-architecture'];
const MAX_ANCESTOR_DEPTH = 12;
const WORKSPACE_CACHE_MS = 60_000;

let workspaceCache: { expiresAt: number; directories: string[] } | undefined;

export interface ResolvePathsRequest {
    paths: string[];
    bases: string[];
}

/** Reads `{ paths, bases? }` from a request body. */
export function parseResolvePathsRequest(body: string): ResolvePathsRequest {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body || '{}');
    } catch {
        throw new LocalPathError(400, 'Request body must be JSON');
    }
    const fields = (parsed ?? {}) as Record<string, unknown>;
    const paths = fields.paths;
    if (!Array.isArray(paths) || paths.length > MAX_RESOLVE_CANDIDATES
        || !paths.every(item => typeof item === 'string' && item.length > 0 && item.length <= 4096 && !item.includes('\0'))) {
        throw new LocalPathError(400, `paths must be up to ${MAX_RESOLVE_CANDIDATES} non-empty strings`);
    }
    const bases = fields.bases ?? [];
    if (!Array.isArray(bases) || bases.length > MAX_RESOLVE_BASES || !bases.every(item => typeof item === 'string')) {
        throw new LocalPathError(400, `bases must be up to ${MAX_RESOLVE_BASES} strings`);
    }
    return { paths: paths as string[], bases: bases as string[] };
}

function isDirectory(directory: string): boolean {
    try {
        return fs.statSync(directory).isDirectory();
    } catch {
        return false;
    }
}

/** Workspace folders of recent sessions. Relative links are resolved against these. */
async function knownWorkspaceDirectories(): Promise<string[]> {
    const now = Date.now();
    if (workspaceCache && workspaceCache.expiresAt > now) { return workspaceCache.directories; }
    let directories: string[] = [];
    try {
        const sessions = await getAllRecentSessionsList();
        directories = [...new Set(sessions
            .map(session => session.workspacePath)
            .filter((workspacePath): workspacePath is string => typeof workspacePath === 'string' && path.isAbsolute(workspacePath)))];
    } catch (err) {
        console.error('Could not list workspaces for path resolution:', err);
    }
    workspaceCache = { expiresAt: now + WORKSPACE_CACHE_MS, directories };
    return directories;
}

/** A base folder plus its ancestors, stopping at the first project root. */
function projectDirectories(base: string): string[] {
    const directories: string[] = [];
    let directory = path.resolve(base);
    for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth++) {
        directories.push(directory);
        if (PROJECT_MARKERS.some(marker => fs.existsSync(path.join(directory, marker)))) { break; }
        const parent = path.dirname(directory);
        if (parent === directory) { break; }
        directory = parent;
    }
    return directories;
}

function existingPath(candidatePath: string): string | null {
    try {
        fs.statSync(candidatePath);
        return path.normalize(candidatePath);
    } catch {
        return null;
    }
}

function isAbsoluteCandidate(candidate: string): boolean {
    return /^[A-Za-z]:[\\/]/.test(candidate) || candidate.startsWith('/') || candidate === '~' || candidate.startsWith('~/') || candidate.startsWith('~\\');
}

function resolveAbsoluteCandidate(candidate: string): string | null {
    const expanded = candidate === '~' || candidate.startsWith('~/') || candidate.startsWith('~\\')
        ? path.join(os.homedir(), candidate.slice(1))
        : candidate;
    // A quote or line break would break out of the quoted Windows argument later on.
    if (/["\r\n]/.test(expanded)) { return null; }
    return existingPath(expanded);
}

function resolveRelativeCandidate(candidate: string, bases: string[]): string | null {
    if (candidate.split(/[\\/]/).includes('..')) { return null; }
    for (const base of bases) {
        for (const directory of projectDirectories(base)) {
            const found = existingPath(path.join(directory, candidate));
            if (found) { return found; }
        }
    }
    return null;
}

/**
 * Maps each candidate to the absolute path it names, or null when nothing exists there. Absolute
 * candidates are checked as they are. Relative candidates are looked up under the request's bases
 * and the workspaces of recent sessions, each climbing to its project root.
 */
export async function resolveLocalPaths(candidates: string[], requestBases: string[]): Promise<Record<string, string | null>> {
    const requested = requestBases
        .map(base => path.resolve(base))
        .filter(isDirectory);
    const bases = [...new Set([...requested, ...(await knownWorkspaceDirectories()).filter(isDirectory)])].slice(0, MAX_RESOLVE_BASES);

    const resolved: Record<string, string | null> = {};
    for (const candidate of candidates) {
        resolved[candidate] = isAbsoluteCandidate(candidate)
            ? resolveAbsoluteCandidate(candidate)
            : resolveRelativeCandidate(candidate, bases);
    }
    return resolved;
}
