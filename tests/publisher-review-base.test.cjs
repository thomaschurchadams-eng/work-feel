'use strict';
// Read-only CLI checks plus disposable local Git writes. Real immutable history;
// no remote calls, synthetic CI readers, publication or workflow dispatch.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), cli = path.join(root, 'scripts/validate-publisher-review.mjs');
const eventBase = '259d6a5c50f0dd97d90c8e052af9b5bd48920326';
const canonical = '3ce5c00aa433db78a5cfa239cf1f44cca69c7506';
const submitted = 'c47acd2b67c1dd0dd60f7f23c479af21faf6fee2';
const run = (args, cwd = root) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
function candidate(t, change) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-review-base-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('clone', '--quiet', '--shared', root, '.'); git('checkout', '--detach', canonical);
  git('config', 'user.name', 'Isolated review test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'no-hooks'));
  change(dir); git('add', '.'); git('commit', '-qm', 'isolated review proposal');
  return { dir, head: git('rev-parse', 'HEAD') };
}
test('actual stale PR311 event reproduces failure; explicit canonical base protects the reconciled source', () => {
  const stale = run([eventBase, submitted]);
  assert.equal(stale.status, 1); assert.match(stale.stderr, /article-pr-must-leave-canonical-state-unchanged/);
  const fresh = run([eventBase, submitted, canonical]);
  assert.equal(fresh.status, 0, fresh.stderr); assert.match(fresh.stdout, /82 history entries/);
  assert.deepEqual(JSON.parse(fresh.stdout.split('\n')[0]), { eventBase, canonicalBase: canonical, reviewHead: submitted });
});
test('fresh canonical mode still rejects unprepared new articles', t => {
  const f = candidate(t, dir => fs.writeFileSync(path.join(dir, 'news/isolated-unprepared.html'), '<h1>Isolated fixture</h1>'));
  const r = run([eventBase, f.head, canonical], f.dir);
  assert.equal(r.status, 1); assert.match(r.stderr, /article-lacks-canonical-owned-preparation/);
});
test('fresh canonical mode rejects lost history and a stale state overwrite', t => {
  const f = candidate(t, dir => {
    const old = execFileSync('git', ['show', `${eventBase}:automation/daily-cycle-state.json`], { cwd: root });
    fs.writeFileSync(path.join(dir, 'automation/daily-cycle-state.json'), old);
  });
  const r = run([eventBase, f.head, canonical], f.dir);
  assert.equal(r.status, 1); assert.match(r.stderr, /history|date|regress/i);
});
test('a canonical base behind or unrelated to the event base fails closed', () => {
  const r = run([canonical, submitted, eventBase]);
  assert.equal(r.status, 1); assert.match(r.stderr, /event-base-is-not-ancestor/);
});
test('fresh-base review rejects intermediate canonical history loss even after exact restoration', t => {
  const f = candidate(t, dir => {
    const file = path.join(dir, 'automation/daily-cycle-state.json'), original = fs.readFileSync(file);
    const damaged = JSON.parse(original); damaged.history.shift(); fs.writeFileSync(file, JSON.stringify(damaged));
    execFileSync('git', ['add', '.'], { cwd: dir }); execFileSync('git', ['commit', '-qm', 'isolated intermediate loss'], { cwd: dir });
    fs.writeFileSync(file, original);
  });
  const r = run([eventBase, submitted, f.head], f.dir);
  assert.equal(r.status, 1); assert.match(r.stderr, /fresh-canonical-history-invalid/);
  assert.match(r.stderr, /dropped|history/i);
});
test('missing and zero canonical revisions cannot fall back to the old event base', () => {
  for (const missing of ['f'.repeat(40), '0'.repeat(40)]) {
    const r = run([eventBase, submitted, missing]); assert.equal(r.status, 1);
    assert.match(r.stderr, /event-base-is-not-ancestor|explicit-review-and-base-shas-required/);
  }
});
