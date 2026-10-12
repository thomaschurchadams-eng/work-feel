'use strict';

// The owner supplies a durable exclusive lease and authoritative external reads.
// No production operation is performed by this module.
const TERMINAL = new Set(['completed', 'blocked-permission', 'blocked-ambiguous']);
function classify(error) {
  if (error?.code === 'PERMISSION_DENIED' || error?.status === 401 || error?.status === 403) return 'blocked-permission';
  if (error?.code === 'AMBIGUOUS_OUTCOME' || error?.mayHaveCommitted) return 'blocked-ambiguous';
  return 'retryable';
}
async function recover({ key, steps, load, save, acquire, isClosed, close, maxAttempts = 2 }) {
  if (!key || !Array.isArray(steps) || !steps.length || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 ||
      ![load, save, acquire, isClosed, close].every(fn => typeof fn === 'function')) throw Error('invalid_recovery_plan');
  const release = await acquire(key); // Must be atomic across every worker for this key.
  if (typeof release !== 'function') throw Error('invalid_recovery_lease');
  try {
    const state = await load(key) || { key, status: 'working', steps: {}, attempts: 0 };
    if (state.key !== key) throw Error('incident_key_mismatch');
    if (state.status === 'completed') {
      // A local checkpoint is not evidence that the issue-bus incident closed.
      // Never issue a second close from this path when the external read fails.
      const closed=await isClosed(key);
      if (closed !== true) throw Object.assign(Error('completed_checkpoint_unconfirmed'),{code:'AMBIGUOUS_OUTCOME'});
      return state;
    }
    if (TERMINAL.has(state.status)) return state;
    const call = async (fn, reason) => {
      try { return { ok:true, value:await fn() }; }
      catch (error) {
        state.status=classify(error); state.reason=`${reason}:${error.message}`;
        await save(state); return { ok:false };
      }
    };
    for (const step of steps) {
      if (!step.id || !step.reconcile || !step.verify || !step.run) throw Error('invalid_recovery_step');
      const checkpoint = state.steps[step.id] || { status: 'pending' };
      const before=await call(step.reconcile,`${step.id}:reconcile`);
      if (!before.ok) return state;
      const observed=before.value;
      if (observed === 'ambiguous') { state.status = 'blocked-ambiguous'; state.reason = step.id; await save(state); return state; }
      if (observed === 'done') {
        const verified=await call(step.verify,`${step.id}:verify`);
        if (!verified.ok) return state;
        if (verified.value !== true) { state.status = 'blocked-ambiguous'; state.reason = `${step.id}:verification`; await save(state); return state; }
        state.steps[step.id] = { status: 'verified' }; await save(state); continue;
      }
      if (observed !== 'not-done' || (checkpoint.status === 'started' && !step.safeToResume)) {
        state.status = 'blocked-ambiguous'; state.reason = `${step.id}:unconfirmed-start`; await save(state); return state;
      }
      // Exhaustion stops new side effects, while future calls still reconcile externally completed work.
      if (state.attempts >= maxAttempts) { state.status = 'exhausted'; await save(state); return state; }
      state.attempts++;
      state.steps[step.id] = { status: 'started' }; await save(state);
      try { await step.run(); }
      catch (error) { state.status = classify(error); state.reason = error.message; await save(state); return state; }
      const after=await call(step.reconcile,`${step.id}:post-reconcile`);
      if (!after.ok) return state;
      const postVerified=after.value==='done' ? await call(step.verify,`${step.id}:post-verify`) : {ok:true,value:false};
      if (!postVerified.ok) return state;
      if (after.value !== 'done' || postVerified.value !== true) { state.status = 'blocked-ambiguous'; state.reason = `${step.id}:postcondition`; await save(state); return state; }
      state.steps[step.id] = { status: 'verified' }; await save(state);
    }
    // The external close must be keyed by the original incident. A failed final save
    // cannot cause a second close: the next call reconciles that exact external key.
    const priorClose=await call(()=>isClosed(key),'incident:reconcile-close');
    if (!priorClose.ok) return state;
    if (typeof priorClose.value !== 'boolean') { state.status='blocked-ambiguous'; state.reason='malformed-close-state'; await save(state); return state; }
    if (!priorClose.value) {
      const closed=await call(()=>close(key),'incident:close');
      if (!closed.ok) return state;
    }
    const confirmed=await call(()=>isClosed(key),'incident:verify-close');
    if (!confirmed.ok) return state;
    if (typeof confirmed.value !== 'boolean') { state.status='blocked-ambiguous'; state.reason='malformed-close-state'; await save(state); return state; }
    if (!confirmed.value) { state.status = 'blocked-ambiguous'; state.reason = 'close-unconfirmed'; await save(state); return state; }
    state.status = 'completed'; await save(state);
    return state;
  } finally { await release(); }
}
module.exports = { recover, classify };
