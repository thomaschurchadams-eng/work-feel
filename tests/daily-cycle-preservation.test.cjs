const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const validator = path.resolve(__dirname, '../scripts/validate-daily-cycle-preservation.mjs');
const node = process.execPath;

test('base-revision validator rejects valid JSON that drops 59 of 60 history entries', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-daily-preservation-'));
  const statePath = 'automation/daily-cycle-state.json';
  const run = (program, args) => spawnSync(program, args, { cwd: directory, encoding: 'utf8' });
  try {
    fs.mkdirSync(path.join(directory, 'automation'));
    const history = Array.from({ length: 60 }, (_, index) => ({ date: new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10), audit: index }));
    const base = { version: 1, timezone: 'America/New_York', current: { date: '2026-10-14', publications: [] }, history };
    fs.writeFileSync(path.join(directory, statePath), JSON.stringify(base));
    assert.equal(run('git', ['init', '-q']).status, 0);
    assert.equal(run('git', ['add', statePath]).status, 0);
    assert.equal(run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'baseline']).status, 0);

    const intact = run(node, [validator, statePath, 'HEAD']);
    assert.equal(intact.status, 0, intact.stderr);

    fs.writeFileSync(path.join(directory, statePath), JSON.stringify({ ...base, history: history.slice(0, 1) }));
    const candidate = JSON.parse(fs.readFileSync(path.join(directory, statePath), 'utf8'));
    assert.equal(candidate.history.length, 1);
    const rejected = run(node, [validator, statePath, 'HEAD']);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /history shrank from 60 entries to 1/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
