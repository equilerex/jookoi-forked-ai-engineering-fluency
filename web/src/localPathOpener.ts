import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

export type LocalPathOpenMode = 'file' | 'folder';

export class LocalPathError extends Error {
    constructor(readonly statusCode: number, message: string) {
        super(message);
    }
}

export interface OpenPathRequest {
    path: string;
    mode: LocalPathOpenMode;
}

export interface OpenPathResult {
    /** `opened`: the target itself was handed to the OS. `revealed`: its containing folder was opened with it selected. */
    action: 'opened' | 'revealed';
    /** Set when the requested action was replaced for safety; the value explains why. */
    fallbackReason?: 'executable';
}

export interface OpenCommand {
    command: string;
    args: string[];
    windowsVerbatimArguments: boolean;
}

/** Extensions the OS runs when opened. Opening one is replaced by revealing it in its folder. */
const EXECUTABLE_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.msi', '.msp', '.ps1', '.psm1',
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.reg', '.lnk', '.url', '.dll',
    '.jar', '.sh', '.command', '.app',
]);

const MAX_PATH_LENGTH = 4096;

/** Reads `{ path, mode }` from a request body. `fallbackMode` applies when the body omits `mode`. */
export function parseOpenPathRequest(body: string, fallbackMode: LocalPathOpenMode): OpenPathRequest {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body || '{}');
    } catch {
        throw new LocalPathError(400, 'Request body must be JSON');
    }
    const fields = (parsed ?? {}) as Record<string, unknown>;
    const rawPath = fields.path;
    if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > MAX_PATH_LENGTH || rawPath.includes('\0')) {
        throw new LocalPathError(400, 'path must be a non-empty string');
    }
    const mode = fields.mode ?? fallbackMode;
    if (mode !== 'file' && mode !== 'folder') {
        throw new LocalPathError(400, 'mode must be "file" or "folder"');
    }
    return { path: rawPath, mode };
}

function resolveAbsolutePath(rawPath: string): string {
    const expanded = rawPath === '~' || rawPath.startsWith('~/') || rawPath.startsWith('~\\')
        ? path.join(os.homedir(), rawPath.slice(1))
        : rawPath;
    const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(expanded);
    const isPosixAbsolute = expanded.startsWith('/');
    if (!isWindowsAbsolute && !isPosixAbsolute) {
        throw new LocalPathError(400, 'path must be absolute');
    }
    // Windows quotes the argument itself, so a quote or line break would break out of it.
    if (/["\r\n]/.test(expanded)) {
        throw new LocalPathError(400, 'path contains characters that cannot be passed to the OS');
    }
    return path.normalize(expanded);
}

/**
 * Builds the OS command for an action. Always an argument array run without a shell, so a path
 * is never parsed as shell syntax.
 */
export function buildOpenCommand(
    platform: NodeJS.Platform,
    targetPath: string,
    action: 'opened' | 'revealed',
): OpenCommand {
    if (platform === 'win32') {
        // explorer.exe returns non-zero even on success, so its exit code is never read.
        if (action === 'revealed') {
            return { command: 'explorer.exe', args: [`/select,"${targetPath}"`], windowsVerbatimArguments: true };
        }
        return { command: 'explorer.exe', args: [`"${targetPath}"`], windowsVerbatimArguments: true };
    }
    if (platform === 'darwin') {
        return action === 'revealed'
            ? { command: 'open', args: ['-R', targetPath], windowsVerbatimArguments: false }
            : { command: 'open', args: [targetPath], windowsVerbatimArguments: false };
    }
    if (platform === 'linux') {
        // xdg-open cannot select a file, so reveal opens its containing folder.
        const openTarget = action === 'revealed' ? path.dirname(targetPath) : targetPath;
        return { command: 'xdg-open', args: [openTarget], windowsVerbatimArguments: false };
    }
    throw new LocalPathError(501, `Opening local paths is not supported on ${platform}`);
}

function runDetached(command: OpenCommand): void {
    const child = spawn(command.command, command.args, {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: command.windowsVerbatimArguments,
    });
    child.on('error', error => console.error(`Could not run ${command.command}: ${error.message}`));
    child.unref();
}

/**
 * Opens a file or folder on this machine. Only absolute paths that exist are accepted. A file
 * requested with `mode: 'file'` that is an executable is revealed in its folder instead.
 */
export function openLocalPath(
    request: OpenPathRequest,
    run: (command: OpenCommand) => void = runDetached,
    platform: NodeJS.Platform = process.platform,
): OpenPathResult {
    const targetPath = resolveAbsolutePath(request.path);
    let isDirectory: boolean;
    try {
        isDirectory = fs.statSync(targetPath).isDirectory();
    } catch {
        throw new LocalPathError(404, 'path does not exist');
    }

    let action: 'opened' | 'revealed' = request.mode === 'file' || isDirectory ? 'opened' : 'revealed';
    let fallbackReason: OpenPathResult['fallbackReason'];
    if (action === 'opened' && !isDirectory && EXECUTABLE_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
        action = 'revealed';
        fallbackReason = 'executable';
    }

    run(buildOpenCommand(platform, targetPath, action));
    return { action, fallbackReason };
}
