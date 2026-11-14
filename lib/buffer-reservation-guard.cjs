// Shared pre-mutation gate for both existing scheduling endpoints. This module
// only reads provider inventory; the existing authenticated executor owns writes.
const { readInventory } = require('./buffer-inventory.cjs');
const { validateSchedule, checkCapacity } = require('./media-slots.cjs');
const { excludeHistoricalSent, requiresEventProof, canonical } = require('./buffer-history-exclusion.cjs');

function queueConflict(item, queue) {
  const url = canonical(item.articleUrl);
  if (!url || queue.filter(i => i.id === item.id).length !== 1) return 'queue_reservation_invalid';
  // An adaptation cannot escape underlying-publication deduplication. Preserve
  // historical rows and their receipt identities rather than recycling them.
  if (queue.some(i => i.id !== item.id && i.platform === 'linkedin' &&
      (canonical(i.articleUrl) === url || (item.parentPublicationId && i.parentPublicationId === item.parentPublicationId)))) return 'linkedin_publication_duplicate';
  return null;
}

async function verifyReservation({ request, organizationId, channel, commitSha, item, queue, articleHtml }, now = Date.now) {
  const conflict = queueConflict(item, queue);
  if (conflict) return { error: conflict };
  const inventory = await readInventory(request, { organizationId, channel, commitSha }, now);
  if (!inventory.complete) return { error: 'buffer_reservation_inventory_incomplete' };
  if (inventory.records.some(p => p.canonicalUrls.includes(canonical(item.articleUrl)))) return { error: 'linkedin_provider_destination_duplicate' };
  // The candidate's proof is an unconditional authorization constraint. A clean
  // reader result does not waive its snapshot, active-record, expiry or body gate.
  if (requiresEventProof(item) || inventory.requiresReview) {
    const exclusion = excludeHistoricalSent({inventory,item,queue,commitSha,articleHtml,now:now()});
    if (exclusion.error) return exclusion;
  }
  // Recheck the lead time after pagination, immediately before the caller's
  // mutation. Successful enumeration does not freeze the provider's state.
  const schedule = validateSchedule(item.scheduledFor, item, undefined, now());
  if (schedule.error) return schedule;
  try {
    return checkCapacity(schedule.date, queue, inventory.records, item.postId || item.id);
  } catch { return { error: 'reservation_reconciliation_required' }; }
}

module.exports = { verifyReservation, queueConflict };
