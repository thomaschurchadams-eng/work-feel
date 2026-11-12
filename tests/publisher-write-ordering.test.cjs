'use strict';
// Actual isolated Git branches/commits/merges; only CI, visual and production
// observations are simulated. No fixture is sent to GitHub or live readers.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { execFileSync, spawnSync } = require('node:child_process');
const planner = require('../lib/publisher-write-plan.cjs');
const guards = require('../lib/daily-cycle-guards.cjs');
const helper = require('../lib/publisher-validation.cjs');
const root = path.resolve(__dirname, '..'), STATE = 'automation/daily-cycle-state.json';
const rules = require('../automation/publishing-rules.json');
const cli = path.join(root, 'scripts/validate-daily-cycle-preservation.mjs');
const reviewCli = path.join(root, 'scripts/validate-publisher-review.mjs');
// Keep the simulation after the preserved current cycle, never append a duplicate
// slot 1 when a newly imported main has already published on the old fixture day.
const fixtureDay = new Date(JSON.parse(fs.readFileSync(path.join(root, STATE))).current.date + 'T12:00:00Z');
do { fixtureDay.setUTCDate(fixtureDay.getUTCDate() + 1); } while ([0, 6].includes(fixtureDay.getUTCDay()));
const fixtureDate = fixtureDay.toISOString().slice(0, 10);
const stamp = fixtureDate + 'T12:30:00Z', clone = value => JSON.parse(JSON.stringify(value));
const traces = [];
test.after(() => { if (process.env.CUAI_ORDERING_EVIDENCE_PATH) fs.writeFileSync(process.env.CUAI_ORDERING_EVIDENCE_PATH, JSON.stringify({ simulationOnly: true, realGitIdentities: true, traces }, null, 2) + '\n'); });
function fixture(t, { checkoutTransport = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-two-ref-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const run = (exe, args, options = {}) => spawnSync(exe, args, { cwd: dir, encoding: 'utf8', ...options, env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp, ...(options.env || {}) } });
  const git = (...args) => { const r = run('git', args); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  assert.equal(run('git', ['clone', '--quiet', '--no-hardlinks', root, '.']).status, 0);
  git('config', 'user.name', 'Isolated publisher'); git('config', 'user.email', 'publisher@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'no-hooks'));
  git('checkout', '-B', 'main');
  const trace = { test: t.name, events: [] }; traces.push(trace);
  const head = ref => git('rev-parse', ref || 'main');
  const state = ref => JSON.parse(git('show', `${ref || 'main'}:${STATE}`));
  const blob = (ref, file = STATE) => git('rev-parse', `${ref}:${file}`);
  if (checkoutTransport) {
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-canonical-remote-'));
    t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
    git('init', '--bare', '--quiet', remote);
    git('remote', 'add', 'isolated-upstream', remote);
    git('push', '--quiet', 'isolated-upstream', 'refs/heads/main:refs/heads/main');
    trace.transport = 'isolated local bare Git remote; no network or live reader';
  }
  function publishAndRead(before, created) {
    if (!checkoutTransport) return created;
    const observed = git('ls-remote', 'isolated-upstream', 'refs/heads/main').split(/\s+/)[0];
    assert.equal(observed, before, 'fresh canonical main must match the expected parent');
    git('merge-base', '--is-ancestor', before, created);
    git('push', '--quiet', 'isolated-upstream', `${created}:refs/heads/main`);
    git('fetch', '--quiet', 'isolated-upstream', 'refs/heads/main:refs/remotes/isolated-upstream/main');
    const stored = git('rev-parse', 'refs/remotes/isolated-upstream/main');
    assert.equal(stored, created);
    return stored;
  }
  const commit = message => { git('add', '.'); git('commit', '-qm', message); return head('HEAD'); };
  const check = (next, base = head()) => {
    const file = path.join(dir, STATE); fs.writeFileSync(file, JSON.stringify(next));
    // Match the real CLI contract: canonical repository path + exact main SHA.
    return run(process.execPath, [cli, STATE, base]);
  };
  function persist(next, label) {
    const before = head(), prior = state(before);
    const p = planner.planStateWrite({ expectedMain: before, observedMain: head(), base: prior, candidate: next, rules });
    if (p.kind === 'already-recorded') return before;
    git('checkout', '--detach', before);
    const exact = JSON.parse(p.candidateJson);
    const checked = check(exact, p.expectedMain); assert.equal(checked.status, 0, checked.stderr);
    fs.writeFileSync(path.join(dir, STATE), p.candidateJson);
    git('add', STATE); const tree = git('write-tree');
    const created = git('commit-tree', tree, '-p', before, '-m', label);
    git('update-ref', 'refs/heads/main', created, before); git('checkout', 'main');
    const stored = publishAndRead(before, created);
    const storedValidation = run(process.execPath, [cli, STATE, before, stored]);
    assert.equal(storedValidation.status, 0, storedValidation.stderr);
    assert.deepEqual(state(stored), exact); assert.equal(execFileSync('git', ['show', `${stored}:${STATE}`], { cwd: dir, encoding: 'utf8' }), p.candidateJson); assert.equal(blob(stored), blob('main'));
    const chainResult = run(process.execPath, [path.join(root, 'scripts/validate-daily-cycle-chain.mjs')], { env: { ...process.env, GITHUB_EVENT_NAME: 'push', CUAI_PUSH_BEFORE: before } });
    assert.equal(chainResult.status, 0, chainResult.stderr);
    trace.events.push({ label, parent: before, commit: created, tree, stateBlob: blob(created), current: clone(next.current), fetchedStoredCommit: stored, storedValidation: storedValidation.stdout.trim(), mainPushChain: chainResult.stdout.trim() });
    return created;
  }
  function prepare(number = 1) {
    const next = state();
    if (next.current.date !== fixtureDate) { next.history.push(clone(next.current)); next.current = { date: fixtureDate, status: 'in-progress', fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [] }; }
    next.current.outcomeSlot = number;
    next.current.regularPublicationSlots.push({ slot: number, status: 'prepared', candidateTitle: `Isolated article ${number}`, url: `https://creditunionainews.com/news/order-fixture-${number}.html`, accountableOwner: 'daily-publisher', nextReviewAt: stamp });
    return persist(next, `P${number}: canonical preparation only`);
  }
  function article(number = 1) {
    const base = head(); git('checkout', '-B', 'article', base);
    fs.writeFileSync(path.join(dir, `news/order-fixture-${number}.html`), `<h1>Isolated article ${number}</h1>`);
    fs.appendFileSync(path.join(dir, 'news.html'), `\n<!-- isolated article ${number} listing -->\n`);
    fs.appendFileSync(path.join(dir, 'sitemap.xml'), `\n<!-- isolated article ${number} sitemap -->\n`);
    const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'automation/coverage-ledger.json')));
    ledger.articles.push({ id: `order-fixture-${number}`, url: `/news/order-fixture-${number}.html`, publishedAt: stamp });
    fs.writeFileSync(path.join(dir, 'automation/coverage-ledger.json'), JSON.stringify(ledger));
    const h = commit(`H${number}: atomic isolated article package`); assert.equal(blob(h), blob(base));
    git('checkout', 'main'); trace.events.push({ label: `H${number}`, parent: base, commit: h, tree: git('rev-parse', `${h}^{tree}`), stateBlob: blob(h) });
    return h;
  }
  function snapshots(h, phase = 'ci', decision) {
    const main = head(), common = git('merge-base', main, h);
    const files = git('diff', '--name-status', '--no-renames', common, h).split('\n').filter(Boolean).map(row => { const [s, path] = row.split('\t'); return { path, status: s === 'A' ? 'added' : s === 'D' ? 'removed' : 'modified' }; });
    return { mergeBase: { sha: common, stateBlob: blob(common) }, review: { sha: h, stateBlob: blob(h), files },
      main: { sha: main, stateBlob: blob(main), state: state(main), changedPaths: git('diff', '--name-only', common, main).split('\n').filter(Boolean) }, rules, phase, prNumber: 990310 + (state().current.outcomeSlot || 1), decision };
  }
  const review = (h, phase, decision) => planner.validateArticleReview(snapshots(h, phase, decision));
  function checkpoint(h, number = 1, attempt = 1, runSerial = 1) {
    const next = state(), slot = next.current.regularPublicationSlots.find(s => s.slot === number);
    const old = slot.evidence?.pending, terminal = slot.evidence?.terminalValidation;
    const history = clone(slot.evidence?.validationHistory || []);
    if (old) history.push({ ...old, status: 'superseded', observedAt: stamp, ...(terminal ? { terminalValidation: terminal } : {}) });
    slot.status = 'pending-validation'; slot.evidence = { pending: { prNumber: 990310 + number, head: h, run: 99000000000 + number * 100 + runSerial, job: 99000001000 + number * 100 + runSerial * 10 + attempt, runAttempt: attempt }, ...(history.length ? { validationHistory: history } : {}) };
    persist(next, 'C: exact pending checkpoint on main'); return slot.evidence.pending;
  }
  async function observe(p, status = 'success', actualHead = head('article')) {
    const pending = { ...p, accountableOwner: 'daily-publisher', nextReviewAt: stamp };
    const active = status === 'in_progress';
    const result = await helper.inspectPublisherValidation({ pending, now: stamp,
      readPullRequest: async () => ({ state: 'open', merged: false, head_sha: actualHead }),
      readWorkflowRun: async () => ({ id: p.run, head_sha: p.head, run_attempt: p.runAttempt, status: active ? 'in_progress' : 'completed', conclusion: active ? null : status }),
      readWorkflowJobs: async () => [{ id: p.job, run_id: p.run, head_sha: p.head, run_attempt: p.runAttempt, name: 'design-checks', status: active ? 'in_progress' : 'completed', conclusion: active ? null : status }] });
    trace.events.push({ label: 'actual helper with simulated CI', actualPrHead: actualHead, checkpoint: p, decision: result.decision, releaseReady: result.releaseReady });
    return result;
  }
  function acceptance(decision, number = 1) {
    const next = state(), slot = next.current.regularPublicationSlots.find(s => s.slot === number);
    slot.status = decision.decision === 'technical-failure' ? 'technical-failure' : 'validated';
    slot.evidence.terminalValidation = clone(decision.terminalEvidence);
    if (slot.status === 'validated') slot.evidence.terminalAcceptance = { ...slot.evidence.pending, visualReviewedAt: stamp };
    return persist(next, slot.status === 'validated' ? 'V: simulated terminal and visual acceptance persisted before merge' : 'failed receipt persisted');
  }
  function merge(plan) {
    git('checkout', 'main'); const before = head(); git('merge', '--no-ff', '-m', 'M: reviewed atomic article merge', 'article');
    const m = head(), parents = git('show', '-s', '--format=%P', m).split(' ');
    publishAndRead(before, m);
    const proof = planner.validateMergedArticle({ plan, merge: { sha: m, parents }, mainStateBlob: blob(m), changedPathsSinceReview: git('diff', '--name-only', plan.reviewHead, m).split('\n').filter(Boolean) });
    assert.equal(blob(m), plan.expectedStateBlob);
    trace.events.push({ label: 'M: merge preserves canonical validated checkpoint', commit: m, parents, tree: git('rev-parse', `${m}^{tree}`), stateBlob: blob(m) });
    return proof;
  }
  function close(plan, proof, production = {}) {
    const base = state(), slot = base.current.regularPublicationSlots.find(s => s.slot === plan.slot);
    return planner.planLiveCloseout({ expectedMain: head(), observedMain: head(), base, rules, plan, mergeProof: proof,
      production: { commit: proof.mergeCommit, state: 'READY', url: slot.url, articleVerified: true, imageVerified: true, listingVerified: true, homePlacementVerified: true, verifiedAt: stamp, ...production } });
  }
  const ci = h => run(process.execPath, [reviewCli, head(), h]);
  const chain = before => run(process.execPath, [path.join(root, 'scripts/validate-daily-cycle-chain.mjs')], { env: { ...process.env, GITHUB_EVENT_NAME: before ? 'push' : 'schedule', CUAI_PUSH_BEFORE: before || '' } });
  function readers(options = {}) {
    const response = value => ({ structuredContent: value });
    const repository = 'thomaschurchadams-eng/work-feel';
    const calls = [];
    const tools = {
      mcp__codex_apps__github_get_pr_info: async args => {
        calls.push({ method: 'pr', args }); if (options.denied) return { isError: true };
        return response({ number: 990310 + (state().current.outcomeSlot || 1), base: 'main', base_sha: head(), head_sha: head('article'), head_repo_full_name: repository,
          merged: options.merged === true, state: options.merged ? 'closed' : 'open', merge_commit_sha: options.mergeCommit || null, ...(options.prOverride || {}) });
      },
      mcp__codex_apps__github_fetch_file: async args => {
        calls.push({ method: 'file', args }); if (options.denied) return { isError: true };
        return response({ sha: blob(args.ref, args.path), encoding: 'utf-8', content: execFileSync('git', ['show', `${args.ref}:${args.path}`], { cwd: dir, encoding: 'utf8' }) });
      },
      mcp__codex_apps__github_fetch: async args => {
        calls.push({ method: 'fetch', args }); if (options.denied) return { isError: true };
        assert.ok(args.url.startsWith(`https://api.github.com/repos/${repository}/`));
        const suffix = args.url.split(repository)[1]; let value;
        if (suffix.startsWith('/commits/')) {
          const revision = head(suffix.slice('/commits/'.length));
          value = { sha: revision, parents: git('show', '-s', '--format=%P', revision).split(' ').filter(Boolean).map(sha => ({ sha })), commit: { tree: { sha: git('rev-parse', `${revision}^{tree}`) } } };
        } else if (suffix.startsWith('/compare/')) {
          const [base, target] = suffix.slice('/compare/'.length).split('...'), common = git('merge-base', base, target);
          const commits = git('rev-list', '--reverse', `${base}..${target}`).split('\n').filter(Boolean).map(sha => ({ sha }));
          const files = git('diff', '--name-status', '--no-renames', common, target).split('\n').filter(Boolean).map(row => { const [s, filename] = row.split('\t'); return { filename, status: s === 'A' ? 'added' : s === 'D' ? 'removed' : 'modified' }; });
          value = { base_commit: { sha: base }, merge_base_commit: { sha: common }, status: base === target ? 'identical' : common === base ? 'ahead' : common === target ? 'behind' : 'diverged', commits, total_commits: commits.length, files };
          if (options.truncated) value.total_commits++;
        } else if (suffix.startsWith('/actions/runs/')) {
          const p = state(options.mergeCommit || 'main').current.regularPublicationSlots.find(s => s.evidence?.pending)?.evidence.pending;
          value = suffix.includes('/jobs?') ? { jobs: [{ id: p.job, run_id: p.run, head_sha: p.head, run_attempt: p.runAttempt, name: 'design-checks', status: 'completed', conclusion: 'success' }] } : { id: p.run, head_sha: p.head, run_attempt: p.runAttempt, status: 'completed', conclusion: 'success' };
        } else throw Error('unexpected read route');
        return response({ content: JSON.stringify(value) });
      }
    };
    return { tools, calls, repository };
  }
  return { dir, git, head, state, blob, persist, prepare, article, snapshots, review, checkpoint, observe, acceptance, merge, close, ci, chain, trace, run, check, commit, readers };
}
test('three real two-ref article graphs retain exact heads, canonical checkpoints and unchanged full history anchor', async t => {
  const f = fixture(t, { checkoutTransport: true }), start = f.head(); let firstRelease;
  for (let number = 1; number <= 3; number++) {
    f.prepare(number); const h = f.article(number);
    assert.equal(f.state().current.fullArticleCount, number - 1, 'preparation is not a publication');
    const initialCi = f.ci(h); assert.equal(initialCi.status, 0, initialCi.stderr); f.review(h);
    const p = f.checkpoint(h, number);
    assert.equal(f.head('article'), h); assert.equal(f.ci(h).status, 0);
    // New invocation after an interruption reads the same persisted main slot.
    const resumed = clone(f.state().current.regularPublicationSlots.find(s => s.slot === number).evidence.pending);
    const pending = await f.observe(resumed, 'in_progress'); assert.equal(pending.decision, 'pending-validation');
    const done = await f.observe(p); assert.equal(done.decision, 'awaiting-visual-review'); assert.equal(done.releaseReady, false);
    f.acceptance(done, number); const release = f.review(h, 'release', done);
    const proof = f.merge(release); if (number === 1) firstRelease = { release, proof, h }; assert.equal(f.state().current.regularPublicationSlots.at(-1).status, 'validated');
    // The closed PR helper remains reconciliation-only; durable V is retained.
    const closed = await helper.inspectPublisherValidation({ pending: { ...p, accountableOwner: 'daily-publisher', nextReviewAt: stamp }, now: stamp,
      readPullRequest: async () => ({ state: 'closed', merged: true, head_sha: h }), readWorkflowRun: async () => { throw Error('must not read'); }, readWorkflowJobs: async () => { throw Error('must not read'); } });
    assert.equal(closed.decision, 'reconcile-existing-release');
    const close = f.close(release, proof); f.persist(close.candidate, 'F: simulated exact production live closeout');
    assert.equal(f.state().current.fullArticleCount, number);
    assert.equal(f.state().current.regularPublicationSlots.at(-1).productionCommit, proof.mergeCommit);
    assert.equal(f.close(release, proof).kind, 'already-recorded');
    const chain = f.chain(); assert.equal(chain.status, 0, chain.stderr);
  }
  const first = f.readers({ merged: true, mergeCommit: firstRelease.proof.mergeCommit, prOverride: { number: 990311, head_sha: firstRelease.h } });
  const duplicate = await planner.inspectLiveCloseoutUsingGitHubTools({ ...first, prNumber: 990311, expectedMain: f.head() });
  assert.equal(duplicate.kind, 'already-recorded'); assert.ok(!first.calls.some(call => call.args?.url?.includes('/actions/runs/')));
  assert.equal(f.state().current.regularPublicationSlots.length, 3);
  assert.doesNotThrow(() => f.prepare(4));
});
test('failure, actual changed article head and replacement preserve failed checkpoint and reject stale success', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), p = f.checkpoint(h);
  const failed = await f.observe(p, 'failure'); f.acceptance(failed);
  f.git('checkout', 'article'); fs.appendFileSync(path.join(f.dir, 'news/order-fixture-1.html'), '\n<p>Isolated source correction</p>'); const h2 = f.commit('H2: corrected article requires fresh exact review'); f.git('checkout', 'main');
  assert.notEqual(h2, h); assert.equal((await f.observe(p, 'success')).decision, 'stale-validation');
  assert.throws(() => f.review(h2, 'release', awaitablePlaceholder()), /canonical-checkpoint/);
  const p2 = f.checkpoint(h2, 1, 1, 2); const done = await f.observe(p2); f.acceptance(done);
  const old = f.state().current.regularPublicationSlots[0].evidence.validationHistory[0]; assert.equal(old.head, h); assert.equal(old.terminalValidation.conclusion, 'failure');
  const release = f.review(h2, 'release', done), proof = f.merge(release); f.persist(f.close(release, proof).candidate, 'replacement live');
  assert.equal(f.state().current.fullArticleCount, 1);
  function awaitablePlaceholder() { return {}; }
});
test('original in-PR checkpoint mutation is rejected and actual helper detects changed Git head', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), p = f.checkpoint(h);
  f.git('checkout', 'article'); fs.writeFileSync(path.join(f.dir, STATE), JSON.stringify(f.state())); const h2 = f.commit('unsupported checkpoint in article branch'); f.git('checkout', 'main');
  assert.notEqual(h, h2); assert.equal((await f.observe(p)).decision, 'stale-validation');
  assert.notEqual(f.ci(h2).status, 0); assert.throws(() => f.review(h2), /leave-canonical-state-unchanged/);
});
test('main state-only movement preserves H; source movement and a stale write lease are rejected', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), before = f.head(); const p = f.checkpoint(h);
  const updated = f.state(); updated.current.regularPublicationSlots[0].nextAction = 'Same-owner bounded review'; f.persist(updated, 'unrelated state metadata');
  assert.equal(f.head('article'), h); f.review(h);
  assert.throws(() => planner.planStateWrite({ expectedMain: before, observedMain: f.head(), base: f.state(before), candidate: f.state(), rules }), /main-moved/);
  assert.notEqual(f.run('git', ['update-ref', 'refs/heads/main', before, before]).status, 0, 'actual Git expected-old lease rejects stale writer');
  fs.appendFileSync(path.join(f.dir, 'assets/app.js'), '\n// isolated concurrent source edit\n'); f.commit('concurrent source movement');
  assert.throws(() => f.review(h), /main-source-changed/); assert.notEqual(f.ci(h).status, 0);
  assert.equal((await f.observe(p)).decision, 'awaiting-visual-review', 'helper success alone cannot detect main drift');
});
test('premerge main race, missing visual/production and bypassed closeout fail closed', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), p = f.checkpoint(h), done = await f.observe(p);
  assert.throws(() => f.review(h, 'release', done), /persisted-validated-stage/);
  f.acceptance(done); const plan = f.review(h, 'release', done);
  const bad = f.state(); bad.current.regularPublicationSlots[0].evidence.terminalAcceptance.visualReviewedAt = undefined;
  assert.throws(() => planner.planStateWrite({ expectedMain: f.head(), observedMain: f.head(), base: f.state(), candidate: bad, rules }), /visual/);
  const moved = f.state(); moved.current.regularPublicationSlots[0].nextAction = 'Concurrent state observer'; f.persist(moved, 'main moves after premerge read');
  assert.throws(() => f.merge(plan), /main-race/, 'merge API has no atomic base lease; detected merged result is not certified');
});
test('postmerge interruption resumes retained V, rejects false production, and duplicate F is a no-op', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), p = f.checkpoint(h), done = await f.observe(p); f.acceptance(done);
  const plan = f.review(h, 'release', done), proof = f.merge(plan);
  assert.throws(() => f.close(plan, proof, { state: 'BUILDING' }), /production-verification/);
  assert.throws(() => f.close(plan, proof, { commit: h }), /production-verification/);
  assert.throws(() => f.close(plan, proof, { listingVerified: false }), /production-verification/);
  const reconstructed = JSON.parse(JSON.stringify({ plan, proof }));
  const close = f.close(reconstructed.plan, reconstructed.proof); const before = f.head(); f.persist(close.candidate, 'resumed same-owner F');
  const after = f.head(); assert.notEqual(before, after); assert.equal(f.close(plan, proof).kind, 'already-recorded'); assert.equal(f.head(), after);
});
test('unchanged-state article bypass, two articles and weekend package admission are rejected', t => {
  const f = fixture(t); const h0 = f.article(); assert.notEqual(f.ci(h0).status, 0); assert.throws(() => f.review(h0), /canonical-owned-preparation/);
  f.prepare(); const h = f.article();
  f.git('checkout', 'article'); fs.writeFileSync(path.join(f.dir, 'news/second-unowned.html'), '<h1>Second unowned fixture</h1>'); const h2 = f.commit('two article bypass'); f.git('checkout', 'main');
  assert.throws(() => f.review(h2), /exactly-one/); assert.notEqual(f.ci(h2).status, 0);
  const inputs = f.snapshots(h); inputs.main.state.current.date = '2026-11-14'; assert.throws(() => planner.validateArticleReview(inputs), /weekday-slots/);
});
test('portable code uses the SAME full-history validator without Node runtime or write capabilities', t => {
  const context = vm.createContext({});
  const guardSource = fs.readFileSync(path.join(root, 'lib/daily-cycle-guards.cjs'), 'utf8');
  const planSource = fs.readFileSync(path.join(root, 'lib/publisher-write-plan.cjs'), 'utf8');
  context.guardSource = guardSource; context.planSource = planSource;
  vm.runInContext(`const g={exports:{}}; new Function('module','exports',guardSource)(g,g.exports); const p={exports:{}}; new Function('module','exports','require',planSource)(p,p.exports,name=>{if(name!=='./daily-cycle-guards.cjs')throw Error('denied'); return g.exports;}); globalThis.plan=p.exports;`, context);
  const canonical = clone(require('../automation/daily-cycle-state.json'));
  context.input = JSON.stringify({ expectedMain: 'a'.repeat(40), observedMain: 'a'.repeat(40), base: canonical, candidate: canonical, rules });
  assert.equal(vm.runInContext('plan.planStateWrite(JSON.parse(input)).kind', context), 'already-recorded');
  const lost = clone(canonical); lost.history.shift(); context.input = JSON.stringify({ expectedMain: 'a'.repeat(40), observedMain: 'a'.repeat(40), base: canonical, candidate: lost, rules });
  assert.throws(() => vm.runInContext('plan.planStateWrite(JSON.parse(input))', context), /history shrank/);
  assert.equal(vm.runInContext('typeof process', context), 'undefined'); assert.equal(vm.runInContext('typeof fetch', context), 'undefined');
});
test('actual reader adapters consume normalized connector shapes backed by the two real Git refs', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), io = f.readers();
  assert.equal((await planner.inspectArticleUsingGitHubTools({ ...io, prNumber: 990311 })).reviewHead, h);
  const p = f.checkpoint(h), done = await f.observe(p); f.acceptance(done);
  const plan = await planner.inspectArticleUsingGitHubTools({ ...io, prNumber: 990311, phase: 'release', decision: done });
  const proof = f.merge(plan), merged = f.readers({ merged: true, mergeCommit: proof.mergeCommit });
  const production = { commit: proof.mergeCommit, state: 'READY', url: '/news/order-fixture-1.html', articleVerified: true, imageVerified: true, listingVerified: true, homePlacementVerified: true, verifiedAt: stamp };
  const close = await planner.inspectLiveCloseoutUsingGitHubTools({ ...merged, prNumber: 990311, expectedMain: f.head(), production }); // fresh context: no saved plan/proof
  const write = await planner.inspectStateWriteUsingGitHubTools({ ...merged, expectedMain: f.head(), candidate: close.candidate });
  assert.equal(write.baseStateBlob, f.blob(f.head())); assert.equal(write.baseTree, f.git('rev-parse', `${f.head()}^{tree}`));
  const final = f.persist(JSON.parse(write.candidateJson), 'F through reader-bound immutable write plan');
  const stored = await planner.verifyStoredStateUsingGitHubTools({ ...merged, plan: write, commit: final }); assert.equal(stored.recorded, true);
  assert.equal((await planner.inspectLiveCloseoutUsingGitHubTools({ ...merged, prNumber: 990311, plan, expectedMain: f.head(), production })).kind, 'already-recorded');
  await assert.rejects(planner.inspectLiveCloseoutUsingGitHubTools({ ...merged, prNumber: 990312, plan, expectedMain: f.head(), production }), /pr-target/);
  assert.ok([...io.calls, ...merged.calls].every(call => ['fetch', 'file', 'pr'].includes(call.method)));
});
test('reader failures, wrong PR target and incomplete comparisons fail without any write', async t => {
  const f = fixture(t); f.prepare(); f.article(); const before = f.head();
  for (const options of [{ denied: true }, { truncated: true }, { prOverride: { base: 'other-branch' } }, { prOverride: { head_repo_full_name: 'other/repo' } }]) {
    await assert.rejects(planner.inspectArticleUsingGitHubTools({ ...f.readers(options), prNumber: 990311 }), /blocked|comparison|mismatch/);
    assert.equal(f.head(), before);
  }
});
test('same-head rerun after merge cannot replace the exact released run/job/attempt during closeout', async t => {
  const f = fixture(t); f.prepare(); const h = f.article(), p = f.checkpoint(h), done = await f.observe(p); f.acceptance(done);
  const plan = f.review(h, 'release', done), proof = f.merge(plan);
  const p2 = f.checkpoint(h, 1, 2), done2 = await f.observe(p2); f.acceptance(done2);
  assert.throws(() => f.close(plan, proof), /checkpoint-changed/);
});
test('exact staged bytes survive caller mutation and orphan commits never count as durable writes', async t => {
  const f = fixture(t); f.prepare(); const before = f.head(), next = f.state(); next.current.regularPublicationSlots[0].nextAction = 'Owned progress';
  const plan = planner.planStateWrite({ expectedMain: before, observedMain: before, base: f.state(), candidate: next, rules });
  next.history.length = 0; plan.candidate.history.length = 0;
  assert.notEqual(JSON.parse(plan.candidateJson).history.length, 0);
  f.git('checkout', '--detach', before); fs.writeFileSync(path.join(f.dir, STATE), plan.candidateJson); f.git('add', STATE);
  const object = f.git('commit-tree', f.git('write-tree'), '-p', before, '-m', 'created object; no ref movement yet');
  const io = f.readers(); await assert.rejects(planner.verifyStoredStateUsingGitHubTools({ ...io, plan, commit: object }), /not-canonical/);
  f.git('update-ref', 'refs/heads/main', object, before); f.git('checkout', 'main');
  // Simulate successful ref write followed by lost/malformed tool output.
  assert.equal((await planner.verifyStoredStateUsingGitHubTools({ ...io, plan, commit: object })).recorded, true);
  const retry = planner.planStateWrite({ expectedMain: object, observedMain: object, base: f.state(), candidate: JSON.parse(plan.candidateJson), rules });
  assert.equal(retry.kind, 'already-recorded'); assert.equal(f.git('rev-list', '--count', `${before}..main`), '1');
});
test('wrong-origin URL, false prepublication count and full existing capacity fail before article admission', t => {
  const f = fixture(t); f.prepare(); const h = f.article(), inputs = f.snapshots(h);
  inputs.main.state.current.regularPublicationSlots[0].url = 'https://elsewhere.invalid/news/order-fixture-1.html';
  assert.throws(() => planner.validateArticleReview(inputs), /noncanonical-article-url/);
  const base = f.state(), proposed = clone(base); proposed.current.publications.push({ type: 'article', url: base.current.regularPublicationSlots[0].url }); proposed.current.fullArticleCount++;
  assert.throws(() => planner.planStateWrite({ expectedMain: f.head(), observedMain: f.head(), base, candidate: proposed, rules }), /matching sequential verified/);
  const full = f.snapshots(h); full.main.state.current.publications = [1, 2, 3, 4, 5].map(n => ({ type: 'article', url: `/news/prior-${n}.html` })); full.main.state.current.fullArticleCount = 5;
  assert.throws(() => planner.validateArticleReview(full), /cap-already-reached/);
});
test('portable URL normalization preserves all actual117 historical publication identities', () => {
  const state = require('../automation/daily-cycle-state.json');
  const urls = [state.current, ...state.history].flatMap(day => (day.publications || []).map(value => value.url));
  for (const value of [...urls, '/news/a.html', 'https://CREDITUNIONAINEWS.COM:443/news/a.html', '/news/../news/a.html']) assert.equal(guards.canonicalPublicationUrl(value), new URL(value, 'https://creditunionainews.com').href);
  assert.equal(guards.isDeepStrictEqual(Array(2), []), false);
});
test('controlling policy loads the pinned actual guard/planner through the read-only ordinary-runtime binding', async () => {
  const policy = fs.readFileSync(path.join(root, 'automation/scheduled-tasks/publish-cuai-daily-article.md'), 'utf8');
  const start = policy.indexOf('async function loadPublisherWritePlanner('), end = policy.indexOf('\n```', start);
  assert.ok(start > 0 && end > start); const source = policy.slice(start, end);
  const calls = [], sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const tools = { mcp__codex_apps__github_fetch_file: async args => {
    calls.push(args); assert.equal(args.ref, sourceCommit); assert.equal(args.repository_full_name, 'thomaschurchadams-eng/work-feel');
    assert.ok(['lib/daily-cycle-guards.cjs', 'lib/publisher-write-plan.cjs'].includes(args.path));
    return { structuredContent: { sha: execFileSync('git', ['hash-object', args.path], { cwd: root, encoding: 'utf8' }).trim(), encoding: 'utf-8', content: fs.readFileSync(path.join(root, args.path), 'utf8') } };
  } };
  const context = vm.createContext({ tools, sourceCommit }); vm.runInContext(source, context);
  const loaded = await vm.runInContext('loadPublisherWritePlanner(tools,sourceCommit)', context);
  assert.equal(typeof loaded.inspectStateWriteUsingGitHubTools, 'function'); assert.equal(typeof loaded.inspectLiveCloseoutUsingGitHubTools, 'function');
  assert.equal(calls.length, 2); assert.equal(vm.runInContext('typeof URL', context), 'undefined'); assert.equal(vm.runInContext('typeof process', context), 'undefined');
  context.tools = { mcp__codex_apps__github_fetch_file: async () => ({ structuredContent: { sha: '0'.repeat(40), encoding: 'utf-8', content: 'throw Error("must not execute")' } }) };
  await assert.rejects(vm.runInContext('loadPublisherWritePlanner(tools,sourceCommit)', context), /source-unavailable-or-mismatched/);
});
test('stored-state ancestry permission and rate-limit denials retain exact category and target', async t => {
  const f = fixture(t); f.prepare(); const before = f.head(), proposed = f.state(); proposed.current.regularPublicationSlots[0].nextAction = 'Owned next review';
  const plan = planner.planStateWrite({ expectedMain: before, observedMain: before, base: f.state(), candidate: proposed, rules });
  const commit = f.persist(JSON.parse(plan.candidateJson), 'stored-state denial fixture'); const io = f.readers();
  const suffix = `/compare/${commit}...${commit}`;
  for (const [code, category] of [['FORBIDDEN', 'permission'], ['RATE_LIMITED', 'rate-limit']]) {
    const tools = { ...io.tools, mcp__codex_apps__github_fetch: async args => args.url.endsWith(suffix) ? { isError: true, structuredContent: { error_code: code } } : io.tools.mcp__codex_apps__github_fetch(args) };
    await assert.rejects(planner.verifyStoredStateUsingGitHubTools({ ...io, tools, plan, commit }), error => error.code === category && error.target === `thomaschurchadams-eng/work-feel${suffix}`);
    assert.equal(f.head(), commit);
  }
});
