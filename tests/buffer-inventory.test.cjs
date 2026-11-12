const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { readInventory } = require('../lib/buffer-inventory.cjs');
const policy = require('../automation/media-policy.json');
const now = Date.parse('2026-11-11T22:00:00Z');
const channel = { id: policy.distribution.channelId, displayName: 'CreditUnionAI News', service: 'linkedin', isQueuePaused: false };
const identity = { channel, organizationId: 'fixture-org', commitSha: 'a'.repeat(40) };
const post = (id = 'p1', overrides = {}) => ({ id, channelId: channel.id, status: 'scheduled', text: 'Useful story https://creditunionainews.com/news/example.html?utm_source=linkedin', dueAt: '2026-11-12T16:30:00Z', sentAt: null, metadata: null, ...overrides });
const linkedin = (overrides = {}) => ({ __typename: 'LinkedInPostMetadata', firstComment: null, linkAttachment: null, ...overrides });
const page = (posts = [], hasNextPage = false, endCursor = null) => ({ posts: { edges: posts.map(node => ({ node })), pageInfo: { hasNextPage, endCursor } } });
function pagesFixture(pages) {
  const calls = [];
  return { calls, request: async (query, variables, signal) => {
    assert.match(query, /^query BufferReservationInventory/); assert.doesNotMatch(query, /mutation|createPost|updatePost|deletePost/);
    assert.match(query, /filter: \{ channelIds: \[\$channelId\] \}/); assert.doesNotMatch(query, /status: \[|startDate|endDate/);
    assert.equal(variables.channelId, channel.id); assert.equal(variables.organizationId, 'fixture-org'); assert.ok(signal instanceof AbortSignal);
    calls.push({ query, variables });
    const response = pages[calls.length - 1]; if (response instanceof Error) throw response;
    return response;
  } };
}

test('enumerates beyond the first 100 with opaque cursors and all statuses, without date filtering', async () => {
  const first = Array.from({ length: 100 }, (_, i) => post('p' + i));
  const cursor = 'opaque"cursor/+=do-not-parse';
  const f = pagesFixture([page(first, true, cursor), page([
    post('late-conflict', { dueAt: '2026-11-13T17:30:00Z' }),
    post('already-sent', { status: 'sent', dueAt: null, sentAt: '2026-11-10T16:30:00Z' }),
    post('draft', { status: 'draft', dueAt: null }),
    post('approval', { status: 'needs_approval' }),
    post('failed', { status: 'error' }), post('sending', { status: 'sending' })
  ])]);
  const r = await readInventory(f.request, identity, () => now);
  assert.equal(r.complete, true); assert.equal(r.pagesRead, 2); assert.equal(r.recordCount, 106);
  assert.deepEqual(f.calls.map(c => c.variables.after), [null, cursor]);
  assert.equal(r.records[100].id, 'late-conflict'); assert.equal(r.records[101].sentAt, '2026-11-10T16:30:00Z');
  assert.equal(r.requiresReview, true); assert.equal(r.commitSha, identity.commitSha); assert.equal(r.channelId, channel.id);
  assert.equal(r.observedAt, '2026-11-11T22:00:00.000Z'); assert.match(r.consistency, /not an atomic reservation/);
});
test('empty terminal page is a complete observation, never an automatic reservation', async () => {
  const f = pagesFixture([page()]); const r = await readInventory(f.request, identity, () => now);
  assert.equal(r.complete, true); assert.equal(r.recordCount, 0); assert.equal(r.requiresReview, false);
  assert.equal(r.pagesRead, 1); assert.equal(r.status, undefined); assert.equal(r.availableSlots, undefined);
});
test('missing, truncated, oversized or malformed pages never become empty success', async () => {
  for (const value of [undefined, {}, { posts: null }, { posts: { edges: [] } }, { posts: { edges: [], pageInfo: { hasNextPage: 'false' } } }, page(Array.from({ length: 101 }, (_, i) => post(String(i))))]) {
    const f = pagesFixture([value]); const r = await readInventory(f.request, identity, () => now);
    assert.equal(r.complete, false); assert.equal(r.requiresReview, true); assert.equal(r.error, 'inventory_page_invalid');
  }
});
test('missing/repeated cursor, empty continuation and duplicate IDs fail closed with partial evidence', async () => {
  for (const responses of [
    [page([post()], true)], [page([], true, 'next')],
    [page([post('a')], true, 'same'), page([post('b')], true, 'same')],
    [page([post('a')], true, 'next'), page([post('a')])],
    [page([post('a')], true, 'next'), page([post('a', { dueAt: '2026-11-13T17:30:00Z' })])]
  ]) {
    const f = pagesFixture(responses); const r = await readInventory(f.request, identity, () => now);
    assert.equal(r.complete, false); assert.equal(r.requiresReview, true);
    assert.match(r.error, /inventory_(cursor_invalid|duplicate_post)/);
  }
});
test('page limit is explicit and does not silently treat a large channel as complete', async () => {
  const f = pagesFixture(Array.from({ length: 10 }, (_, i) => page([post('p' + i)], true, 'cursor-' + i)));
  const r = await readInventory(f.request, identity, () => now);
  assert.equal(f.calls.length, 10); assert.equal(r.recordCount, 10); assert.equal(r.complete, false); assert.equal(r.error, 'inventory_page_limit');
});
test('provider, rate-limit, auth and timeout failures retain explicit incomplete status without retry', async () => {
  for (const [error, expected] of [[Error('sensitive upstream error'), 'inventory_provider_error'], [Object.assign(Error('rate'), { status: 429 }), 'inventory_rate_limited'], [Object.assign(Error('credential'), { status: 401 }), 'inventory_authentication_failed'], [Object.assign(Error('timeout'), { name: 'TimeoutError' }), 'inventory_timeout']]) {
    const f = pagesFixture([page([post()], true, 'next'), error]); const r = await readInventory(f.request, identity, () => now);
    assert.equal(f.calls.length, 2); assert.equal(r.complete, false); assert.equal(r.requiresReview, true); assert.equal(r.error, expected); assert.equal(r.recordCount, 1);
    assert.doesNotMatch(JSON.stringify(r), /sensitive upstream error|credential/);
  }
  let at = now; const f = pagesFixture([page([post()])]);
  const r = await readInventory(async (...args) => { const value = await f.request(...args); at += 10001; return value; }, identity, () => at);
  assert.equal(r.complete, false); assert.equal(r.error, 'inventory_timeout');
});
test('wrong identity is rejected before any inventory query', async () => {
  for (const changes of [{ channel: { ...channel, id: 'other' } }, { channel: { ...channel, service: 'linkedin-personal' } }, { channel: { ...channel, displayName: 'Other company' } }, { commitSha: '' }, { organizationId: null }]) {
    const f = pagesFixture([page()]); const r = await readInventory(f.request, { ...identity, ...changes }, () => now);
    assert.equal(r.error, 'inventory_identity_invalid'); assert.equal(r.complete, false); assert.equal(f.calls.length, 0);
  }
});
test('ambiguous records, wrong channel, impossible dates and unknown statuses cannot clear coverage', async () => {
  for (const changes of [{ id: '' }, { channelId: 'other' }, { status: 'new-provider-state' }, { dueAt: null }, { dueAt: '2026-02-30T12:00:00Z' }, { dueAt: '2026-11-12' }, { sentAt: undefined }, { status: 'sent', sentAt: null }, { status: 'sent', sentAt: '2026-11-12T12:00:00Z' }, { text: null }]) {
    const f = pagesFixture([page([post('bad', changes)])]); const r = await readInventory(f.request, identity, () => now);
    assert.equal(r.complete, false); assert.equal(r.error, 'inventory_record_invalid'); assert.equal(r.requiresReview, true);
  }
});
test('inventory minimizes content and flags unknown destinations and paused/unknown queue state', async () => {
  const f = pagesFixture([page([post('private', { text: 'PRIVATE DRAFT person@example.com https://outside.example/private?token=SECRET https://creditunionainews.com/person%40example.com https://creditunionainews.com/news/example.html?token=SECRET#private' })])]);
  const r = await readInventory(f.request, identity, () => now);
  assert.deepEqual(r.records[0].canonicalUrls, ['https://creditunionainews.com/news/example.html']);
  assert.equal(r.records[0].requiresReview, true); assert.equal(r.requiresReview, true);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE|person@|outside.example|SECRET/);
  for (const isQueuePaused of [true, undefined]) {
    const paused = await readInventory(pagesFixture([page()]).request, { ...identity, channel: { ...channel, isQueuePaused } }, () => now);
    assert.equal(paused.complete, true); assert.equal(paused.requiresReview, true);
  }
  const unknown = await readInventory(pagesFixture([page([post('no-url', { text: 'https://buff.ly/unknown' })])]).request, identity, () => now);
  assert.equal(unknown.records[0].requiresReview, true);
});
test('a recognized CUAI link cannot hide a second unresolved destination', async () => {
  const known = 'https://creditunionainews.com/news/a.html';
  for (const unresolved of ['https://buff.ly/unknown', 'http://buff.ly/unknown', 'www.buff.ly/unknown', 'https://[invalid', 'https://creditunionainews.com/person%40example.com', 'https://user:SECRET@creditunionainews.com/news/b.html']) {
    for (const text of [`${known} plus ${unresolved}`, `${unresolved} plus ${known}`]) {
      const f = pagesFixture([page([post('mixed', { text })])]);
      const r = await readInventory(f.request, identity, () => now);
      assert.equal(r.complete, true); assert.equal(r.records[0].requiresReview, true, text); assert.equal(r.requiresReview, true);
      assert.deepEqual(r.records[0].canonicalUrls, [known]); assert.equal(f.calls.length, 1);
      assert.doesNotMatch(JSON.stringify(r), /buff\.ly|invalid|person%40|SECRET|plus/);
    }
  }
  const valid = await readInventory(pagesFixture([page([post('known', { text: `${known}?utm_source=linkedin ${known}#summary https://creditunionainews.com/news/b.html` })])]).request, identity, () => now);
  assert.equal(valid.complete, true); assert.equal(valid.requiresReview, false); assert.equal(valid.records[0].requiresReview, false);
  assert.deepEqual(valid.records[0].canonicalUrls, [known, 'https://creditunionainews.com/news/b.html']);
});
test('reads body, first-comment and attachment-only destinations through the documented metadata union', async () => {
  const url = 'https://creditunionainews.com/news/a.html';
  for (const fields of [
    { text: url, metadata: null },
    { text: 'Read our coverage', metadata: linkedin({ firstComment: `Full story ${url}?utm_source=linkedin#summary` }) },
    { text: 'Read our coverage', metadata: linkedin({ linkAttachment: { url, expandedUrl: null } }) },
    { text: url, metadata: linkedin({ firstComment: url, linkAttachment: { url: `${url}?utm_source=linkedin`, expandedUrl: url } }) }
  ]) {
    const f = pagesFixture([page([post('destination', fields)])]);
    const r = await readInventory(f.request, identity, () => now);
    assert.equal(r.complete, true); assert.equal(r.requiresReview, false);
    assert.deepEqual(r.records[0].canonicalUrls, [url]); assert.equal(f.calls.length, 1);
    assert.match(f.calls[0].query, /metadata\s*\{\s*__typename\s*\.\.\. on LinkedInPostMetadata\s*\{\s*firstComment\s*linkAttachment\s*\{\s*url\s+expandedUrl/);
    assert.doesNotMatch(f.calls[0].query, /externalLink/);
  }
});
test('expandedUrl is evidence only for its paired attachment, never a separate body or comment link', async () => {
  const url = 'https://creditunionainews.com/news/a.html';
  const attachment = { url: 'https://buff.ly/paired', expandedUrl: url };
  const resolved = await readInventory(pagesFixture([page([post('attached', { text: 'Read our coverage', metadata: linkedin({ linkAttachment: attachment }) })])]).request, identity, () => now);
  assert.equal(resolved.complete, true); assert.equal(resolved.requiresReview, false);
  assert.deepEqual(resolved.records[0].canonicalUrls, [url]);
  for (const other of ['https://buff.ly/unrelated', 'https://buff.ly/paired']) {
    for (const fields of [{ text: other, metadata: linkedin({ linkAttachment: attachment }) }, { text: 'Read our coverage', metadata: linkedin({ firstComment: other, linkAttachment: attachment }) }]) {
      const r = await readInventory(pagesFixture([page([post('separate', fields)])]).request, identity, () => now);
      assert.equal(r.complete, true); assert.equal(r.requiresReview, true); assert.equal(r.records[0].requiresReview, true);
      assert.deepEqual(r.records[0].canonicalUrls, [url]); assert.doesNotMatch(JSON.stringify(r), /buff\.ly/);
    }
  }
});
test('conflicting or unresolved attachment pairs retain review and every recognized candidate', async () => {
  const a = 'https://creditunionainews.com/news/a.html', b = 'https://creditunionainews.com/news/b.html';
  for (const [linkAttachment, expected] of [
    [{ url: a, expandedUrl: b }, [a, b]],
    [{ url: a, expandedUrl: 'https://foreign.example/private' }, [a]],
    [{ url: 'https://buff.ly/unresolved', expandedUrl: null }, []],
    [{ url: 'https://foreign.example/a', expandedUrl: 'https://foreign.example/b' }, []],
    [{ url: 'https://[bad', expandedUrl: a }, [a]],
    [{ url: `https://user:SECRET@creditunionainews.com/news/a.html`, expandedUrl: a }, [a]]
  ]) {
    const r = await readInventory(pagesFixture([page([post('pair', { text: '', metadata: linkedin({ linkAttachment }) })])]).request, identity, () => now);
    assert.equal(r.complete, true); assert.equal(r.requiresReview, true); assert.equal(r.records[0].requiresReview, true);
    assert.deepEqual(r.records[0].canonicalUrls, expected); assert.doesNotMatch(JSON.stringify(r), /foreign\.example|buff\.ly|SECRET|\[bad/);
  }
});
test('malformed or omitted metadata stays reviewable; explicit null is a valid absence', async () => {
  for (const metadata of [undefined, [], 'bad', {}, { __typename: 'OtherPostMetadata' }, linkedin({ firstComment: 42 }), linkedin({ firstComment: undefined }), linkedin({ firstComment: 'a'.repeat(100001) }), linkedin({ linkAttachment: [] }), linkedin({ linkAttachment: undefined }), linkedin({ linkAttachment: {} }), linkedin({ linkAttachment: { url: null, expandedUrl: null } }), linkedin({ linkAttachment: { url: 'https://creditunionainews.com/news/a.html', expandedUrl: 42 } })]) {
    const r = await readInventory(pagesFixture([page([post('bad-meta', { metadata })])]).request, identity, () => now);
    assert.equal(r.complete, true); assert.equal(r.requiresReview, true); assert.equal(r.records[0].requiresReview, true);
    assert.ok(r.records[0].canonicalUrls.includes('https://creditunionainews.com/news/example.html'));
  }
  for (const metadata of [null, linkedin()]) {
    const known = await readInventory(pagesFixture([page([post('known', { metadata })])]).request, identity, () => now);
    assert.equal(known.requiresReview, false);
    const absent = await readInventory(pagesFixture([page([post('none', { text: '', metadata })])]).request, identity, () => now);
    assert.equal(absent.requiresReview, true); assert.deepEqual(absent.records[0].canonicalUrls, []);
  }
});
test('metadata output is redacted, and a service permalink is not an article destination', async () => {
  const r = await readInventory(pagesFixture([page([post('redact', { text: 'PRIVATE BODY', externalLink: 'https://creditunionainews.com/news/not-a-destination.html', metadata: linkedin({ firstComment: 'PRIVATE COMMENT person@example.com https://foreign.example/private?token=SECRET https://creditunionainews.com/news/a.html?token=SECRET#private', linkAttachment: { url: 'https://buff.ly/paired?token=SECRET', expandedUrl: 'https://creditunionainews.com/news/b.html?token=SECRET#private', title: 'PRIVATE TITLE' } }) })])]).request, identity, () => now);
  assert.deepEqual(r.records[0].canonicalUrls, ['https://creditunionainews.com/news/a.html', 'https://creditunionainews.com/news/b.html']);
  assert.equal(r.requiresReview, true);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE|person@|foreign\.example|buff\.ly|SECRET|not-a-destination|firstComment|linkAttachment/);
  const permalinkOnly = await readInventory(pagesFixture([page([post('permalink', { text: '', externalLink: 'https://www.linkedin.com/feed/update/example', metadata: null })])]).request, identity, () => now);
  assert.deepEqual(permalinkOnly.records[0].canonicalUrls, []); assert.equal(permalinkOnly.requiresReview, true);
});
test('metadata destinations survive pagination beyond the first 100 without extra requests', async () => {
  const f = pagesFixture([page(Array.from({ length: 100 }, (_, i) => post(`p${i}`)), true, 'next'), page([
    post('comment', { text: '', metadata: linkedin({ firstComment: 'https://creditunionainews.com/news/comment.html' }) }),
    post('attachment', { text: '', metadata: linkedin({ linkAttachment: { url: 'https://buff.ly/paired', expandedUrl: 'https://creditunionainews.com/news/attachment.html' } }) })
  ])]);
  const r = await readInventory(f.request, identity, () => now);
  assert.equal(r.complete, true); assert.equal(r.requiresReview, false); assert.equal(r.recordCount, 102); assert.equal(f.calls.length, 2);
  assert.deepEqual(r.records[100].canonicalUrls, ['https://creditunionainews.com/news/comment.html']);
  assert.deepEqual(r.records[101].canonicalUrls, ['https://creditunionainews.com/news/attachment.html']);
});

function endpointFixture({ authorized = true, commitSha = identity.commitSha, channels = [channel], inventory = [page()], metricFailure = false } = {}) {
  const calls = [], module = { exports: {} }; let pageIndex = 0, queueReads = 0;
  const queue = JSON.stringify({ items: [] });
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/buffer-metrics.js'), 'utf8'), {
    module, URL, Date, Set, Map,
    process: { cwd: () => '/fixture', env: { BUFFER_API_KEY: 'fixture-only', VERCEL_GIT_COMMIT_SHA: identity.commitSha } },
    require: p => p.endsWith('operations-auth') ? { authorize: async (req, res) => { if (!authorized) res.status(401).json({ ok: false, error: 'unauthorized' }); return authorized; } }
      : p === 'node:fs' ? { readFileSync: p => { assert.equal(p, '/fixture/automation/social-queue.json'); queueReads++; return queue; } }
      : p === 'node:path' ? path : p.endsWith('buffer-inventory.cjs') ? { readInventory: (request, id) => readInventory(request, id, () => now) }
      : p.endsWith('media-policy.json') ? policy : (() => { throw Error('Unexpected dependency ' + p); })(),
    fetch: async (url, options) => {
      assert.equal(url, 'https://api.buffer.com'); assert.equal(options.method, 'POST');
      const { query, variables } = JSON.parse(options.body); assert.match(query.trim(), /^query\b/); assert.doesNotMatch(query, /mutation|createPost|updatePost|deletePost/);
      calls.push({ query, variables });
      if (query.includes('BufferReservationInventory')) {
        const response = inventory[pageIndex++]; if (response instanceof Error) throw response;
        return { ok: true, status: 200, json: async () => response?.graphqlErrors ? { data: response.data, errors: [{ message: 'private upstream message' }] } : { data: response } };
      }
      if (metricFailure && query.includes('BufferPostsWithMetrics')) return { ok: false, status: 401, json: async () => ({}) };
      const data = query.includes('BufferAccount') ? { account: { organizations: [{ id: identity.organizationId }] } }
        : query.includes('BufferChannels') ? { channels } : page();
      return { ok: true, status: 200, json: async () => ({ data }) };
    }
  });
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { calls, response, run: method => module.exports({ method: method || 'GET', query: { commitSha } }, response), queueReads: () => queueReads };
}
test('actual authenticated endpoint exposes complete paginated read while preserving sent metrics', async () => {
  const f = endpointFixture({ inventory: [page([post()], true, 'next'), page([post('p2')])] }); await f.run();
  assert.equal(f.response.statusCode, 200); assert.equal(f.response.body.ok, true);
  assert.equal(f.response.body.reservationInventory.complete, true); assert.equal(f.response.body.reservationInventory.recordCount, 2);
  assert.equal(f.response.body.windows.sevenDay.postCount, 0); assert.equal(f.response.body.posts.length, 0);
  assert.equal(f.calls.length, 5); assert.equal(f.queueReads(), 1);
  assert.match(f.response.headers['Cache-Control'], /no-store/); assert.match(f.response.headers['X-Robots-Tag'], /noindex/);
});
test('actual endpoint propagates mixed-link review without retaining text or resolving links', async () => {
  const f = endpointFixture({ inventory: [page([post('mixed', { text: 'https://creditunionainews.com/news/a.html plus https://buff.ly/unknown?token=SECRET' })])] });
  await f.run();
  const r = f.response.body.reservationInventory;
  assert.equal(f.response.statusCode, 200); assert.equal(f.response.body.ok, true);
  assert.equal(r.complete, true); assert.equal(r.records[0].requiresReview, true); assert.equal(r.requiresReview, true);
  assert.deepEqual(r.records[0].canonicalUrls, ['https://creditunionainews.com/news/a.html']);
  assert.doesNotMatch(JSON.stringify(r), /buff\.ly|SECRET|plus|token/); assert.equal(f.calls.length, 4);
});
test('actual endpoint reads comment and attachment destinations with no expansion, mutation or private output', async () => {
  const f = endpointFixture({ inventory: [page([post('comment', { text: '', metadata: linkedin({ firstComment: 'https://creditunionainews.com/news/a.html' }) })], true, 'next'), page([
    post('attachment', { text: '', metadata: linkedin({ linkAttachment: { url: 'https://buff.ly/paired', expandedUrl: 'https://creditunionainews.com/news/b.html?token=SECRET' } }) }),
    post('mixed', { metadata: linkedin({ firstComment: 'https://buff.ly/unknown' }) })
  ])] });
  await f.run();
  const r = f.response.body.reservationInventory;
  assert.equal(f.response.statusCode, 200); assert.equal(f.response.body.ok, true); assert.equal(r.complete, true); assert.equal(r.requiresReview, true);
  assert.deepEqual(r.records.map(p => p.requiresReview), [false, false, true]);
  assert.deepEqual(r.records[0].canonicalUrls, ['https://creditunionainews.com/news/a.html']);
  assert.deepEqual(r.records[1].canonicalUrls, ['https://creditunionainews.com/news/b.html']);
  assert.doesNotMatch(JSON.stringify(r), /buff\.ly|SECRET|firstComment|linkAttachment/); assert.equal(f.calls.length, 5); assert.equal(f.queueReads(), 1);
});
test('unauthorized, mismatched commit/method/channel all fail before inventory; duplicate channel identity is rejected', async () => {
  for (const [options, method, code] of [[{ authorized: false }, 'GET', 401], [{ commitSha: 'wrong' }, 'POST', 403], [{}, 'DELETE', 405], [{ channels: [{ ...channel, id: 'other' }] }, 'GET', 409], [{ channels: [channel, channel] }, 'GET', 409]]) {
    const f = endpointFixture(options); await f.run(method); assert.equal(f.response.statusCode, code);
    assert.equal(f.calls.some(c => c.query.includes('BufferReservationInventory')), false);
    if (code !== 409) assert.equal(f.calls.length, 0);
  }
});
test('GraphQL partial data is not completeness and inventory failure does not erase sent metrics', async () => {
  const f = endpointFixture({ inventory: [{ graphqlErrors: true, data: page() }] }); await f.run('POST');
  assert.equal(f.response.statusCode, 200); assert.equal(f.response.body.ok, true);
  assert.equal(f.response.body.reservationInventory.complete, false); assert.equal(f.response.body.reservationInventory.requiresReview, true);
  assert.equal(f.response.body.reservationInventory.error, 'inventory_provider_error'); assert.equal(f.response.body.windows.sevenDay.postCount, 0);
  assert.doesNotMatch(JSON.stringify(f.response.body), /private upstream message/);
  const failed = endpointFixture({ metricFailure: true }); await failed.run();
  assert.equal(failed.response.body.error, 'buffer_authentication_failed'); assert.equal(failed.calls.some(c => c.query.includes('BufferReservationInventory')), false);
});
