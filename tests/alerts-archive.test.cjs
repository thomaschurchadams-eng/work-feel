const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
const slice = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const clock = new Date('2026-10-14T15:00:00Z').getTime();
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}

function harness(hash = '') {
  const listeners = {};
  const elements = Object.fromEntries(['alerts-list', 'alert-search', 'alert-recent-only', 'alert-count', 'alerts-more', 'show-more-alerts'].map(id => [id, {
    value: '', checked: false, hidden: false, innerHTML: '', textContent: '',
    addEventListener(type, fn) { listeners[id + ':' + type] = fn; }
  }]));
  const linked = { setAttribute() {}, focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } };
  const context = vm.createContext({ Date: FixedDate, Set, Math, decodeURIComponent,
    document: { querySelector: id => elements[id.slice(1)], getElementById: id => elements['alerts-list'].innerHTML.includes(`id="${id}"`) ? linked : null },
    window: { location: { hash }, addEventListener(type, fn) { listeners['window:' + type] = fn; }, requestAnimationFrame: fn => fn() }
  });
  vm.runInContext(slice('  const alertsData = [', '  const parseAlertDate') + slice('  const parseAlertDate', '  const getFreshHomepageWatchItems') + slice('  const prepareAlerts', '  const renderAlertsTicker') + slice('  const alertsList', '  const addArticleNewsletterCta'), context);
  const read = expression => vm.runInContext(expression, context);
  const search = value => { elements['alert-search'].value = value; listeners['alert-search:input'](); };
  const recent = value => { elements['alert-recent-only'].checked = value; listeners['alert-recent-only:change'](); };
  const count = () => (elements['alerts-list'].innerHTML.match(/class="card alert-card" id=/g) || []).length;
  return { context, read, elements, listeners, search, recent, count, linked };
}

test('archive includes old records and excludes invalid dates and duplicate headlines/URLs', () => {
  const h = harness();
  const actual = h.read(`prepareAlerts([
    {headline:'Old',sourceUrl:'https://old',date:'Dec 12, 2024'},
    {headline:'Old',sourceUrl:'https://duplicate-title',date:'Dec 11, 2024'},
    {headline:'Other',sourceUrl:' HTTPS://OLD ',date:'Dec 10, 2024'},
    {headline:'Invalid',date:'not-a-date'}, {headline:'Missing'}
  ])`);
  assert.equal(actual.length, 1);
  assert.equal(actual[0].headline, 'Old');
  assert.ok(h.read("archiveAlerts.some(item => item.slug === 'ai-fraud-protection-necessity')"));
});

test('old-alert search searches the entire archive before pagination and retains dates', () => {
  const h = harness();
  h.search(' visa ');
  assert.ok(h.count() > 0);
  assert.match(h.elements['alerts-list'].innerHTML, /Visa Opens AI Financial Assistant Pilot/);
  assert.match(h.elements['alerts-list'].innerHTML, /Jul 18, 2026/);
  assert.ok(h.elements['alert-count'].textContent.includes(`matching alerts · ${h.read('archiveAlerts.length')} in archive`));
  h.search('Jackson');
  assert.equal(h.count(), 1);
  assert.equal(h.elements['alert-count'].textContent, `1 matching alert · ${h.read('archiveAlerts.length')} in archive · Showing 1`);
});

test('recent filter restricts search and can be turned off to recover old matches', () => {
  const h = harness();
  h.recent(true);
  const recentCount = h.read('preparedAlerts.length');
  assert.equal(h.count(), Math.min(12, recentCount));
  assert.equal(h.elements['alert-count'].textContent, `${recentCount} alerts in last 14 days · ${h.read('archiveAlerts.length')} in archive · Showing ${h.count()}`);
  h.search('Jackson');
  assert.equal(h.count(), 0);
  assert.match(h.elements['alerts-list'].innerHTML, /turning off Last 14 days/);
  h.recent(false);
  assert.equal(h.count(), 1);
});

test('archive pages add twelve, hide at the end, and reset when search/filter changes', () => {
  const h = harness();
  assert.equal(h.count(), 12);
  h.listeners['show-more-alerts:click']();
  assert.equal(h.count(), 24);
  while (!h.elements['alerts-more'].hidden) h.listeners['show-more-alerts:click']();
  assert.equal(h.count(), h.read('archiveAlerts.length'));
  assert.equal(h.elements['alerts-more'].hidden, true);
  h.search('');
  assert.equal(h.count(), 12);
  assert.equal(h.elements['alerts-more'].hidden, false);
  h.recent(true);
  h.recent(false);
  assert.equal(h.count(), 12);
});

test('initial deep link reveals the last archive record beyond the first page', () => {
  const h = harness('#ai-fraud-protection-necessity');
  assert.equal(h.count(), h.read('archiveAlerts.length'));
  assert.match(h.elements['alerts-list'].innerHTML, /id="ai-fraud-protection-necessity"/);
  assert.equal(h.linked.focused, true);
  assert.equal(h.linked.scrolled, true);
});

test('hash changes reveal an older alert despite active filters; unrelated/malformed hashes are harmless', () => {
  const h = harness();
  h.recent(true); h.search('missing');
  vm.runInContext(`window.location.hash = '#visa-ai-financial-assistant-us-issuer-pilot'`, h.context);
  h.listeners['window:hashchange']();
  assert.equal(h.elements['alert-search'].value, '');
  assert.equal(h.elements['alert-recent-only'].checked, false);
  const linkedCount = Math.min(h.read('archiveAlerts.length'), Math.max(12, Math.ceil((h.read("archiveAlerts.findIndex(item => item.slug === 'visa-ai-financial-assistant-us-issuer-pilot')") + 1) / 12) * 12));
  assert.equal(h.count(), linkedCount);
  assert.match(h.elements['alerts-list'].innerHTML, /id="visa-ai-financial-assistant-us-issuer-pilot"/);
  for (const hash of ['#main-content', '#missing', '#%invalid']) {
    vm.runInContext(`window.location.hash = ${JSON.stringify(hash)}`, h.context);
    h.listeners['window:hashchange']();
    assert.equal(h.count(), linkedCount);
  }
});

test('homepage and ticker keep their separate freshness windows', () => {
  const h = harness();
  assert.equal(h.read("homepageAlerts.some(item => item.slug === 'ai-fraud-protection-necessity')"), false);
  assert.equal(h.read("tickerAlerts.some(item => item.slug === 'ai-fraud-protection-necessity')"), false);
  assert.equal(h.read('tickerAlerts === preparedAlerts'), true);
  assert.equal(h.read(`getRecentAlerts([{headline:'Outside',date:'Sep 30, 2026'}, {headline:'Inside',date:'Oct 1, 2026'}]).length`), 1);
});
