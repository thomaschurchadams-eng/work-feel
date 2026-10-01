const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { queryWindow, safeQuery } = require('../api/search-console-metrics')._test;
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const row = (keys) => ({ keys, clicks: 2, impressions: 40, ctr: .05, position: 8 });

function fixtureFetch(calls, failure = '') {
  return async (url, options = {}) => {
    const body = options.body && String(url).includes('searchAnalytics') ? JSON.parse(options.body) : null;
    calls.push({ url, body });
    if (String(url).includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'fixture-only' }) };
    if (String(url).endsWith('/sites')) return { ok: true, json: async () => ({ siteEntry: [{ siteUrl: 'sc-domain:creditunionainews.com' }] }) };
    const dimensions = body.dimensions || [];
    if (failure && dimensions.join(',') === failure) return { ok: false, status: 403, json: async () => ({ error: { message: 'fixture provider error' } }) };
    const rows = dimensions.length === 0 ? [row([])] : dimensions[0] === 'page' ? [row(['https://creditunionainews.com/news.html'])] : [row(dimensions.length === 1 ? ['credit union payments'] : ['credit union payments', 'https://creditunionainews.com/news.html']), row(['private@example.com', 'https://creditunionainews.com/'])];
    return { ok: true, json: async () => ({ rows, responseAggregationType: dimensions.includes('page') ? 'byPage' : 'byProperty' }) };
  };
}

test('query and query/page mapping uses fixed limits, finalized data, and preserves totals', async () => {
  const saved = global.fetch, calls = [];
  global.fetch = fixtureFetch(calls);
  try {
    const result = await queryWindow('fixture-only', 'sc-domain:creditunionainews.com', 7);
    assert.deepEqual(result.aggregate, { clicks: 2, impressions: 40, ctr: .05, position: 8 });
    assert.equal(result.topPages.length, 1);
    assert.equal(result.topQueries[0].query, 'credit union payments');
    assert.equal(result.topQueryPages[0].page, 'https://creditunionainews.com/news.html');
    assert.equal(result.queryReporting.queries.redactedRows, 1);
    assert.equal(result.queryReporting.queryPages.complete, false);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map(c => c.body.rowLimit), [undefined, 25, 25, 50]);
    assert.ok(calls.every(c => c.body.dataState === 'final'));
    assert.equal(result.freshness.timeZone, 'America/Los_Angeles');
  } finally { global.fetch = saved; }
});

test('optional detail failure retains compatible totals and signals unavailable', async () => {
  const saved = global.fetch;
  global.fetch = fixtureFetch([], 'query,page');
  try {
    const result = await queryWindow('fixture-only', 'sc-domain:creditunionainews.com', 28);
    assert.equal(result.aggregate.clicks, 2);
    assert.equal(result.topPages.length, 1);
    assert.deepEqual(result.topQueryPages, []);
    assert.equal(result.queryReporting.queryPages.status, 'unavailable');
    assert.equal(result.queryReporting.queries.status, 'available');
    assert.equal(JSON.stringify(result).includes('fixture provider error'), false);
  } finally { global.fetch = saved; }
});

test('missing rows are explicit limited results and contact-like queries are omitted', async () => {
  for (const value of ['person@example.com', '+1 (555) 123-4567', null, 'x'.repeat(301)]) assert.equal(safeQuery(value), false);
  assert.equal(safeQuery('credit union AI governance'), true);
  const saved = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  try {
    const result = await queryWindow('fixture-only', 'sc-domain:creditunionainews.com', 7);
    assert.equal(result.aggregate.position, null);
    assert.deepEqual(result.topQueries, []);
    assert.equal(result.queryReporting.queries.status, 'available');
    assert.equal(result.queryReporting.queries.complete, false);
  } finally { global.fetch = saved; }
});

test('detail output is capped even if a provider fixture exceeds the requested limit', async () => {
  const saved = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ rows: Array.from({ length: 100 }, () => row(['query', 'page'])) }) });
  try {
    const result = await queryWindow('fixture-only', 'sc-domain:creditunionainews.com', 7);
    assert.equal(result.topQueries.length, 25);
    assert.equal(result.topQueryPages.length, 50);
    assert.equal(result.queryReporting.queries.limitReached, true);
  } finally { global.fetch = saved; }
});

test('handler retains authorization, exact commit, private headers, and both windows', async () => {
  const calls = []; let authorized = true;
  const sandbox = { module: { exports: {} }, require: name => name === '../lib/operations-auth' ? { authorize: async (_, res) => { if (!authorized) res.status(401).json({ ok: false }); return authorized; } } : require(name), process: { env: { VERCEL_GIT_COMMIT_SHA: 'fixture-sha', GA4_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'fixture@example.test', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) } }, fetch: fixtureFetch(calls), Buffer, URLSearchParams, Date, Intl };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/search-console-metrics'), 'utf8'), sandbox);
  const headers = {}; let status, data;
  const res = { setHeader(k, v) { headers[k] = v; }, status(v) { status = v; return this; }, json(v) { data = v; } };
  const handler = sandbox.module.exports;
  authorized = false;
  await handler({ method: 'GET', query: { commitSha: 'fixture-sha' } }, res);
  assert.equal(status, 401); assert.equal(calls.length, 0);
  authorized = true;
  await handler({ method: 'GET', query: { commitSha: 'wrong' } }, res);
  assert.equal(status, 403); assert.equal(calls.length, 0);
  await handler({ method: 'GET', query: { commitSha: 'fixture-sha' } }, res);
  assert.equal(status, 200); assert.equal(data.ok, true);
  assert.equal(data.windows.sevenDay.days, 7); assert.equal(data.windows.twentyEightDay.days, 28);
  assert.equal(headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.equal(calls.length, 10);
  assert.equal(JSON.stringify(data).includes('fixture-only'), false);
});
