const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { probeBrowser, launchOptions, cachePath } = require('../lib/browser-readiness.cjs');
const { selectRoutes, reviewRoutes } = require('../lib/design-review-routes.cjs');
const root = path.resolve(__dirname, '..');
const snapshot = () => ({ fingerprint: 'unchanged', entries: [], path: '/test/no-write' });
test('preflight fails closed on missing executable without installing, publishing or changing cache', async () => {
  let calls = 0;
  const result = await probeBrowser({ root, env: {}, snapshot, chromium: { launch: async options => { calls++; assert.equal(options.timeout, 15000); throw Error('Executable missing'); } } });
  assert.equal(calls, 1); assert.equal(result.status, 'blocked'); assert.equal(result.cacheChanged, false);
  assert.equal(result.scope, 'browser-launch-only-not-site-acceptance'); assert.deepEqual(result.viewports, []);
});
test('preflight requires actual mobile and desktop rendering and closes resources', async () => {
  const widths = []; let closed = 0;
  const chromium = { launch: async () => ({ version: () => '143.test', close: async () => { closed++; }, newContext: async ({ viewport }) => { widths.push(viewport.width); return { close: async () => { closed++; }, newPage: async () => ({ setContent: async () => {}, locator: () => ({ textContent: async () => 'Browser preflight' }) }) }; } }) };
  const result = await probeBrowser({ root, env: {}, snapshot, chromium });
  assert.equal(result.status, 'launched'); assert.deepEqual(widths, [390, 1440]); assert.equal(closed, 3);
  let n = 0;
  const raced = await probeBrowser({ root, env: {}, chromium, snapshot: () => ({ fingerprint: String(n++) }) });
  assert.equal(raced.status, 'blocked'); assert.equal(raced.failure.code, 'browser-cache-changed-during-preflight');
});
test('explicit compatible executable is opt-in; cache selection does not mutate global settings', () => {
  assert.deepEqual(launchOptions({}), { headless: true, timeout: 15000 });
  assert.equal(launchOptions({ CUAI_BROWSER_EXECUTABLE: '/existing/chrome' }).executablePath, '/existing/chrome');
  assert.equal(cachePath({ PLAYWRIGHT_BROWSERS_PATH: '/job/cache' }), '/job/cache');
});
test('exact changed News and Insight routes augment, never replace, the full baseline', () => {
  assert.deepEqual(selectRoutes({ baseline: ['/', '/news.html'], changed: ['news/ordinary-next.html', 'insight-ordinary-next.html', 'assets/app.js'], explicit: ['/news/ordinary-next.html'] }), ['/', '/news.html', '/news/ordinary-next.html', '/insight-ordinary-next.html']);
  assert.throws(() => selectRoutes({ baseline: [], explicit: ['https://external.test/'] }), /invalid-review/);
  assert.throws(() => selectRoutes({ baseline: [], explicit: ['../private.html'] }), /invalid-review/);
  assert.throws(() => reviewRoutes(root, ['/'], { CUAI_DESIGN_BASE_REF: 'missing-ref' }), /invalid-review-base-sha/);
});
test('existing isolated job keeps schedules, permissions and production ownership; normal command retains all regressions', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/cuai-operations.yml'), 'utf8');
  assert.ok(workflow.includes('PLAYWRIGHT_BROWSERS_PATH=${RUNNER_TEMP}/cuai-design-browsers'));
  assert.ok(workflow.includes('>> "$GITHUB_ENV"'));
  assert.ok(!workflow.includes('${{ runner.temp }}'), 'runner context is unavailable at job env evaluation');
  assert.match(workflow, /run: npm run check:browser/);
  assert.match(workflow, /CANONICAL_BASE_SHA=\$\(git rev-parse refs\/remotes\/origin\/main\)/);
  assert.match(workflow, /CUAI_DESIGN_BASE_REF=%s/);
  const verifier = fs.readFileSync(path.join(root, 'tests/design/verify-site.cjs'), 'utf8');
  for (const name of ['verify-card-artwork.cjs', 'verify-alerts.cjs', 'verify-analytics-journeys.cjs']) assert.ok(verifier.includes(name));
  const pkg = require('../package.json'); assert.equal(pkg.scripts['pretest:design'], 'npm run check:browser');
  assert.equal(pkg.devDependencies['playwright-core'], '1.57.0');
});

test('a concurrent main-only article is not mistaken for a deleted candidate route', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-route-base-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--initial-branch=main']);
  git(['config', 'user.name', 'CUAI Test']); git(['config', 'user.email', 'test@example.invalid']);
  fs.mkdirSync(path.join(dir, 'automation')); fs.mkdirSync(path.join(dir, 'news'));
  fs.writeFileSync(path.join(dir, 'automation/coverage-ledger.json'), '{"articles":[]}');
  git(['add', '.']); git(['commit', '-m', 'Base fixture']);
  git(['checkout', '-b', 'candidate']);
  fs.writeFileSync(path.join(dir, 'news/candidate.html'), '<h1>Candidate fixture</h1>');
  git(['add', '.']); git(['commit', '-m', 'Candidate fixture']);
  git(['checkout', 'main']);
  fs.mkdirSync(path.join(dir, 'news'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'news/main-only.html'), '<h1>Concurrent main fixture</h1>');
  git(['add', '.']); git(['commit', '-m', 'Concurrent fixture']);
  const base = git(['rev-parse', 'HEAD']); git(['checkout', 'candidate']);
  assert.deepEqual(reviewRoutes(dir, ['/'], { CUAI_DESIGN_BASE_REF: base }), ['/', '/news/candidate.html']);
});

test('publisher keeps qualification moving through the isolated fallback while release remains fail closed', () => {
  const policy = fs.readFileSync(path.join(root, 'automation/scheduled-tasks/publish-cuai-daily-article.md'), 'utf8');
  assert.match(policy, /does not by itself block read-only research, source qualification, candidate selection or preparation/);
  assert.match(policy, /Continue the ordinary cycle through read-only research and source qualification/);
  assert.match(policy, /Hold release until the exact candidate head passes the complete rendered job and capable visual review/);
  assert.match(policy, /Do not mark every article slot `pre-validation-blocked` solely because the local browser is absent while the CI fallback is available/);
  assert.match(policy, /never an uncleared private expansion, a dummy content change or an unqualified package created merely to exercise the fallback/);
});
