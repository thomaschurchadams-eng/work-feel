const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
const reportingApi = fs.readFileSync(path.join(root, 'api/ga4-metrics.js'), 'utf8');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'automation/cai-banner-experiment.json'), 'utf8'));

test('CAI experiment assigns one stable message and renders both placements', () => {
  assert.equal(plan.variants.length, 2);
  assert.deepEqual(plan.placements, ['sitewide_header', 'contextual_followup']);
  assert.match(app, /localStorage\.getItem\(caiBannerExperiment\.storageKey\)/);
  assert.match(app, /localStorage\.setItem\(caiBannerExperiment\.storageKey, selected\.id\)/);
  assert.match(app, /createInstituteBanner\(variant, 'sitewide_header'\)/);
  assert.match(app, /createInstituteBanner\(variant, 'contextual_followup', true\)/);
  assert.match(styles, /\.institute-banner--compact/);
});

test('each banner carries privacy-safe placement and variant attribution', () => {
  assert.match(app, /utm_content: `\$\{placement\}_\$\{variant\.id\}`/);
  assert.match(app, /banner\.dataset\.caiBannerExperiment/);
  assert.match(app, /banner\.dataset\.caiBannerVariant/);
  assert.match(app, /banner\.dataset\.caiBannerPlacement/);
  assert.match(app, /threshold: 0\.5/);
  assert.match(app, /sendEvent\('cai_banner_impression'/);
  assert.match(app, /sendEvent\('cai_banner_click'/);
  assert.match(app, /event_callback: continueNavigation/);
  assert.match(app, /window\.setTimeout\(continueNavigation, 500\)/);
});

test('GA4 event names remain valid and the plan prevents an unverified certification claim', () => {
  for (const eventName of [...plan.measurement.genericEvents, ...plan.measurement.cellEvents]) {
    assert.ok(eventName.length <= 40, `${eventName} exceeds GA4's 40-character limit`);
    assert.match(reportingApi, new RegExp(`['\"]${eventName}['\"]`));
  }
  assert.match(plan.claimBoundary, /does not claim.*formal certification/i);
  assert.equal(plan.audienceAllocation.personalData, false);
  assert.equal(plan.cost, '$0 incremental recurring cost');
});

test('winner decision requires sufficient exposure, lift, and qualified CAI evidence', () => {
  assert.equal(plan.decisionRule.minimumRunDays, 14);
  assert.equal(plan.decisionRule.minimumViewableImpressionsPerVariant, 100);
  assert.equal(plan.decisionRule.minimumClicksForWinner, 5);
  assert.equal(plan.decisionRule.minimumRelativeCtrLift, 0.25);
  assert.match(plan.decisionRule.qualifiedSignalRequired, /independently observed CAI intent event or lead/i);
});
