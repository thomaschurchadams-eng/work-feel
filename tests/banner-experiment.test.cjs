const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
const { CUAI_EVENTS } = require('../api/ga4-metrics.js')._test;
const plan = JSON.parse(fs.readFileSync(path.join(root, 'automation/cai-banner-experiment.json'), 'utf8'));

test('CAI experiment preserves stable variants and both restorable placements', () => {
  assert.equal(plan.variants.length, 2);
  assert.deepEqual(plan.placements, ['sitewide_header', 'contextual_followup']);
  assert.match(app, /localStorage\.getItem\(caiBannerExperiment\.storageKey\)/);
  assert.match(app, /localStorage\.setItem\(caiBannerExperiment\.storageKey, selected\.id\)/);
  assert.match(app, /createInstituteBanner\(variant, 'sitewide_header'\)/);
  assert.match(app, /createInstituteBanner\(variant, 'contextual_followup', true\)/);
  assert.match(styles, /\.institute-banner--compact/);
});

test('owner pause prevents both placements before assignment; restoration keeps the original behavior', () => {
  const source = app.slice(app.indexOf('  const caiBannerExperiment ='), app.indexOf('\n  const alertsData ='));
  const enabled = /enabled: (true|false)/.exec(source)[1] === 'true';
  assert.equal(enabled, plan.status === 'active', 'runtime switch and recorded status must agree');
  assert.ok(['active', 'paused'].includes(plan.status));
  for (const surface of ['home', 'news', 'insight', 'news-index', 'other']) {
    const render = (code) => {
      const inserted = []; let assigned = 0;
      const anchor = {insertAdjacentElement: (_, banner) => inserted.push(banner)};
      const context = {URL, URLSearchParams, Uint32Array, Math,
        pagePath: surface === 'news-index' ? '/news.html' : '/example.html',
        isNewsArticle: surface === 'news', isInsightArticle: surface === 'insight',
        window: {localStorage: {getItem: () => { assigned++; return 'v1a_current_training'; }, setItem: () => { throw Error('unexpected assignment'); }}},
        document: {body: {classList: {contains: name => name === 'page-home' && surface === 'home'}},
          querySelector: selector => selector === '.institute-banner' ? null : anchor,
          createElement: () => ({dataset: {},setAttribute: () => {}})}
      };
      vm.runInNewContext(code, context); return {inserted, assigned};
    };
    const paused = render(source.replace(/enabled: (true|false)/, 'enabled: false'));
    assert.equal(paused.assigned, 0); assert.equal(paused.inserted.length, 0);
    const restored = render(source.replace(/enabled: (true|false)/, 'enabled: true'));
    assert.equal(restored.assigned, 1);
    assert.deepEqual(restored.inserted.map(x => x.dataset.caiBannerPlacement), surface === 'other' ? ['sitewide_header'] : ['sitewide_header','contextual_followup']);
  }
});

test('each banner carries privacy-safe placement and variant attribution', () => {
  assert.match(app, /utm_content: `\$\{placement\}_\$\{variant\.id\}`/);
  assert.match(app, /banner\.dataset\.caiBannerExperiment/);
  assert.match(app, /banner\.dataset\.caiBannerVariant/);
  assert.match(app, /banner\.dataset\.caiBannerPlacement/);
  assert.match(app, /threshold: 0\.5/);
  assert.doesNotMatch(app, /instituteBanners\.forEach\(recordBannerImpression\)/);
  assert.match(app, /sendEvent\('cai_banner_impression'/);
  assert.match(app, /sendEvent\('cai_banner_click'/);
  assert.match(app, /event_callback: continueNavigation/);
  assert.match(app, /window\.setTimeout\(continueNavigation, 500\)/);
});

test('GA4 event names remain valid and the plan prevents an unverified certification claim', () => {
  for (const eventName of [...plan.measurement.genericEvents, ...plan.measurement.cellEvents]) {
    assert.ok(eventName.length <= 40, `${eventName} exceeds GA4's 40-character limit`);
    assert.ok(CUAI_EVENTS.includes(eventName), `${eventName} must be requested by reporting`);
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
