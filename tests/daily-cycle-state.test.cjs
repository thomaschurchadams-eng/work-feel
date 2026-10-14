const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const statePath = 'automation/daily-cycle-state.json';

test('daily cycle state is complete parseable audit state', () => {
  const raw = fs.readFileSync(statePath, 'utf8');
  const state = JSON.parse(raw);

  assert.equal(state.version, 1);
  assert.equal(state.timezone, 'America/New_York');
  assert.match(state.current?.date || '', /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(state.current?.publications));
  assert.ok(Array.isArray(state.history));
  assert.ok(state.history.length > 0);

  const historyDates = state.history.map((entry) => entry?.date).filter(Boolean);
  assert.equal(new Set(historyDates).size, historyDates.length);
  assert.ok(!historyDates.includes(state.current.date));
});
