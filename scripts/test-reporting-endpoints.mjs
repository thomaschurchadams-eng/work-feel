import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ga4 = require('../api/ga4-metrics.js')._test;
const buffer = require('../api/buffer-metrics.js')._test;

assert.deepEqual(ga4.dateRange(7), [{ startDate: '6daysAgo', endDate: 'today' }]);
assert.deepEqual(ga4.dateRange(7, 7), [{ startDate: '13daysAgo', endDate: '7daysAgo' }]);
assert.deepEqual(ga4.dateRange(90, 90), [{ startDate: '179daysAgo', endDate: '90daysAgo' }]);
assert.equal(ga4.searchConsoleRequest(ga4.dateRange(28)).dimensions[0].name, 'organicGoogleSearchQuery');
assert.equal(ga4.overviewRequest(ga4.dateRange(28)).metrics.some(({ name }) => name === 'scrolledUsers'), true);

const tracked = 'https://creditunionainews.com/news/example.html?utm_source=linkedin&utm_medium=organic_social&utm_campaign=cuai_news';
assert.equal(buffer.hasTrackedDistributionUrl(tracked), true);
assert.equal(buffer.hasTrackedDistributionUrl('https://creditunionainews.com/news/example.html'), false);
assert.deepEqual(
  buffer.reconcileUtmTracking({ distributionUrl: tracked }, { text: 'Legacy sent copy', externalLink: null }),
  {
    utmTracked: true,
    utmTrackingEvidence: 'repository-ledger',
    utmReconciliationStatus: 'reconciled-without-rewriting-sent-post'
  }
);
assert.equal(
  buffer.reconcileUtmTracking({ distributionUrl: null }, { text: 'Legacy sent copy', externalLink: null }).utmReconciliationStatus,
  'repository-distribution-url-missing'
);

console.log('Reporting endpoint tests passed.');
