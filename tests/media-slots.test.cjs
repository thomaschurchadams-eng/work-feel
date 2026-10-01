const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateSchedule, checkCapacity, selectSlot: actualSelectSlot, mediaReady: actualMediaReady, preparedInTime, testValid } = require('../lib/media-slots.cjs');
const policy = require('../automation/media-policy.json');
const now = Date.parse('2026-10-05T12:00:00Z');
const timingNow = Date.parse('2026-10-19T12:00:00Z');
const selectSlot = args => actualSelectSlot({ ...args, now });
const mediaReady = (asset, date) => actualMediaReady(asset, date, now);
const queueItem = (id, date, status = 'queued') => ({ id, platform: 'linkedin', scheduledFor: date + 'T11:30:00-04:00', status, articleUrl: 'https://creditunionainews.com/news/' + id + '.html' });
const asset = { id: 'chart-2026-10-06', format: 'chart', targetDate: '2026-10-06', status: 'published', preparedAt: '2026-10-02T16:00:00Z', sourceVerified: true, sourceURLs: ['https://www.filene.org/reports/the-new-money-movement-landscape'], rightsVerified: true, accessibilityVerified: true, productionVerified: true, canonicalUrl: 'https://creditunionainews.com/news/chart.html', thumbnailUrl: 'https://creditunionainews.com/assets/media-chart.png', altText: 'Verified data chart', parentPublicationId: 'source-story' };
const timedPolicy = () => ({ ...policy, timingTest: { ...policy.timingTest, status: 'active', baselineValidatedObservations: 3, format: 'chart', assignments: structuredClone(policy.timingTest.assignments) } });
const timingItem = { contentKind: 'media', mediaFormat: 'chart', timingExperimentId: 'cuai-timing-media-2026-10-20' };

test('default is exact midday, not arbitrary hours or weekends; DST remains Eastern', () => {
  assert.equal(validateSchedule('2026-10-06T11:30:00-04:00', {}, policy, now).date, '2026-10-06');
  for (const at of ['2026-10-06T10:00:00-04:00', '2026-10-06T11:30:01-04:00', '2026-10-06T11:31:00-04:00', '2026-10-10T11:30:00-04:00', '2026-10-06T25:30:00-04:00']) assert.ok(validateSchedule(at, {}, policy, now).error);
  assert.equal(validateSchedule('2026-11-02T12:30:00-05:00', {}, policy, Date.parse('2026-11-02T13:00:00Z')).date, '2026-11-02');
});
test('invalid date, advance boundaries and distant reservations fail closed', () => {
  for (const at of ['2026-02-30T11:30:00-05:00', '2026-10-06', '2026-10-05T12:30:00-04:00']) assert.ok(validateSchedule(at, {}, policy, Date.parse('2026-10-05T16:29:00Z')).error);
  assert.equal(validateSchedule('2026-10-15T11:30:00-04:00', {}, policy, now).error, 'scheduled_for_too_far_ahead');
});
test('morning requires exact experiment, format, date, time and completed baseline', () => {
  const p = timedPolicy(); assert.equal(testValid(p.timingTest), true);
  assert.equal(validateSchedule('2026-10-20T10:00:00-04:00', timingItem, p, timingNow).date, '2026-10-20');
  for (const item of [{}, { ...timingItem, mediaFormat: 'podcast' }, { ...timingItem, timingExperimentId: 'other' }, { ...timingItem, contentKind: 'article' }]) assert.ok(validateSchedule('2026-10-20T10:00:00-04:00', item, p, timingNow).error);
  assert.ok(validateSchedule('2026-10-21T10:00:00-04:00', timingItem, p, timingNow).error);
  p.timingTest.baselineValidatedObservations = 2; assert.ok(validateSchedule('2026-10-20T10:00:00-04:00', timingItem, p, timingNow).error);
});
test('test allowlist rejects broad time, duplicate dates, unbalanced arms and oversized window', () => {
  for (const mutate of [p => p.assignments[0].time = '09:00', p => p.assignments[1].date = p.assignments[0].date, p => p.assignments[0].time = '12:30', p => p.endsOn = '2026-12-01', p => p.assignments.pop()]) { const p = timedPolicy().timingTest; mutate(p); assert.equal(testValid(p), false); }
});
test('news and media share one immutable daily reservation, including planned and blocked', () => {
  for (const status of ['planned', 'queued', 'scheduled', 'sending', 'sent', 'blocked']) {
    const q = [queueItem('existing', '2026-10-06', status)], before = JSON.stringify(q);
    assert.deepEqual(selectSlot({ date: '2026-10-06', queue: q, media: [asset], articles: [{ id: 'urgent', eligible: true, classification: 'High' }] }), { status: 'reserved', itemId: 'existing' });
    assert.equal(JSON.stringify(q), before);
  }
});
test('weekly cap includes externally created provider posts and does not count receipts twice', () => {
  const providers = ['05', '07', '08', '09', '10'].map(d => ({ id: d, status: 'sent', sentAt: '2026-10-' + d + 'T16:30:00Z' }));
  assert.equal(checkCapacity('2026-10-06', [], providers).error, 'linkedin_weekly_cap_conflict');
  const q = [{ ...queueItem('q', '2026-10-05'), postId: 'p' }];
  assert.equal(checkCapacity('2026-10-06', q, [{ id: 'p', status: 'scheduled', dueAt: q[0].scheduledFor }]).ok, true);
  assert.equal(checkCapacity('2026-10-06', [queueItem('self', '2026-10-06')], [], 'self').ok, true);
  assert.equal(checkCapacity('2026-10-06', [], [{ id: 'external', status: 'scheduled', dueAt: '2026-10-06T15:30:00Z' }]).error, 'linkedin_daily_cap_conflict');
  assert.throws(() => checkCapacity('2026-10-06', q, [{ id: 'p', status: 'scheduled', dueAt: '2026-10-07T15:30:00Z' }]), /mismatch/);
});
test('business-day preparation includes weekend crossing and rejects one-day preparation', () => {
  assert.equal(preparedInTime(asset, '2026-10-06'), true);
  assert.equal(preparedInTime({ ...asset, preparedAt: '2026-10-05T12:00:00Z' }, '2026-10-06'), false);
  assert.equal(preparedInTime({ ...asset, preparedAt: '2026-10-06T12:00:00Z' }, '2026-10-06'), false);
});
test('media selection requires source, rights, accessible content, valid destination and live production', () => {
  assert.equal(mediaReady(asset, '2026-10-06'), true);
  for (const changed of [{ sourceVerified: false }, { sourceURLs: [] }, { sourceURLs: ['http://localhost/private'] }, { preparedAt: '2026-10-07T12:00:00Z' }, { rightsVerified: false }, { accessibilityVerified: false }, { productionVerified: false }, { canonicalUrl: 'https://other.example/' }, { thumbnailUrl: 'https://creditunionainews.com/assets/chart.svg' }, { status: 'planned' }]) assert.equal(mediaReady({ ...asset, ...changed }, '2026-10-06'), false);
  assert.equal(mediaReady(asset, '2026-10-20'), false);
});
test('prepare intent holds a slot; production promotion preserves exact ID and metadata', () => {
  const ready = { ...asset, status: 'ready', productionVerified: false };
  assert.equal(selectSlot({ date: '2026-10-06', queue: [], media: [ready] }).status, 'prepared-selection');
  const q = [{ ...queueItem('immutable', '2026-10-06', 'planned'), contentKind: 'media', mediaAssetId: asset.id, mediaFormat: asset.format, articleUrl: asset.canonicalUrl, imageUrl: asset.thumbnailUrl, imageAlt: asset.altText }];
  assert.deepEqual(selectSlot({ date: '2026-10-06', queue: q, media: [asset] }), { status: 'ready-to-queue', itemId: 'immutable' });
  assert.equal(selectSlot({ date: '2026-10-06', queue: q, media: [{ ...asset, thumbnailUrl: 'https://creditunionainews.com/assets/replaced.png' }] }).status, 'reserved');
  assert.equal(q[0].status, 'planned');
});
test('selection is idempotent and duplicates/adaptations cannot create another promotion', () => {
  const args = { date: '2026-10-06', queue: [], media: [asset] };
  assert.deepEqual(selectSlot(args), selectSlot(args));
  for (const q of [[{ ...queueItem('old', '2026-10-05'), articleUrl: asset.canonicalUrl }], [{ ...queueItem('old', '2026-10-05'), parentPublicationId: asset.parentPublicationId }]]) assert.equal(selectSlot({ ...args, queue: q }).status, 'no-qualified-selection');
});
test('qualified urgent news wins; media competes before Library without padding', () => {
  const article = { id: 'news', canonicalUrl: 'https://creditunionainews.com/news/new.html', eligible: true, classification: 'High' };
  assert.equal(selectSlot({ date: '2026-10-06', queue: [], media: [asset], articles: [article] }).assetId, 'news');
  assert.equal(selectSlot({ date: '2026-10-06', queue: [], media: [asset], articles: [{ ...article, classification: 'Library' }] }).assetId, asset.id);
  assert.equal(selectSlot({ date: '2026-10-06', queue: [], media: [], articles: [{ ...article, eligible: false }] }).status, 'no-qualified-selection');
});
test('X stays blocked, baseline inactive and budget arithmetic separates remaining from ceiling', () => {
  assert.equal(policy.distribution.x.status, 'blocked'); assert.equal(policy.timingTest.status, 'planned'); assert.equal(testValid(policy.timingTest), false); assert.equal(policy.timingTest.assignments.length, 8);
  assert.equal(policy.budget.observedAllowanceIncludingRollover - policy.budget.observedUsedCredits, policy.budget.observedRemainingCredits);
  assert.equal(policy.budget.recurringMonthlyCreditCeiling - policy.budget.plannedMonthlySpeechBaseline, 8694);
  const source = fs.readFileSync(require.resolve('../api/buffer-schedule-image.js'), 'utf8');
  assert.match(source, /queue_item_not_linkedin/); assert.match(source, /linkedin_channel_identity_mismatch/); assert.match(source, /checkCapacity/);
});

// Exercise the existing executor with in-memory provider fixtures: no credentials,
// network calls, queued actions or provider changes occur in this test.
function endpointFixture({ changes = {}, providerPosts = [], channelId = policy.distribution.channelId } = {}) {
  const vm = require('node:vm'), path = require('node:path');
  const item = { ...queueItem('linkedin-media-chart', '2026-10-06'), contentKind: 'media', mediaAssetId: asset.id, mediaFormat: 'chart', articleUrl: asset.canonicalUrl, imageUrl: asset.thumbnailUrl, imageAlt: asset.altText, copy: 'Verified chart for a material credit union decision https://creditunionainews.com/news/chart.html', distributionUrl: asset.canonicalUrl, ...changes };
  const calls = [], module = { exports: {} };
  const script = fs.readFileSync(require.resolve('../api/buffer-schedule-image.js'), 'utf8');
  const fixtureFs = { readFileSync: p => p.endsWith('social-queue.json') ? JSON.stringify({ items: [item] }) : p.endsWith('media-manifest.json') ? JSON.stringify({ assets: [asset] }) : (() => { throw Error('unexpected read'); })() };
  vm.runInNewContext(script, { module, require: p => p.endsWith('operations-auth') ? { authorize: async () => true } : p === 'node:fs' ? fixtureFs : p === 'node:path' ? path : p.endsWith('media-policy.json') ? policy : p.endsWith('media-slots.cjs') ? { validateSchedule: (raw, item) => validateSchedule(raw, item, policy, now), checkCapacity, mediaReady } : (() => { throw Error('unexpected require'); })(), process: { cwd: () => '/fixture', env: { BUFFER_API_KEY: 'fixture-only', VERCEL_GIT_COMMIT_SHA: 'fixture-sha' } }, URL, Date, Intl, Set, fetch: async (url, options) => {
    calls.push({ url, body: options?.body ? JSON.parse(options.body) : null });
    if (url !== 'https://api.buffer.com') return { ok: true, url, text: async () => '<meta property="og:title" content="Verified chart">', headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    const q = JSON.parse(options.body).query;
    const data = q.includes('createPost') ? { createPost: { post: { id: 'receipt-1', status: 'scheduled', assets: [{ mimeType: 'image/png', source: asset.thumbnailUrl }] } } } : q.includes('channels(') ? { channels: [{ id: channelId, displayName: 'CreditUnionAI News', service: 'linkedin', isQueuePaused: false }] } : q.includes('posts(') ? { posts: { edges: providerPosts.map(node => ({ node })) } } : { account: { organizations: [{ id: 'fixture-org' }] } };
    return { ok: true, json: async () => ({ data }) };
  } });
  const response = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { run: () => module.exports({ method: 'POST', body: { itemId: item.id, commitSha: 'fixture-sha' } }, response), response, calls };
}
test('existing executor schedules one verified media image/link and returns its actual fixture receipt', async () => {
  const f = endpointFixture(); await f.run(); assert.equal(f.response.statusCode, 201); assert.equal(f.response.body.postId, 'receipt-1');
  const mutations = f.calls.filter(c => c.body?.query?.includes('createPost')); assert.equal(mutations.length, 1); assert.equal(mutations[0].body.variables.input.channelId, policy.distribution.channelId); assert.equal(mutations[0].body.variables.input.assets[0].image.url, asset.thumbnailUrl);
});
test('executor rejects X, unverified media, wrong exact destination and conflicts before mutation', async () => {
  for (const config of [{ changes: { platform: 'x' } }, { changes: { imageAlt: 'altered asset' } }, { changes: { status: 'planned' } }, { channelId: 'different-channel' }, { providerPosts: [{ id: 'other', status: 'scheduled', dueAt: '2026-10-06T15:30:00Z', text: 'other' }] }]) {
    const f = endpointFixture(config); await f.run(); assert.ok(f.response.statusCode >= 400); assert.equal(f.calls.filter(c => c.body?.query?.includes('createPost')).length, 0);
  }
});

test('an existing receipt cannot create another provider post on an ambiguous retry', async () => {
  const f = endpointFixture({ changes: { postId: 'prior-receipt' } }); await f.run();
  assert.equal(f.response.body.error, 'queue_item_existing_receipt_requires_reconciliation');
  assert.equal(f.calls.filter(c => c.body?.query?.includes('createPost')).length, 0);
});

test('calendar and crossover match the enabled coordinator exactly', () => {
  assert.equal(policy.mediaCadence.visual.intervalDays, 7);
  assert.deepEqual(policy.timingTest.assignments, [
    {date:'2026-10-20',time:'10:00'},{date:'2026-10-22',time:'11:30'},
    {date:'2026-10-27',time:'11:30'},{date:'2026-10-29',time:'10:00'},
    {date:'2026-11-03',time:'11:30'},{date:'2026-11-05',time:'10:00'},
    {date:'2026-11-10',time:'10:00'},{date:'2026-11-12',time:'11:30'}]);
  const shifted=timedPolicy().timingTest; shifted.assignments[0].date='2026-10-19'; assert.equal(testValid(shifted),false);
});
