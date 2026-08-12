import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const buffer = require('../api/buffer-metrics.js')._test;

const tracked = 'https://creditunionainews.com/news/example.html?utm_source=linkedin&utm_medium=organic_social&utm_campaign=cuai_news&utm_content=test';

assert.equal(buffer.hasTrackedDistributionUrl(tracked), true);
assert.equal(buffer.hasTrackedDistributionUrl('https://creditunionainews.com/news/example.html'), false);
assert.deepEqual(
  buffer.reconcileUtmTracking(
    { distributionUrl: tracked },
    { text: 'Legacy sent copy', externalLink: null }
  ),
  {
    utmTracked: true,
    utmTrackingEvidence: 'repository-ledger',
    utmReconciliationStatus: 'reconciled-without-rewriting-sent-post'
  }
);
assert.equal(
  buffer.reconcileUtmTracking(
    { distributionUrl: null },
    { text: 'Legacy sent copy', externalLink: null }
  ).utmReconciliationStatus,
  'repository-distribution-url-missing'
);

console.log('Buffer UTM reconciliation tests passed.');
