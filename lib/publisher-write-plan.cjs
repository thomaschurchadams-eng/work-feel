'use strict';
// Read/validate/plan only. The same daily-publisher remains the only state writer.
// Load the reviewed guard module through a single explicit require allowlist in
// functions.exec; this module itself has no Node, mutation or scheduling APIs.
const guards = require('./daily-cycle-guards.cjs');
const REPOSITORY = 'thomaschurchadams-eng/work-feel';
const STATE = 'automation/daily-cycle-state.json';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const id = value => Number.isSafeInteger(value) && value > 0;
const dated = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const fail = reason => { throw Error(reason); };
const same = (a, b) => ['head', 'run', 'job', 'runAttempt'].every(key => a?.[key] === b?.[key]);
const canonicalArticle = value => { const result = guards.canonicalPublicationUrl(value); if (!result.startsWith('https://creditunionainews.com/') || /[?#]/.test(result)) fail('noncanonical-article-url'); return result; };
const route = value => canonicalArticle(value).slice('https://creditunionainews.com'.length);
const article = path => /^news\/[^/]+\.html$/.test(path) || /^insight-[^/]+\.html$/.test(path);
function validateArticleReview({ mergeBase, review, main, rules, phase = 'ci', prNumber, decision }) {
  for (const snapshot of [mergeBase, review, main]) {
    if (!sha(snapshot?.sha) || !sha(snapshot?.stateBlob)) fail('exact-git-snapshot-unavailable');
  }
  if (!['ci', 'release'].includes(phase)) fail('invalid-review-phase');
  if (!Array.isArray(review.files) || !Array.isArray(main.changedPaths)) fail('complete-diff-unavailable');
  // Main may move for this owned checkpoint, never for unreviewed source.
  if (main.changedPaths.some(path => path !== STATE)) fail('main-source-changed-rebuild-and-review-candidate');
  if (review.stateBlob !== mergeBase.stateBlob || review.files.some(file => file.path === STATE || file.previousPath === STATE))
    fail('article-pr-must-leave-canonical-state-unchanged');
  const packages = review.files.filter(file => article(file.path));
  if (packages.length !== 1 || packages[0].status !== 'added' || packages[0].previousPath) fail('exactly-one-new-atomic-article-required');
  const url = '/' + packages[0].path;
  guards.validateStatePreservation(main.state, main.state, rules);
  const slots = main.state.current.regularPublicationSlots || [];
  const matching = slots.filter(slot => slot.url && route(slot.url) === url);
  if (matching.length !== 1) fail('article-lacks-canonical-owned-preparation');
  const slot = matching[0];
  if (!id(slot.slot) || slot.accountableOwner !== 'daily-publisher' || !dated(slot.nextReviewAt) || !slot.candidateTitle?.trim()) fail('invalid-owned-article-preparation');
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date(main.state.current.date + 'T12:00:00Z'));
  const target = rules?.standardCycle?.fullArticleTargetByWeekday?.[day];
  if (!id(target) || slot.slot > target || slot.slot > rules.standardCycle.fullArticleMaximumPerWeekday) fail('article-outside-current-weekday-slots');
  for (let earlier = 1; earlier < slot.slot; earlier++) if (!slots.some(old => old.slot === earlier && old.status === 'live-verified')) fail('earlier-article-not-live');
  if (main.state.current.publications.some(item => item.type === 'article' && route(item.url) === url)) fail('article-already-published');
  if (main.state.current.fullArticleCount >= rules.standardCycle.fullArticleMaximumPerWeekday) fail('weekday-publication-cap-already-reached');
  const p = slot.evidence?.pending;
  if (slot.status === 'prepared') {
    if (phase !== 'ci' || p || slot.evidence?.terminalValidation || slot.evidence?.terminalAcceptance) fail('release-requires-persisted-pending-checkpoint');
  } else {
    if (!['pending-validation', 'late-validation', 'validated'].includes(slot.status) || p?.head !== review.sha || !id(p?.prNumber) || !id(p.run) || !id(p.job) || !id(p.runAttempt)) fail('canonical-checkpoint-does-not-match-review-head');
    if (prNumber !== undefined && p.prNumber !== prNumber) fail('canonical-checkpoint-pr-mismatch');
    if (phase === 'release') {
      if (!id(prNumber) || p.prNumber !== prNumber) fail('exact-release-pr-required');
      if (slot.status !== 'validated') fail('persisted-validated-stage-required');
      const terminal = slot.evidence?.terminalValidation, visual = slot.evidence?.terminalAcceptance;
      if (decision?.decision !== 'awaiting-visual-review' || decision.releaseReady !== false || !same(decision.terminalEvidence, p) || decision.terminalEvidence?.conclusion !== 'success') fail('fresh-exact-helper-success-required');
      if (!same(terminal, p) || terminal?.conclusion !== 'success' || !dated(terminal.observedAt) || !same(visual, p) || !dated(visual?.visualReviewedAt)) fail('persisted-terminal-and-visual-evidence-required');
    }
  }
  return { kind: 'article-review-plan', phase, owner: 'daily-publisher', articlePath: packages[0].path, slot: slot.slot,
    reviewHead: review.sha, mergeBase: mergeBase.sha, expectedMain: main.sha, expectedStateBlob: main.stateBlob,
    checkpoint: p ? JSON.parse(JSON.stringify(p)) : null, prNumber: prNumber ?? p?.prNumber ?? null, canonicalStateUnchangedByArticle: true, releaseReady: false, writesPerformed: 0 };
}
function planStateWrite({ expectedMain, observedMain, base, candidate, rules }) {
  if (!sha(expectedMain) || observedMain !== expectedMain) fail('main-moved-reconcile-before-state-write');
  const candidateJson = JSON.stringify(candidate, null, 2) + '\n';
  const exact = JSON.parse(candidateJson), previous = JSON.parse(JSON.stringify(base));
  guards.validateStatePreservation(previous, exact, rules);
  return { kind: guards.isDeepStrictEqual(previous, exact) ? 'already-recorded' : 'state-write-plan', owner: 'daily-publisher',
    repository: REPOSITORY, expectedMain, path: STATE, candidate: exact, candidateJson, force: false, writesPerformed: 0, releaseReady: false };
}
function validateMergedArticle({ plan, merge, mainStateBlob, changedPathsSinceReview }) {
  if (plan?.kind !== 'article-review-plan' || plan.phase !== 'release' || !sha(merge?.sha) || !Array.isArray(merge.parents)) fail('invalid-release-merge');
  if (merge.parents.length !== 2 || merge.parents[0] !== plan.expectedMain || merge.parents[1] !== plan.reviewHead) fail('merge-parent-or-main-race-requires-reconciliation');
  if (mainStateBlob !== plan.expectedStateBlob || !Array.isArray(changedPathsSinceReview) || changedPathsSinceReview.some(path => path !== STATE)) fail('merge-changed-reviewed-source-or-canonical-state');
  return { mergeCommit: merge.sha, reviewHead: plan.reviewHead, slot: plan.slot, checkpoint: JSON.parse(JSON.stringify(plan.checkpoint)), prNumber: plan.prNumber, writesPerformed: 0, releaseReady: false };
}
function planLiveCloseout({ expectedMain, observedMain, base, rules, plan, mergeProof, production }) {
  if (observedMain !== expectedMain || !sha(expectedMain)) fail('main-moved-reconcile-before-closeout');
  if (mergeProof?.reviewHead !== plan?.reviewHead || mergeProof?.slot !== plan?.slot || !sha(mergeProof?.mergeCommit)) fail('verified-merge-required');
  const slot = base.current.regularPublicationSlots?.find(slot => slot.slot === plan.slot);
  if (!slot || !same(slot.evidence?.pending, plan.checkpoint) || slot.evidence?.pending?.prNumber !== plan.prNumber || !same(mergeProof.checkpoint, plan.checkpoint) || mergeProof.prNumber !== plan.prNumber) fail('closeout-checkpoint-changed');
  if (slot.status === 'live-verified') {
    if (slot.productionCommit !== mergeProof.mergeCommit) fail('different-existing-release');
    return planStateWrite({ expectedMain, observedMain, base, candidate: base, rules });
  }
  if (slot.status !== 'validated') fail('validated-stage-required-before-live-closeout');
  const p = slot.evidence?.pending, terminal = slot.evidence?.terminalValidation, visual = slot.evidence?.terminalAcceptance;
  if (!same(terminal, p) || terminal?.conclusion !== 'success' || !dated(terminal.observedAt) || !same(visual, p) || !dated(visual?.visualReviewedAt)) fail('durable-premerge-acceptance-required');
  if (production?.commit !== mergeProof.mergeCommit || production.state !== 'READY' || canonicalArticle(production.url) !== canonicalArticle(slot.url) || production.articleVerified !== true || production.imageVerified !== true || production.listingVerified !== true || production.homePlacementVerified !== true || !dated(production.verifiedAt)) fail('actual-exact-production-verification-required');
  const candidate = JSON.parse(JSON.stringify(base)), next = candidate.current.regularPublicationSlots.find(value => value.slot === plan.slot);
  next.status = 'live-verified'; next.productionCommit = mergeProof.mergeCommit; next.verifiedAt = production.verifiedAt;
  candidate.current.publications.push({ type: 'article', url: next.url }); candidate.current.fullArticleCount++;
  return planStateWrite({ expectedMain, observedMain, base, candidate, rules });
}
function reader(tools, repository) {
  if (repository !== REPOSITORY) fail('invalid-repository');
  const blocked = (code, target) => {
    const category = ['FORBIDDEN', 'UNAUTHORIZED', '403', '401'].includes(String(code)) ? 'permission' : ['429', 'RATE_LIMITED', 'TOO_MANY_REQUESTS'].includes(String(code)) ? 'rate-limit' : ['404', 'NOT_FOUND'].includes(String(code)) ? 'missing' : 'unavailable';
    const error = Error('github-read-blocked:' + category); error.code = category; error.target = target; throw error;
  };
  const call = async (action, target) => {
    let result; try { result = await action(); } catch (error) { blocked(error?.code, target); }
    if (result?.isError || !result?.structuredContent || result.structuredContent.error) blocked(result?.structuredContent?.error_code || result?.structuredContent?.error?.code, target);
    return result.structuredContent;
  };
  const api = async path => JSON.parse((await call(() => tools.mcp__codex_apps__github_fetch({ url: `https://api.github.com/repos/${repository}${path}` }), `${repository}${path}`)).content);
  const file = async (ref, path) => {
    const value = await call(() => tools.mcp__codex_apps__github_fetch_file({ repository_full_name: repository, ref, path }), `${repository}@${ref}:${path}`);
    if (value.encoding !== 'utf-8' || !sha(value.sha) || typeof value.content !== 'string') fail('exact-file-unavailable');
    return { blob: value.sha, value: JSON.parse(value.content), text: value.content };
  };
  const comparison = async (base, head) => {
    const value = await api(`/compare/${base}...${head}`);
    if (value.base_commit?.sha !== base || value.merge_base_commit?.sha !== base || !['ahead', 'identical'].includes(value.status) ||
        !Array.isArray(value.files) || value.files.length >= 300 || !Array.isArray(value.commits) || value.total_commits !== value.commits.length ||
        (head !== base && value.commits.at(-1)?.sha !== head) || (head === base && value.total_commits !== 0)) fail('incomplete-or-unbound-comparison');
    return value.files.map(file => ({ path: file.filename, status: file.status, previousPath: file.previous_filename }));
  };
  return { api, file, comparison, pr: async number => await call(() => tools.mcp__codex_apps__github_get_pr_info({ repository_full_name: repository, pr_number: number }), `${repository}/pulls/${number}`) };
}
async function inspectStateWriteUsingGitHubTools({ tools, repository, expectedMain, candidate }) {
  const read = reader(tools, repository), main = await read.api('/commits/main');
  if (main.sha !== expectedMain || !sha(main.commit?.tree?.sha)) fail('main-moved-reconcile-before-state-write');
  const [base, rules] = await Promise.all([read.file(main.sha, STATE), read.file(main.sha, 'automation/publishing-rules.json')]);
  return { ...planStateWrite({ expectedMain, observedMain: main.sha, base: base.value, candidate, rules: rules.value }), baseTree: main.commit.tree.sha, baseStateBlob: base.blob };
}
async function inspectArticleUsingGitHubTools({ tools, repository, prNumber, phase = 'ci', decision }) {
  const read = reader(tools, repository);
  const [main, pr] = await Promise.all([read.api('/commits/main'), read.pr(prNumber)]);
  const head = pr.head_sha || pr.head?.sha;
  if (pr.number !== prNumber || pr.base !== 'main' || pr.head_repo_full_name !== repository) fail('pr-target-or-repository-mismatch');
  if (!sha(main.sha) || !sha(head) || pr.state !== 'open' || pr.merged) fail('open-exact-article-pr-required');
  const fork = await read.api(`/compare/${main.sha}...${head}`), common = fork.merge_base_commit?.sha;
  if (!sha(common)) fail('review-merge-base-unavailable');
  const [old, proposed, current, rules, headFiles, mainFiles] = await Promise.all([
    read.file(common, STATE), read.file(head, STATE), read.file(main.sha, STATE), read.file(main.sha, 'automation/publishing-rules.json'),
    read.comparison(common, head), read.comparison(common, main.sha)
  ]);
  const plan = validateArticleReview({ mergeBase: { sha: common, stateBlob: old.blob }, review: { sha: head, stateBlob: proposed.blob, files: headFiles },
    main: { sha: main.sha, stateBlob: current.blob, state: current.value, changedPaths: mainFiles.flatMap(file => [file.path, ...(file.previousPath ? [file.previousPath] : [])]) }, rules: rules.value, phase, prNumber, decision });
  const [endMain, endPr] = await Promise.all([read.api('/commits/main'), read.pr(prNumber)]);
  if (endMain.sha !== main.sha || (endPr.head_sha || endPr.head?.sha) !== head || endPr.state !== 'open' || endPr.merged) fail('refs-moved-during-review-reconcile');
  return plan;
}
async function inspectLiveCloseoutUsingGitHubTools({ tools, repository, prNumber, plan, expectedMain, production }) {
  const read = reader(tools, repository);
  const [main, pr] = await Promise.all([read.api('/commits/main'), read.pr(prNumber)]);
  if (main.sha !== expectedMain || !sha(main.commit?.tree?.sha)) fail('main-moved-reconcile-before-closeout');
  if (pr.number !== prNumber || pr.base !== 'main' || pr.head_repo_full_name !== repository || (plan && prNumber !== plan.prNumber)) fail('pr-target-or-repository-mismatch');
  const mergedSha = pr.merge_commit_sha;
  const reviewedHead = pr.head_sha || pr.head?.sha;
  if (!pr.merged || !sha(reviewedHead) || !sha(mergedSha)) fail('same-article-pr-merge-required');
  const [merge, mergedState, current, rules, sourceDiff] = await Promise.all([
    read.api(`/commits/${mergedSha}`), read.file(mergedSha, STATE), read.file(main.sha, STATE), read.file(main.sha, 'automation/publishing-rules.json'),
    read.comparison(reviewedHead, mergedSha)
  ]);
  if (merge.parents?.length !== 2 || merge.parents[1].sha !== reviewedHead) fail('two-parent-reviewed-merge-required');
  const prior = await read.file(merge.parents[0].sha, STATE);
  guards.validateStatePreservation(mergedState.value, mergedState.value, rules.value);
  const slots = (mergedState.value.current.regularPublicationSlots || []).filter(slot => slot.status === 'validated' && slot.evidence?.pending?.prNumber === prNumber && slot.evidence.pending.head === reviewedHead);
  if (slots.length !== 1) fail('durable-merged-acceptance-unavailable');
  const accepted = slots[0], checkpoint = accepted.evidence.pending;
  // Reconstruct from immutable Git parents and canonical V, not an in-memory
  // plan that disappears when a publisher turn is interrupted after merge.
  const recovered = { kind: 'article-review-plan', phase: 'release', owner: 'daily-publisher', reviewHead: reviewedHead,
    slot: accepted.slot, prNumber, checkpoint, expectedMain: merge.parents[0].sha, expectedStateBlob: prior.blob };
  if (plan && (plan.expectedMain !== recovered.expectedMain || plan.expectedStateBlob !== recovered.expectedStateBlob || !same(plan.checkpoint, checkpoint) || plan.reviewHead !== reviewedHead || plan.slot !== accepted.slot)) fail('saved-release-plan-does-not-match-merged-checkpoint');
  const proof = validateMergedArticle({ plan: recovered, merge: { sha: merge.sha, parents: merge.parents.map(value => value.sha) },
    mainStateBlob: mergedState.blob, changedPathsSinceReview: sourceDiff.flatMap(file => [file.path, ...(file.previousPath ? [file.previousPath] : [])]) });
  const records = [current.value.current, ...current.value.history];
  const recorded = records.flatMap(day => day.regularPublicationSlots || []).filter(slot => slot.status === 'live-verified' && slot.productionCommit === mergedSha && slot.evidence?.pending?.prNumber === prNumber && same(slot.evidence.pending, checkpoint));
  let result;
  if (recorded.length === 1) {
    // Later legitimate articles do not invalidate an already recorded receipt.
    result = planStateWrite({ expectedMain, observedMain: main.sha, base: current.value, candidate: current.value, rules: rules.value });
  } else {
    const laterDiff = await read.comparison(mergedSha, main.sha);
    if (laterDiff.some(file => file.path !== STATE || file.previousPath)) fail('postmerge-source-moved-reconcile-production');
    // The normal helper deliberately returns reconcile-existing-release for a
    // closed PR. Reconcile this closed release directly, without pretending it
    // is open, and retain its exact current run/job/attempt fencing.
    const [run, jobs] = await Promise.all([read.api(`/actions/runs/${checkpoint.run}`), read.api(`/actions/runs/${checkpoint.run}/jobs?filter=latest&per_page=100`)]);
    const job = jobs.jobs?.find(value => value.id === checkpoint.job);
    if (run.id !== checkpoint.run || run.head_sha !== checkpoint.head || run.run_attempt !== checkpoint.runAttempt || run.status !== 'completed' || run.conclusion !== 'success' ||
        !job || job.name !== 'design-checks' || job.run_id !== checkpoint.run || job.head_sha !== checkpoint.head || job.run_attempt !== checkpoint.runAttempt || job.status !== 'completed' || job.conclusion !== 'success') fail('merged-release-validation-no-longer-matches');
    result = planLiveCloseout({ expectedMain, observedMain: main.sha, base: current.value, rules: rules.value, plan: recovered, mergeProof: proof, production });
  }
  const endMain = await read.api('/commits/main');
  if (endMain.sha !== main.sha) fail('main-moved-during-closeout-reconcile');
  return { ...result, baseTree: main.commit.tree.sha, baseStateBlob: current.blob };
}
async function verifyStoredStateUsingGitHubTools({ tools, repository, plan, commit }) {
  if (plan?.repository !== repository || plan.path !== STATE || !sha(plan.expectedMain) || !sha(commit) || typeof plan.candidateJson !== 'string') fail('invalid-stored-state-check');
  const read = reader(tools, repository);
  const [stored, file, main, changes] = await Promise.all([read.api(`/commits/${commit}`), read.file(commit, STATE), read.api('/commits/main'), read.comparison(plan.expectedMain, commit)]);
  if (stored.parents?.length !== 1 || stored.parents[0].sha !== plan.expectedMain || changes.length !== 1 || changes[0].path !== STATE || changes[0].previousPath || file.text !== plan.candidateJson) fail('stored-state-does-not-match-validated-bytes');
  try { await read.comparison(commit, main.sha); } catch (error) {
    if (error.code || error.message !== 'incomplete-or-unbound-comparison') throw error;
    fail('state-commit-not-canonical-reconcile-uncertain-write');
  }
  if ((await read.api('/commits/main')).sha !== main.sha) fail('main-moved-during-stored-state-verification');
  return { recorded: true, commit, stateBlob: file.blob, mainAdvanced: main.sha !== commit, nextAction: main.sha === commit ? 'continue-same-checkpoint' : 'reconcile-current-main-without-repeating-write', writesPerformed: 0, releaseReady: false };
}
module.exports = { validateArticleReview, planStateWrite, validateMergedArticle, planLiveCloseout,
  inspectStateWriteUsingGitHubTools, inspectArticleUsingGitHubTools, inspectLiveCloseoutUsingGitHubTools, verifyStoredStateUsingGitHubTools };
