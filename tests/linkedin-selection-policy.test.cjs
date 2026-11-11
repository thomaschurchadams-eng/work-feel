const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

test('ordinary CI runs the established LinkedIn policy regression against the actual selector', () => {
  const result = spawnSync(process.execPath, [require.resolve('../scripts/test-linkedin-selection-policy.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /LinkedIn selection policy regression tests passed/);
  const workflow = fs.readFileSync(require.resolve('../.github/workflows/cuai-operations.yml'), 'utf8');
  for (const file of ['lib/media-slots.cjs', 'scripts/select-media-slot.cjs', 'scripts/test-linkedin-selection-policy.mjs']) assert.ok(workflow.includes("- '" + file + "'"), file + ' must trigger the existing PR checks');
});
