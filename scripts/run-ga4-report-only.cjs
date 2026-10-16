// Deliberately independent from run-secure-operations: no queue, GitHub writes or distribution imports.
const SITE = 'https://creditunionainews.com';
async function run({ env = process.env, fetcher = fetch, save = () => {} } = {}) {
  const sha = env.DEPLOYED_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('invalid_deployment_sha');
  const { validateDates } = require('../lib/ga4-direct');
  validateDates({ startDate: env.REPORT_START_DATE || '', endDate: env.REPORT_END_DATE || '' });
  const identityUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (identityUrl.protocol !== 'https:') throw Error('invalid_identity_url');
  identityUrl.searchParams.set('audience', SITE + '/operations');
  const identity = await fetcher(identityUrl, { headers: { Authorization: 'Bearer ' + env.ACTIONS_ID_TOKEN_REQUEST_TOKEN }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!identity.ok) throw Error('identity_failed');
  const { value } = await identity.json();
  if (typeof value !== 'string' || !value) throw Error('identity_missing');
  // Never persist or print the bearer identity.
  const invoke = async (route, body) => {
    const response = await fetcher(SITE + '/api/' + route, { method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer ' + value, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, commitSha: sha }), signal: AbortSignal.timeout(route === 'ga4-metrics' ? 240000 : 10000) });
    const data = await response.json();
    if (!response.ok || (!data.ok && !(route === 'ga4-metrics' && data.status === 'unavailable' && data.propertyId === '520110560' && data.reports && typeof data.reports === 'object'))) throw Error('report_request_failed_' + response.status);
    return data;
  };
  const health = await invoke('operations-health', {});
  if (health.environment !== 'production' || health.commit !== sha) throw Error('deployment_commit_mismatch');
  const data = await invoke('ga4-metrics', { diagnostic: 'direct', startDate: env.REPORT_START_DATE || '', endDate: env.REPORT_END_DATE || '' });
  save({ commit: sha, data });
  return data;
}
if (require.main === module) {
  run({ save: result => { const fs = require('node:fs'); fs.mkdirSync('ga4-report-receipts', { recursive: true }); fs.writeFileSync('ga4-report-receipts/direct.json', JSON.stringify(result, null, 2) + '\n'); } })
    .then(data => { console.log('Aggregate Direct report: ' + data.status); if (data.status !== 'complete') process.exitCode = 1; })
    .catch(() => { console.error('Metrics-only report failed; no publishing action was attempted.'); process.exitCode = 1; });
}
module.exports = { run };
