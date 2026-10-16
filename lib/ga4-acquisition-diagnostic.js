const DAY = 86400000;
const PAGE_SIZE = 250;
const MAX_PAGES = 4;
const METRICS = ['sessions', 'engagedSessions'];

function closedRange(startDate, endDate, now = new Date()) {
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const start = parse(startDate), end = parse(endDate);
  // Conservative processing buffer also avoids property-timezone open dates.
  const latestEnd = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z') - 2 * DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start >= 28 * DAY || end > latestEnd) {
    throw Object.assign(new Error('Use valid inclusive dates of at most 28 days, ending at least two UTC calendar days ago.'), { code: 'ga4_diagnostic_dates_invalid' });
  }
  return [{ startDate, endDate }];
}

async function collectReport(runReport, dateRanges, dimensions) {
  const rows = [], evidence = [];
  let first;
  for (let page = 0; page < MAX_PAGES; page++) {
    const report = await runReport({
      dateRanges,
      dimensions: dimensions.map((name) => ({ name })),
      metrics: METRICS.map((name) => ({ name })),
      metricAggregations: ['TOTAL'],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }, ...dimensions.map((dimensionName) => ({ dimension: { dimensionName } }))],
      limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE)
    });
    first ||= report;
    evidence.push({ rowCount: report.rowCount, metadata: report.metadata, providerTotals: report.providerTotals || [] });
    rows.push(...report.rows.filter((row) => !dimensions.some((name) => String(row[name]).startsWith('RESERVED_'))));
    if ((page + 1) * PAGE_SIZE >= report.rowCount || report.rows.length === 0) break;
  }
  return {
    rows, rowCount: first.rowCount, returnedRows: rows.length,
    truncated: rows.length < first.rowCount,
    rowSums: Object.fromEntries(METRICS.map((name) => [name, rows.reduce((sum, row) => sum + (Number(row[name]) || 0), 0)])),
    providerTotals: first.providerTotals || [], evidence
  };
}

async function acquisitionDiagnostic(runReport, dateRanges) {
  const groups = { overview: [], sourceMedium: ['sessionSource', 'sessionMedium'], sourceMediumCampaign: ['sessionSource', 'sessionMedium', 'sessionCampaignName'] };
  const reports = Object.fromEntries(await Promise.all(Object.entries(groups).map(async ([name, dimensions]) => [name, await collectReport(runReport, dateRanges, dimensions)])));
  return {
    dateRanges, generatedAt: new Date().toISOString(), reports,
    limits: { maxDays: 28, pageSize: PAGE_SIZE, maxPagesPerReport: MAX_PAGES, maxRowsPerReport: PAGE_SIZE * MAX_PAGES },
    interpretation: 'Row sums and provider totals are separate evidence. Dimensional sessions need not be additive. Check every page metadata, truncation, thresholding and sampling; a mismatch alone does not prove a mapping bug or Direct attribution cause. No internal/developer filter state is inferred.'
  };
}

module.exports = { closedRange, acquisitionDiagnostic };
