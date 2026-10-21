const http = require('http');
const { createServer, initStats, getSessionFiles } = require('./dist/server.js');

async function runTests() {
  console.log('Pre-warming cache...');
  await initStats();
  console.log('Cache pre-warmed.');

  const files = await getSessionFiles();
  console.log(`Found ${files.length} session files.`);

  const server = createServer();
  await new Promise(resolve => server.listen(3456, '127.0.0.1', resolve));
  console.log('Test server started on port 3456\n');

  const testFile = files[0] || 'dummy-session.jsonl';

  const routes = [
    { path: '/', expectedStatus: 200, checkBody: 'Details' },
    { path: '/details', expectedStatus: 200, checkBody: '__INITIAL_DETAILS__' },
    { path: '/usage', expectedStatus: 200, checkBody: '__INITIAL_USAGE__' },
    { path: '/chart', expectedStatus: 200, checkBody: '__INITIAL_CHART__' },
    { path: '/maturity', expectedStatus: 200, checkBody: '__INITIAL_MATURITY__' },
    { path: '/fluency-level-viewer', expectedStatus: 200, checkBody: '__INITIAL_FLUENCY_LEVEL_DATA__' },
    { path: '/environmental', expectedStatus: 200, checkBody: '__INITIAL_ENVIRONMENTAL__' },
    { path: '/diagnostics', expectedStatus: 200, checkBody: '__INITIAL_DIAGNOSTICS__' },
    { path: `/session?file=${encodeURIComponent(testFile)}`, expectedStatus: 200, checkBody: '__INITIAL_LOGDATA__' },
    { path: `/session?file=${encodeURIComponent(testFile)}&embed=1`, expectedStatus: 200, checkBody: 'jookoi-mdx-renderer' },
    { path: `/session/raw?file=${encodeURIComponent(testFile)}`, expectedStatus: 200 },
    { path: '/static/details.js', expectedStatus: 200 },
    { path: '/static/logviewer.js', expectedStatus: 200 },
    { path: '/static/codicons/codicon.css', expectedStatus: 200 },
    { path: '/api/recent-sessions?period=last7', expectedStatus: 200, checkBody: '"sessions":' },
    { path: '/api/recent-sessions?period=last30', expectedStatus: 200, checkBody: '"sessions":' },
    { path: '/details?embed=1', expectedStatus: 200, checkBody: '__INITIAL_DETAILS__' },
    { path: '/usage?embed=1', expectedStatus: 200, checkBody: '__INITIAL_USAGE__' },
    { path: '/chart?embed=1', expectedStatus: 200, checkBody: '/api/open-path' },
    { path: '/?view=usage', expectedStatus: 200, checkBody: '__INITIAL_USAGE__' },
    { path: '/?tab=chart', expectedStatus: 200, checkBody: '__INITIAL_CHART__' },
  ];

  let passed = 0;
  for (const r of routes) {
    const t0 = Date.now();
    const res = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:3456${r.path}`, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });

    const elapsed = Date.now() - t0;
    if (res.status !== r.expectedStatus) {
      console.error(`FAIL: ${r.path} returned status ${res.status}, expected ${r.expectedStatus}`);
    } else if (r.checkBody && !res.body.includes(r.checkBody)) {
      console.error(`FAIL: ${r.path} body did not contain expected text "${r.checkBody}"`);
    } else {
      console.log(`PASS: ${r.path.split('?')[0]} (${elapsed}ms)`);
      passed++;
    }
  }

  server.close();
  console.log(`\nTest results: ${passed}/${routes.length} passed.`);
  if (passed !== routes.length) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
