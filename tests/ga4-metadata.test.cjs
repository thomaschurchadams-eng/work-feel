const test = require('node:test');
const assert = require('node:assert/strict');
const { mapReport, reportEvidence } = require('../api/ga4-metrics')._test;

test('GA4 normalization preserves completeness and thresholding evidence', () => {
  const mapped = mapReport({
    dimensionHeaders: [{ name: 'eventName' }],
    metricHeaders: [{ name: 'eventCount' }],
    rows: [{ dimensionValues: [{ value: 'cai_banner_click' }], metricValues: [{ value: '3' }] }],
    rowCount: 1,
    metadata: {
      currencyCode: 'USD',
      timeZone: 'America/New_York',
      dataLossFromOtherRow: true,
      subjectToThresholding: true,
      samplingMetadatas: [{ samplesReadCount: '10', samplingSpaceSize: '100' }],
      schemaRestrictionResponse: { activeMetricRestrictions: [] },
      emptyReason: 'fixture'
    }
  });
  assert.equal(mapped.rows[0].eventCount, 3);
  assert.equal(mapped.metadata.subjectToThresholding, true);
  assert.equal(mapped.metadata.dataLossFromOtherRow, true);
  assert.deepEqual(mapped.metadata.samplingMetadatas, [{ samplesReadCount: '10', samplingSpaceSize: '100' }]);
  assert.deepEqual(reportEvidence(mapped), { rowCount: 1, metadata: mapped.metadata });
});

test('missing GA4 completeness flags remain unknown instead of false', () => {
  const mapped = mapReport({ rows: [] });
  assert.equal(mapped.metadata.subjectToThresholding, null);
  assert.equal(mapped.metadata.dataLossFromOtherRow, null);
  assert.deepEqual(mapped.metadata.samplingMetadatas, []);
});
