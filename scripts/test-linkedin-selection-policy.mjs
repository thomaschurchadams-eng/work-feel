import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy = await readFile(new URL('../automation/scheduled-tasks/publish-cuai-daily-article.md', import.meta.url), 'utf8');
const operatingPolicy = await readFile(new URL('../automation/scheduled-tasks/cuai-operating-system.md', import.meta.url), 'utf8');

function qualifiesForLinkedIn(candidate) {
  if (!candidate.liveAndValidated || candidate.duplicate || !candidate.cadenceAvailable) return false;
  if (candidate.classification === 'High') return candidate.clearPracticalImplication;
  if (candidate.classification !== 'Library') return false;
  return candidate.executiveRelevant && candidate.actionable && candidate.specificPromotionAngle;
}

const vendorExitPlaybook = {
  title: 'An AI Vendor Exit Playbook for Credit Unions',
  classification: 'Library',
  liveAndValidated: true,
  duplicate: false,
  cadenceAvailable: true,
  executiveRelevant: true,
  actionable: true,
  specificPromotionAngle: true
};

assert.equal(qualifiesForLinkedIn(vendorExitPlaybook), true, 'vendor exit playbook should qualify');
assert.equal(qualifiesForLinkedIn({ ...vendorExitPlaybook, actionable: false }), false, 'generic Library content should not qualify');
assert.equal(qualifiesForLinkedIn({ ...vendorExitPlaybook, duplicate: true }), false, 'duplicate safeguard should still block');
assert.equal(qualifiesForLinkedIn({ ...vendorExitPlaybook, cadenceAvailable: false }), false, 'cadence safeguard should still block');
assert.equal(qualifiesForLinkedIn({ ...vendorExitPlaybook, classification: 'Standard' }), false, 'Standard content should remain ineligible');

assert.match(policy, /Classification alone must never automatically include or exclude a Library Insight/);
assert.match(policy, /An AI Vendor Exit Playbook for Credit Unions.*qualifies/);
assert.match(policy, /duplicate, daily\/weekly cadence, fixed-time, queue, tracking, image, deployment, and Buffer safeguard/);
assert.match(operatingPolicy, /Classification alone must not exclude them/);

console.log('LinkedIn selection policy regression tests passed.');
