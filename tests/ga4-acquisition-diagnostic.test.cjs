const test = require('node:test');
const assert = require('node:assert/strict');
const { closedRange, acquisitionDiagnostic } = require('../lib/ga4-acquisition-diagnostic');
const { mapReport } = require('../api/ga4-metrics')._test;

test('diagnostics reject open, malformed, impossible and oversized date ranges', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  assert.deepEqual(closedRange('2026-09-09', '2026-10-06', now), [{ startDate: '2026-09-09', endDate: '2026-10-06' }]);
  for (const [start, end] of [['2026-10-01','2026-10-07'],['2026-09-08','2026-10-06'],['2026-02-30','2026-03-01'],['','2026-10-06'],['2026-10-06','2026-10-01']]) {
    assert.throws(() => closedRange(start, end, now), { code: 'ga4_diagnostic_dates_invalid' });
  }
});

test('normalization preserves provider totals without replacing rows or old response shape', () => {
  const payload = { metricHeaders: [{ name: 'sessions' }], rows: [{ metricValues: [{ value: '590' }] }], totals: [{ metricValues: [{ value: '562' }] }] };
  assert.deepEqual(mapReport(payload).providerTotals, [{ sessions: 562 }]);
  assert.equal(mapReport(payload).rows[0].sessions, 590);
  delete payload.totals;
  assert.equal(Object.hasOwn(mapReport(payload), 'providerTotals'), false);
});

test('same closed dates compare all three groupings, paginate, and preserve quality evidence and different totals', async () => {
  const dates = [{ startDate: '2026-10-01', endDate: '2026-10-06' }];
  const requests = [];
  const result = await acquisitionDiagnostic(async (body) => {
    requests.push(body);
    const dimensional = body.dimensions.length > 0;
    const offset = Number(body.offset);
    const rowCount = dimensional ? 251 : 1;
    const count = Math.min(250, rowCount - offset);
    return { rows: Array.from({ length: count }, () => ({ sessions: 1, engagedSessions: 0 })), rowCount,
      providerTotals: [{ sessions: 200, engagedSessions: 0 }], metadata: { subjectToThresholding: offset > 0 } };
  }, dates);
  assert.equal(requests.length, 5);
  requests.forEach((request) => {
    assert.deepEqual(request.dateRanges, dates);
    assert.deepEqual(request.metrics, [{ name: 'sessions' }, { name: 'engagedSessions' }]);
    assert.deepEqual(request.metricAggregations, ['TOTAL']);
    assert.equal(request.dimensionFilter, undefined);
  });
  assert.equal(result.reports.sourceMedium.rowSums.sessions, 251);
  assert.equal(result.reports.sourceMedium.providerTotals[0].sessions, 200);
  assert.equal(result.reports.sourceMedium.truncated, false);
  assert.equal(result.reports.sourceMedium.evidence[1].metadata.subjectToThresholding, true);
  assert.deepEqual(requests.filter(r => r.dimensions.length === 3).map(r => r.offset), ['0', '250']);
});

test('diagnostics cap provider calls and explicitly mark incomplete rows', async () => {
  let calls = 0;
  const result = await acquisitionDiagnostic(async () => {
    calls++;
    return { rowCount: 1001, rows: Array.from({ length: 250 }, () => ({ sessions: 1, engagedSessions: 1 })), metadata: {}, providerTotals: [] };
  }, [{ startDate: '2026-10-01', endDate: '2026-10-06' }]);
  assert.equal(calls, 12);
  assert.equal(result.reports.sourceMedium.returnedRows, 1000);
  assert.equal(result.reports.sourceMedium.truncated, true);
});
