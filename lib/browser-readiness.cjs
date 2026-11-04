const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function launchOptions(env = process.env) {
  return { headless: true, timeout: 15000, ...(env.CUAI_BROWSER_EXECUTABLE ? { executablePath: env.CUAI_BROWSER_EXECUTABLE } : {}) };
}
function cachePath(env = process.env) {
  if (env.PLAYWRIGHT_BROWSERS_PATH === '0') return path.resolve(require.resolve('playwright-core/package.json'), '../.local-browsers');
  if (env.PLAYWRIGHT_BROWSERS_PATH) return path.resolve(env.PLAYWRIGHT_BROWSERS_PATH);
  const systemCache = os.platform() === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches') : os.platform() === 'win32' ? env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local') : env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(systemCache, 'ms-playwright');
}
function cacheSnapshot(dir) {
  if (!fs.existsSync(dir)) return { path: dir, exists: false, entries: [], fingerprint: digest('absent') };
  const entries = fs.readdirSync(dir).sort().map(name => {
    const file = path.join(dir, name), stat = fs.lstatSync(file);
    const item = { name, modifiedMs: stat.mtimeMs, type: stat.isDirectory() ? 'directory' : 'file' };
    if (name === '.links' && stat.isDirectory()) item.links = fs.readdirSync(file).sort().map(link => ({ name: link, sha256: digest(fs.readFileSync(path.join(file, link))) }));
    return item;
  });
  return { path: dir, exists: true, entries, fingerprint: digest(JSON.stringify(entries)) };
}
function revision(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { commit: git(['rev-parse', 'HEAD']).trim(), trackedDiffSha256: digest(git(['diff', '--binary', 'HEAD'])), trackedClean: !git(['status', '--porcelain', '--untracked-files=no']).trim() };
}
async function probeBrowser({ chromium, root, env = process.env, snapshot = cacheSnapshot }) {
  const cache = cachePath(env), before = snapshot(cache);
  const result = { generatedAt: new Date().toISOString(), scope: 'browser-launch-only-not-site-acceptance', owner: 'daily-publisher', recoveryOwner: 'reliability-watch', worktree: root, ...revision(root), playwrightVersion: require('playwright-core/package.json').version, configuredExecutable: env.CUAI_BROWSER_EXECUTABLE || null, cacheBefore: before, status: 'blocked', viewports: [] };
  let browser;
  try {
    browser = await chromium.launch(launchOptions(env));
    result.browserVersion = browser.version();
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        await page.setContent('<!doctype html><html lang="en"><head><title>CUAI browser preflight</title></head><body><main><h1>Browser preflight</h1></main></body></html>');
        const text = await page.locator('h1').textContent();
        if (text !== 'Browser preflight') throw new Error('browser-smoke-content-mismatch');
        result.viewports.push({ width, rendered: true });
      } finally { await context.close(); }
    }
    result.status = 'launched';
  } catch (error) {
    result.failure = { code: 'browser-launch-or-smoke-failed', message: String(error.message).slice(0, 3000) };
  } finally {
    if (browser) await browser.close();
    result.cacheAfter = snapshot(cache);
    result.cacheChanged = before.fingerprint !== result.cacheAfter.fingerprint;
    if (result.cacheChanged) { result.status = 'blocked'; result.failure = { code: 'browser-cache-changed-during-preflight', message: 'Preserve evidence and resolve through the existing recovery owner; do not auto-install or clean the shared cache.' }; }
  }
  return result;
}
module.exports = { launchOptions, cachePath, cacheSnapshot, revision, probeBrowser };
