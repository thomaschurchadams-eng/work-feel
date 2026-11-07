import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Reviewed, live-verified main before these guards. Changing the anchor is a
// separately reviewed migration, never a fallback to HEAD or an absent ref.
const acceptedBaseline = 'aa43cf2782628289bd927c480799ba15b45af4be';
const statePath = 'automation/daily-cycle-state.json';
const validator = fileURLToPath(new URL('./validate-daily-cycle-preservation.mjs', import.meta.url));
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
function fail(message) { console.error(`daily-cycle chain validation failed: ${message}`); process.exit(1); }
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ancestor = (base, head) => { try { git('merge-base', '--is-ancestor', base, head); return true; } catch { return false; } };
const eventName = process.env.GITHUB_EVENT_NAME;
if (!['push', 'schedule', 'workflow_dispatch'].includes(eventName)) fail('unsupported or missing event');
let head;
try { head = git('rev-parse', 'HEAD'); } catch { fail('checked-out revision unavailable'); }
if (!sha(head) || !ancestor(acceptedBaseline, head)) fail('reviewed baseline is unavailable or is not an ancestor');
const before = process.env.CUAI_PUSH_BEFORE;
if (eventName === 'push' && (!sha(before) || !ancestor(acceptedBaseline, before) || !ancestor(before, head))) fail('valid pre-push main boundary unavailable');
const check = (base, candidate) => {
  const result = spawnSync(process.execPath, [validator, statePath, base, candidate], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${base} -> ${candidate}: ${result.stderr || result.error || 'validation failed'}`);
};
// Checking every first-parent state revision from the accepted baseline prevents
// an unrelated later push/manual/scheduled run from laundering earlier loss.
let changes;
try { changes = git('rev-list', '--first-parent', '--reverse', `${acceptedBaseline}..${head}`, '--', statePath).split('\n').filter(Boolean); }
catch { fail('state transition history unavailable'); }
let previous = acceptedBaseline;
for (const revision of changes) { check(previous, revision); previous = revision; }
check(previous, head);
if (eventName === 'push') check(before, head);
console.log(`daily-cycle chain passed: ${changes.length} state transitions since reviewed baseline; event=${eventName}`);
