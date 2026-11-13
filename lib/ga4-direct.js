// Fixed aggregate queries only: callers cannot supply dimensions, filters or limits.
const publicPaths = new Set(require('./ga4-public-paths.json'));
const DAY = 86400000;
const metrics = ['sessions', 'activeUsers', 'newUsers', 'engagedSessions', 'engagementRate', 'userEngagementDuration'];
const definitions = { overview: [], daily: ['date'], landingPages: ['landingPage'], hostnames: ['hostName'], countries: ['country'], devices: ['deviceCategory'], newReturning: ['newVsReturning'] };
const filter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Direct', caseSensitive: true } } };
function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw Error('invalid_dates');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw Error('invalid_dates');
  return time;
}
function iso(time) { return new Date(time).toISOString().slice(0, 10); }
function validateDates({ startDate = '', endDate = '' }, today) {
  if (!startDate && !endDate) return null;
  const start = parseDate(startDate), end = parseDate(endDate);
  const days = (end - start) / DAY + 1;
  if (days < 1 || days > 28 || start < Date.parse('2005-01-01') || (today && end >= parseDate(today))) throw Error('invalid_dates');
  return { startDate, endDate, days };
}
function ranges(input, today) {
  const requested = validateDates(input, today);
  const end = parseDate(today) - 3 * DAY;
  const current = requested || { startDate: iso(end - 6 * DAY), endDate: iso(end), days: 7 };
  const previousEnd = parseDate(current.startDate) - DAY;
  return [{ name: 'current', startDate: current.startDate, endDate: current.endDate }, { name: 'previous', startDate: iso(previousEnd - (current.days - 1) * DAY), endDate: iso(previousEnd) }];
}
function compatible(payload, body) {
  return [['dimensions', 'dimensionCompatibilities', 'dimensionMetadata'], ['metrics', 'metricCompatibilities', 'metricMetadata']].every(([names, entries, metadata]) =>
    body[names].every(({ name }) => payload[entries]?.some(entry => entry[metadata]?.apiName === name && entry.compatibility === 'COMPATIBLE')));
}
function safeRows(rows) {
  return rows.map(row => {
    const result = { ...row };
    if ('landingPage' in result && !publicPaths.has(result.landingPage)) result.landingPage = '(unrecognized path withheld)';
    if ('hostName' in result && !['creditunionainews.com', 'www.creditunionainews.com', '(not set)'].includes(result.hostName)) result.hostName = '(other hostname withheld)';
    return result;
  });
}
async function queryDirect(input, { report, compatibility }, now = new Date()) {
  validateDates(input);
  // Read the reporting timezone from the same Data API; no Admin API scope.
  const probe = await report({ dateRanges: [{ startDate: '3daysAgo', endDate: '3daysAgo' }], metrics: [{ name: 'sessions' }], limit: '1' });
  const timeZone = probe.metadata?.timeZone;
  if (!timeZone) { const error = Error('timezone_unavailable'); error.code = 'timezone_unavailable'; throw error; }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = name => parts.find(p => p.type === name).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  let dateRanges;
  try { dateRanges = ranges(input, today); } catch { const error = Error('invalid_dates'); error.code = 'invalid_dates'; throw error; }
  const reports = {};
  await Promise.all(Object.entries(definitions).map(async ([name, dimensions]) => {
    const limit = name === 'daily' ? 56 : name === 'overview' ? 2 : 50;
    const body = { dateRanges, dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), dimensionFilter: filter, limit: String(limit),
      orderBys: name === 'daily' ? [{ dimension: { dimensionName: 'date' } }] : [{ metric: { metricName: 'sessions' }, desc: true }] };
    const shape = { dimensions: body.dimensions, metrics: body.metrics, dimensionFilter: filter };
    try {
      const evidence = await compatibility(shape);
      if (!compatible(evidence, shape)) { reports[name] = { status: 'unavailable', error: 'incompatible_or_unverified_dimensions_metrics', limit }; return; }
      const result = await report(body);
      if (result.metadata?.timeZone !== timeZone) throw Error('timezone_mismatch');
      const { schemaRestrictionResponse, emptyReason, ...metadata } = result.metadata;
      reports[name] = { status: 'ok', limit, rowCount: result.rowCount, truncated: result.rowCount > Math.min(result.rows.length, limit) || result.rows.length > limit || Boolean(metadata.dataTruncationReasons?.length),
        rows: safeRows(result.rows.slice(0, limit)), metadata: { ...metadata, restricted: Boolean(schemaRestrictionResponse?.activeMetricRestrictions?.length), empty: result.rows.length === 0 } };
    } catch (error) {
      if (error.code === 'ga4_property_access_denied') throw error;
      reports[name] = { status: 'error', error: error.code || 'ga4_report_failed', limit };
    }
  }));
  const successes = Object.values(reports).filter(r => r.status === 'ok').length;
  const truncated = Object.values(reports).some(r => r.truncated);
  return { ok: successes > 0, status: successes === 7 && !truncated ? 'complete' : successes ? 'partial' : 'unavailable', propertyId: '520110560', timeZone, dateRanges,
    generatedAt: now.toISOString(), source: 'google-analytics-data-api', directDefinition: 'sessionDefaultChannelGroup = Direct', reports,
    freshness: { latestRequestedDate: dateRanges[0].endDate, propertyToday: today, processingLag: 'GA4 may revise recent daily data; no ingestion watermark is available. Defaults end three calendar days ago; dates before today are accepted.' },
    caveats: [
      'Aggregate diagnostics only. No IDs, query strings or raw visitor events. Landing paths are limited to known public site paths; other paths and hostnames are withheld.',
      'Direct means GA4 could not attribute the session to another channel. Unrecorded historical referral sources cannot be recovered.',
      'Internal traffic is included unless existing property filters excluded it. Hostname does not identify internal visitors; preview or localhost traffic may contaminate totals. No filters or tracking settings were changed.',
      'Breakdowns are separate reports, not joined visitor records. Hostname is event scoped; sessions spanning hosts may appear in multiple rows. User and session totals across rows may not be additive.',
      'Missing days are not filled with zero. Limits apply across both ranges; check rowCount, truncated, provider dataTruncationReasons, thresholding, sampling, restrictions and dataLossFromOtherRow before comparing.',
      'Privacy thresholds, consent, reporting identity, retention and processing delays can suppress or revise aggregates. Empty or unavailable data does not prove zero traffic.' ] };
}
module.exports = { validateDates, ranges, compatible, safeRows, queryDirect, definitions, metrics };
