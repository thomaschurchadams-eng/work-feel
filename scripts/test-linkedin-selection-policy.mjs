import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import slots from '../lib/media-slots.cjs';

const policy = await readFile(new URL('../automation/scheduled-tasks/publish-cuai-daily-article.md', import.meta.url), 'utf8');
const operatingPolicy = await readFile(new URL('../automation/scheduled-tasks/cuai-operating-system.md', import.meta.url), 'utf8');
const args = { date: '2026-11-12', now: Date.parse('2026-11-11T12:00:00Z'), queue: [] };
// Eligibility represents the publisher's actual practical-usefulness review.
// Exercise the production selector instead of maintaining a competing toy gate.
const library = { id: 'vendor-exit', title: 'An AI Vendor Exit Playbook for Credit Unions', classification: 'Library', eligible: true, canonicalUrl: 'https://creditunionainews.com/insight-vendor-exit.html' };
for (const classification of ['High', 'Standard', 'Library']) {
  const candidate = { ...library, classification };
  assert.equal(slots.selectSlot({ ...args, articles: [candidate] }).assetId, candidate.id);
  assert.equal(slots.selectSlot({ ...args, articles: [{ ...candidate, eligible: false }] }).status, 'no-qualified-selection');
  assert.equal(slots.selectSlot({ ...args, articles: [candidate], queue: [{ id: 'prior', platform: 'linkedin', status: 'sent', articleUrl: candidate.canonicalUrl, scheduledFor: '2026-11-10T11:30:00-05:00' }] }).status, 'no-qualified-selection');
  assert.equal(slots.selectSlot({ ...args, articles: [candidate], providerPosts: [{ id: 'provider-reservation', status: 'scheduled', dueAt: '2026-11-12T16:30:00Z' }] }).status, 'blocked');
}
const recoveredHigh = { ...library, id: 'missed-high', classification: 'High', canonicalUrl: 'https://creditunionainews.com/news/missed-high.html' };
const standard = { ...library, id: 'standard', classification: 'Standard', canonicalUrl: 'https://creditunionainews.com/news/standard.html' };
const articles = [recoveredHigh, standard, library];
assert.equal(slots.selectSlot({ ...args, articles }).status, 'needs-editorial-selection');
const editorialOrder = [
  { canonicalUrl: standard.canonicalUrl, rationale: 'The practical servicing decision is most useful now; no missing High handoff overrides that comparison.' },
  { canonicalUrl: library.canonicalUrl, rationale: 'Actionable executive tool, but the latest mix already covers vendor exits.' },
  { canonicalUrl: recoveredHigh.canonicalUrl, rationale: 'Still current and qualified, but lower priority in this complete pool.' }
];
const queue = [], before = JSON.stringify(queue);
assert.equal(slots.selectSlot({ ...args, queue, articles, editorialOrder }).assetId, 'standard');
assert.equal(JSON.stringify(queue), before, 'comparison must not reserve today or a runner-up later');
assert.deepEqual(slots.selectSlot({ ...args, articles, editorialOrder, queue: [{ id: 'immutable', platform: 'linkedin', status: 'planned', scheduledFor: '2026-11-12T11:30:00-05:00' }] }), { status: 'reserved', itemId: 'immutable' });

assert.match(policy, /Classification alone must not automatically include or exclude a High, Standard or Library story/);
assert.match(policy, /An AI Vendor Exit Playbook for Credit Unions.*qualifies/);
assert.match(policy, /executive or functional-leader decision/);
assert.match(policy, /concrete action, control, operating framework, or decision tool/);
assert.match(policy, /duplicate, daily\/weekly cadence, fixed-time, queue, tracking, image, deployment, and Buffer safeguard/);
const recovery = policy.split('### Recovery candidates from missed High handoffs')[1]?.split('## Analytics learning loop')[0];
assert.ok(recovery);
assert.match(recovery, /must not reserve or schedule a slot before the strongest-useful-mix comparison/);
assert.match(recovery, /same complete `editorialOrder`/);
assert.match(recovery, /Do not automatically reserve the runner-up/);
assert.doesNotMatch(recovery, /reserve the second qualifying item/);
assert.match(operatingPolicy, /Consider High and useful Standard articles/);
assert.match(operatingPolicy, /Classification alone must not exclude them/);
console.log('LinkedIn selection policy regression tests passed.');
