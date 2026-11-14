// A reviewed, exact-event exception for SENT history only. This never changes
// provider records, their unresolved flags, or ordinary active-inventory holds.
const { createHash } = require('node:crypto');
const POLICY = require('../automation/media-policy.json');
function canonical(raw) {
  // Published article paths are literal ASCII slugs. Hold encoded path aliases
  // rather than guessing how a CDN decodes them; UTM query values are unaffected.
  try { const u = new URL(raw); return u.protocol === 'https:' && u.hostname === 'creditunionainews.com' && !u.username && !u.password && !u.port && !u.pathname.includes('%') ? u.origin + u.pathname : null; } catch { return null; }
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const idDigest = records => sha256(JSON.stringify(records.map(p => p.id).sort()));

// Proof scope follows the underlying story as well as its reservation ID. A
// renamed reservation, tracked URL or syndicated angle cannot shed the gate.
function requiresEventProof(item, proofs = POLICY.distribution.reviewedEventExclusions || []) {
  const url = canonical(item.articleUrl);
  return proofs.some(p => p.candidateId === item.id || (url && url === canonical(p.canonicalUrl)) ||
    (p.eventId && p.eventId === item.eventId) || (p.parentPublicationId && p.parentPublicationId === item.parentPublicationId));
}

function excludeHistoricalSent({ inventory, item, queue, commitSha, articleHtml,
  proofs = POLICY.distribution.reviewedEventExclusions || [], now = Date.now() }) {
  const fail = error => ({ error });
  const proof = proofs.find(p => p.candidateId === item.id);
  if (!proof) return fail('buffer_reservation_inventory_requires_review');
  // Dates below are an independently reviewed inference from specific primary
  // evidence, not an automatic age exemption or a claim to resolve shortlinks.
  const floor = Date.parse(proof.reviewedEventBoundary);
  const cutoff = Date.parse(proof.history?.latestSentAt);
  const reviewed = Date.parse(proof.reviewedAt), expires = Date.parse(proof.expiresAt);
  if (proof.status !== 'reviewed-new-event' || !Number.isFinite(floor) || !Number.isFinite(cutoff) || floor <= cutoff ||
      !Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || now > expires ||
      expires - reviewed > 4 * 86400000 || !proof.eventId || !proof.parentPublicationId ||
      !Array.isArray(proof.sourceUrls) || proof.sourceUrls.length < 2 ||
      !/^[a-f0-9]{64}$/.test(proof.articleSha256 || '')) return fail('historical_exclusion_proof_invalid');
  const expectedUrl = new URL(proof.canonicalUrl);
  expectedUrl.search = new URLSearchParams({utm_source:'linkedin',utm_medium:'organic_social',utm_campaign:'cuai_news',utm_content:proof.candidateId}).toString();
  if (item.contentKind !== 'article' || item.parentPublicationId !== proof.parentPublicationId ||
      item.eventId !== proof.eventId || item.articleUrl !== proof.canonicalUrl ||
      item.distributionUrl !== expectedUrl.toString() || item.copy !== proof.copyLead + ' ' + item.distributionUrl ||
      typeof articleHtml !== 'string' || sha256(articleHtml) !== proof.articleSha256)
    return fail('historical_exclusion_candidate_mismatch');
  if (queue.some(p => p.id !== item.id && (p.eventId === proof.eventId || p.parentPublicationId === proof.parentPublicationId ||
      canonical(p.articleUrl) === proof.canonicalUrl))) return fail('linkedin_publication_duplicate');
  const started = Date.parse(inventory?.startedAt), observed = Date.parse(inventory?.observedAt);
  if (!inventory?.complete || inventory.error || inventory.channelQueuePaused !== false ||
      inventory.channelId !== POLICY.distribution.channelId || inventory.commitSha !== commitSha ||
      !/^[a-f0-9]{40}$/.test(commitSha || '') || !Number.isFinite(started) || !Number.isFinite(observed) ||
      started > observed || observed > now || now - started > 60000 ||
      !Array.isArray(inventory.records) || inventory.recordCount !== inventory.records.length)
    return fail('historical_exclusion_inventory_invalid');
  const rows = inventory.records;
  // First recovery is deliberately restricted to the exact retained all-SENT
  // snapshot. Any active/new/disappeared record requires owner reconciliation.
  if (rows.length !== proof.history.recordCount || new Set(rows.map(p => p.id)).size !== rows.length ||
      rows.some(p => typeof p.id !== 'string' || p.channelId !== inventory.channelId || p.status !== 'sent' ||
        !Number.isFinite(Date.parse(p.sentAt)) || Date.parse(p.sentAt) > cutoff ||
        !Array.isArray(p.canonicalUrls) || typeof p.requiresReview !== 'boolean') ||
      idDigest(rows) !== proof.history.idSetSha256 || Math.max(...rows.map(p => Date.parse(p.sentAt))) !== cutoff)
    return fail('historical_exclusion_snapshot_changed');
  if (rows.some(p => p.canonicalUrls.includes(proof.canonicalUrl))) return fail('linkedin_provider_destination_duplicate');
  return { ok:true, historicalExclusion:proof.eventId, historicalFlagsPreserved:true };
}
module.exports = { excludeHistoricalSent, requiresEventProof, canonical, idDigest, sha256 };
