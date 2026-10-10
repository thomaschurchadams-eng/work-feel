const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const authPath = require.resolve('../lib/operations-auth');
const apiPath = require.resolve('../api/ga4-metrics');
const response = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });

test('diagnostic parameters cannot bypass real endpoint authorization', async () => {
  const handler = require(apiPath);
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { diagnosticStart: '2026-09-01', diagnosticEnd: '2026-09-07' } }, res);
  assert.equal(res.code, 401);
  assert.equal(res.body.error, 'unauthorized');
  assert.equal(res.body.acquisitionDiagnostic, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('authorized diagnostics preserve ordinary windows, private headers and read-only scope', async () => {
  const originalAuthorize = require(authPath).authorize;
  const originalFetch = global.fetch;
  const oldEnv = Object.fromEntries(['VERCEL_GIT_COMMIT_SHA', 'GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON'].map(name => [name, process.env[name]]));
  require.cache[authPath].exports.authorize = async () => true;
  delete require.cache[apiPath];
  process.env.VERCEL_GIT_COMMIT_SHA = 'test-commit';
  process.env.GA4_PROPERTY_ID = '123';
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'fixture@example.invalid', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const bodies = [];
  let scope;
  let failDiagnostic = false;
  global.fetch = async (url, options) => {
    if (url.includes('/token')) {
      const assertion = options.body.get('assertion');
      scope = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url')).scope;
      return { ok: true, json: async () => ({ access_token: 'fixture-token' }) };
    }
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (failDiagnostic && body.metricAggregations) return { ok: false, status: 403, json: async () => ({ error: { message: 'private provider detail' } }) };
    return { ok: true, json: async () => ({ metricHeaders: body.metrics, dimensionHeaders: body.dimensions || [], rows: [{ metricValues: body.metrics.map(() => ({ value: '1' })), dimensionValues: (body.dimensions || []).map(() => ({ value: 'fixture' })) }], rowCount: 1, ...(body.metricAggregations ? { totals: [{ metricValues: body.metrics.map(() => ({ value: '1' })) }] } : {}), metadata: { timeZone: 'America/New_York' } }) };
  };
  try {
    const handler = require(apiPath);
    const base = { method: 'POST', headers: {}, body: { commitSha: 'test-commit' } };
    const ordinary = response(); await handler(base, ordinary);
    assert.equal(ordinary.code, 200);
    assert.equal(Object.hasOwn(ordinary.body, 'acquisitionDiagnostic'), false);
    const diagnostic = response(); await handler({ ...base, body: { ...base.body, diagnosticStart: '2026-09-01', diagnosticEnd: '2026-09-07' } }, diagnostic);
    assert.equal(diagnostic.code, 200);
    assert.deepEqual(diagnostic.body.windows, ordinary.body.windows);
    assert.equal(diagnostic.headers['Cache-Control'], 'no-store, max-age=0');
    assert.equal(diagnostic.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
    assert.equal(scope, 'https://www.googleapis.com/auth/analytics.readonly');
    assert.equal(bodies.filter(body => body.metricAggregations).length, 3);
    assert.deepEqual(diagnostic.body.acquisitionDiagnostic.reports.sourceMedium.providerTotals, [{ sessions: 1, engagedSessions: 1 }]);
    assert.equal(JSON.stringify(diagnostic.body).includes('fixture-token'), false);
    assert.equal(JSON.stringify(diagnostic.body).includes('PRIVATE KEY'), false);
    failDiagnostic = true;
    const failed = response(); await handler({ ...base, body: { ...base.body, diagnosticStart: '2026-09-01', diagnosticEnd: '2026-09-07' } }, failed);
    assert.equal(failed.code, 200);
    assert.deepEqual(failed.body.windows, ordinary.body.windows);
    assert.equal(failed.body.acquisitionDiagnostic.status, 'unavailable');
    assert.equal(JSON.stringify(failed.body).includes('private provider detail'), false);
    const mismatch = response(); await handler({ ...base, body: { ...base.body, commitSha: 'wrong', diagnosticStart: '2026-09-01', diagnosticEnd: '2026-09-07' } }, mismatch);
    assert.equal(mismatch.code, 403);
  } finally {
    require.cache[authPath].exports.authorize = originalAuthorize;
    global.fetch = originalFetch;
    Object.entries(oldEnv).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value);
    delete require.cache[apiPath];
  }
});
