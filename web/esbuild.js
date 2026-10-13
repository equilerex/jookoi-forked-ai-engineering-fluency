const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const production = process.argv.includes('--production');
const watchMode = process.argv.includes('--watch');

// Webview bundles owned by the VS Code extension that the web app reuses.
const WEBVIEW_BUNDLES = [
  'details.js', 'environmental.js', 'chart.js', 'usage.js',
  'diagnostics.js', 'maturity.js', 'fluency-level-viewer.js', 'logviewer.js',
];

async function main() {
  const distDir = path.join(__dirname, 'dist');
  const webviewDir = path.join(distDir, 'webview');
  fs.mkdirSync(webviewDir, { recursive: true });

  const sharedNodeOptions = {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    minify: production,
    sourcemap: !production,
    alias: {
      vscode: path.join(__dirname, '..', 'cli', 'src', 'vscode-stub.ts'),
    },
    nodePaths: [
      path.join(__dirname, 'node_modules'),
      path.join(__dirname, '..', 'desktop', 'node_modules'),
      path.join(__dirname, '..', 'cli', 'node_modules'),
      path.join(__dirname, '..', 'vscode-extension', 'node_modules'),
    ],
    loader: { '.json': 'json' },
    banner: { js: 'var __importMetaUrl = require("url").pathToFileURL(__filename).href;' },
    define: { 'import.meta.url': '__importMetaUrl' },
    logLevel: 'info',
  };

  copyStaticAssets(distDir, webviewDir);

  if (!watchMode) {
    await esbuild.build({
      ...sharedNodeOptions,
      entryPoints: [path.join(__dirname, 'src', 'server.ts')],
      outfile: path.join(distDir, 'server.js'),
    });
    console.log(`Web app built (${production ? 'production' : 'development'})`);
    return;
  }

  // Watch mode
  let serverProcess = null;
  let restartTimer = null;

  function killServer() {
    if (!serverProcess) { return; }
    const proc = serverProcess;
    serverProcess = null;
    if (process.platform === 'win32' && proc.pid) {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      proc.kill();
    }
  }

  function scheduleRestart() {
    if (restartTimer) { clearTimeout(restartTimer); }
    restartTimer = setTimeout(() => {
      restartTimer = null;
      killServer();
      serverProcess = spawn(process.execPath, [path.join(distDir, 'server.js')], { stdio: 'inherit' });
      serverProcess.on('close', () => { serverProcess = null; });
    }, 300);
  }

  const rebuildPlugin = {
    name: 'restart-on-rebuild',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          scheduleRestart();
        } else {
          console.error('[watch] build errors — not restarting');
        }
      });
    },
  };

  const serverCtx = await esbuild.context({
    ...sharedNodeOptions,
    entryPoints: [path.join(__dirname, 'src', 'server.ts')],
    outfile: path.join(distDir, 'server.js'),
    plugins: [rebuildPlugin],
  });

  await serverCtx.watch();
  console.log('[watch] watching src/ for changes — Ctrl+C to stop');
  scheduleRestart();
}

function ensureWebviewBundles(extWebviewDir) {
  const missing = WEBVIEW_BUNDLES
    .map((b) => path.join(extWebviewDir, b))
    .filter((p) => !fs.existsSync(p));
  if (missing.length === 0) { return; }

  const extDir = path.join(__dirname, '..', 'vscode-extension');
  console.log(`Webview bundles missing (${missing.length}) — building vscode-extension first…`);
  const result = spawnSync(process.execPath, [path.join(extDir, 'esbuild.js')], {
    cwd: extDir,
    stdio: 'inherit',
  });

  const stillMissing = missing.filter((p) => !fs.existsSync(p));
  if (result.status !== 0 || stillMissing.length > 0) {
    throw new Error(
      'Failed to build the vscode-extension webview bundles automatically.\n' +
      'Build it manually first:\n' +
      '  cd ../vscode-extension && pnpm install && pnpm run compile\n' +
      (stillMissing.length ? `Still missing: ${stillMissing.join(', ')}` : ''),
    );
  }
}

function copyStaticAssets(distDir, webviewDir) {
  let extWebviewDir = path.join(__dirname, '..', 'vscode-extension', 'dist', 'webview');
  if (!fs.existsSync(extWebviewDir)) {
    const fallbackDir = path.resolve('D:/repos/Babylon-5/jookoi-forked-ai-engineering-fluency/vscode-extension/dist/webview');
    if (fs.existsSync(fallbackDir)) {
      extWebviewDir = fallbackDir;
    }
  }

  ensureWebviewBundles(extWebviewDir);
  for (const bundle of WEBVIEW_BUNDLES) {
    const srcBundle = path.join(extWebviewDir, bundle);
    if (fs.existsSync(srcBundle)) {
      fs.copyFileSync(srcBundle, path.join(webviewDir, bundle));
    }
  }
  console.log(`Synchronized ${WEBVIEW_BUNDLES.length} webview bundles`);

  let codiconsSrcDir = path.join(__dirname, '..', 'vscode-extension', 'node_modules', '@vscode', 'codicons', 'dist');
  if (!fs.existsSync(codiconsSrcDir)) {
    const fallbackCodicons = path.resolve('D:/repos/Babylon-5/jookoi-forked-ai-engineering-fluency/vscode-extension/node_modules/@vscode/codicons/dist');
    if (fs.existsSync(fallbackCodicons)) codiconsSrcDir = fallbackCodicons;
  }
  const codiconsDstDir = path.join(webviewDir, 'codicons');
  fs.mkdirSync(codiconsDstDir, { recursive: true });
  for (const file of ['codicon.css', 'codicon.ttf']) {
    const src = path.join(codiconsSrcDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(codiconsDstDir, file));
    }
  }
  console.log('Copied codicons');

  const wasmCandidates = [
    path.join(__dirname, '..', 'cli', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'desktop', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve('D:/repos/Babylon-5/jookoi-forked-ai-engineering-fluency/cli/node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve('D:/repos/Babylon-5/jookoi-forked-ai-engineering-fluency/desktop/dist/sql-wasm.wasm'),
  ];
  for (const wasmSrc of wasmCandidates) {
    if (fs.existsSync(wasmSrc)) {
      fs.copyFileSync(wasmSrc, path.join(distDir, 'sql-wasm.wasm'));
      console.log('Copied sql-wasm.wasm');
      break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
