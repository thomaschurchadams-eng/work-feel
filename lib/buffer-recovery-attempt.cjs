// A one-attempt fence for the exact recovery reservation, using the existing
// main-push event and immutable before-tree. A crash/failed receipt write cannot
// turn a later sweep, unrelated push or workflow rerun into another submission.
const {canonical}=require('./buffer-history-exclusion.cjs');
async function firstRecoveryAttempt({item,proofs,eventName,runAttempt,before,after,head,readQueueBefore}) {
  const proof=proofs.find(p=>p.candidateId===item.id);
  if (!proof) return {ok:true};
  if (!proof.eventId || !proof.parentPublicationId || !canonical(proof.canonicalUrl) ||
      item.eventId!==proof.eventId || item.parentPublicationId!==proof.parentPublicationId || item.articleUrl!==proof.canonicalUrl)
    return {error:'recovery_attempt_candidate_mismatch'};
  if (eventName!=='push' || String(runAttempt)!=='1' || after!==head ||
      !/^[a-f0-9]{40}$/.test(before||'') || /^0+$/.test(before)) return {error:'recovery_attempt_requires_original_reservation_push'};
  try {
    const queue=await readQueueBefore(before);
    if (!Array.isArray(queue?.items) || queue.items.some(p=>!p || typeof p!=='object' || Array.isArray(p) ||
        typeof p.id!=='string' || !p.id.trim() || !canonical(p.articleUrl) ||
        ['eventId','parentPublicationId'].some(k=>k in p && (typeof p[k]!=='string' || !p[k].trim()))) ||
        new Set(queue.items.map(p=>p.id)).size!==queue.items.length) return {error:'recovery_attempt_prior_queue_unverified'};
    if (queue.items.some(p=>p.id===item.id || p.eventId===item.eventId || p.parentPublicationId===item.parentPublicationId || canonical(p.articleUrl)===item.articleUrl))
      return {error:'recovery_attempt_requires_reconciliation'};
    return {ok:true};
  } catch { return {error:'recovery_attempt_prior_queue_unverified'}; }
}
module.exports={firstRecoveryAttempt};
