'use strict';

// The caller supplies durable load/save, exact external reconciliation and verification.
// This module never performs a production operation on its own.
const TERMINAL = new Set(['completed', 'blocked-permission', 'blocked-ambiguous']);
function classify(error) {
  if (error?.code === 'PERMISSION_DENIED' || error?.status === 401 || error?.status === 403) return 'blocked-permission';
  if (error?.code === 'AMBIGUOUS_OUTCOME' || error?.mayHaveCommitted) return 'blocked-ambiguous';
  return 'retryable';
}
async function recover({ key, steps, load, save, close, maxAttempts = 2 }) {
  if (!key || !Array.isArray(steps) || !steps.length || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw Error('invalid_recovery_plan');
  const state = await load(key) || { key, status: 'working', steps: {}, attempts: 0 };
  if (state.key !== key) throw Error('incident_key_mismatch');
  if (TERMINAL.has(state.status)) return state;
  if (state.attempts >= maxAttempts) return state;
  state.attempts++;
  await save(state);
  for (const step of steps) {
    if (!step.id || !step.reconcile || !step.verify || !step.run) throw Error('invalid_recovery_step');
    const checkpoint = state.steps[step.id] || { status: 'pending' };
    // Reconcile even an apparently completed step: a checkpoint alone is not external proof.
    let observed;
    try { observed = await step.reconcile(); }
    catch (error) { state.status = classify(error); state.reason = error.message; await save(state); return state; }
    if (observed === 'ambiguous') { state.status = 'blocked-ambiguous'; state.reason = step.id; await save(state); return state; }
    if (observed === 'done') {
      if (!await step.verify()) { state.status = 'blocked-ambiguous'; state.reason = `${step.id}:verification`; await save(state); return state; }
      state.steps[step.id] = { status: 'verified' }; await save(state); continue;
    }
    if (observed !== 'not-done' || (checkpoint.status === 'started' && !step.safeToResume)) {
      state.status = 'blocked-ambiguous'; state.reason = `${step.id}:unconfirmed-start`; await save(state); return state;
    }
    state.steps[step.id] = { status: 'started' }; await save(state);
    try { await step.run(); }
    catch (error) { state.status = classify(error); state.reason = error.message; await save(state); return state; }
    const after = await step.reconcile();
    if (after !== 'done' || !await step.verify()) { state.status = 'blocked-ambiguous'; state.reason = `${step.id}:postcondition`; await save(state); return state; }
    state.steps[step.id] = { status: 'verified' }; await save(state);
  }
  // Close only the original key, after all observed postconditions hold.
  await close(key);
  state.status = 'completed'; await save(state);
  return state;
}
module.exports = { recover, classify };
