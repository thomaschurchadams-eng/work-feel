const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
const slice = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const clock = new Date('2026-11-11T15:00:00Z').getTime();
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
  assert.equal(h.elements['alert-count'].textContent, `${recentCount} ${recentCount === 1 ? 'alert' : 'alerts'} published in last 14 days · ${h.read('archiveAlerts.length')} in archive · Showing ${h.count()}`);
  h.search('Jackson');
  assert.equal(h.count(), 0);
  assert.match(h.elements['alerts-list'].innerHTML, /turning off Published in last 14 days/);
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
  assert.equal(h.read(`getRecentAlerts([{headline:'Unknown',date:'Nov 11, 2026'}]).length`), 0);
});


test('source and CUAI publication dates are separate, with evidence required for publication', () => {
  const h = harness();
  const mexc = h.read("alertsData.find(item => item.slug === 'fincen-mexc-global-transfer-prohibition')");
  assert.equal(mexc.date, 'Nov 6, 2026');
  assert.equal(mexc.publishedAt, '2026-11-09T20:35:32.856Z');
  assert.equal(mexc.publicationDeployment, 'dpl_CY1jytSuXLQnC1FyVA3eGksRqjYm');
  assert.match(mexc.publicationEvidence, /issuecomment-6750832840$/);
  const html = h.read('renderAlertDates(' + JSON.stringify(mexc) + ')');
  assert.match(html, /CUAI published <time datetime="2026-11-09T20:35:32.856Z">Nov 9, 2026/);
  assert.match(html, /Source date <time datetime="2026-11-06">Nov 6, 2026/);
  assert.doesNotMatch(h.read("renderAlertDates({date:'Jul 18, 2026'})"), /CUAI published/);
  assert.doesNotMatch(h.read("renderAlertDates({date:'Jul 18, 2026',publishedAt:'2026-11-09'})"), /CUAI published/);
  assert.equal(h.read("parseAlertDate({date:'2026-02-30'})"), null);
});

test('freshness uses elapsed CUAI publication time, never source age or an unverified backfill', () => {
  const h = harness();
  const age = days => new Date(clock - days * 86400000).toISOString();
  const verified = (headline, publishedAt, date = 'Nov 1, 2025') => ({ headline, publishedAt, date, publicationEvidence:'https://example.test/verified-receipt' });
  const fixtures = [
    verified('boundary', age(3)),
    verified('older', new Date(clock - 3*86400000 - 1).toISOString(), 'Nov 11, 2026'),
    verified('future', new Date(clock + 1).toISOString()),
    verified('recent-old-source', age(1)),
    verified('14-day boundary', age(14)),
    {headline:'unknown-new-source', date:'Nov 11, 2026'},
    {headline:'unverified-publication', publishedAt:age(0),date:'Nov 11, 2026'}
  ];
  assert.deepEqual(Array.from(h.read('getRecentAlerts('+JSON.stringify(fixtures)+',3)'),x=>x.headline), ['recent-old-source','boundary']);
  assert.equal(h.read('getRecentAlerts('+JSON.stringify(fixtures)+',14).length'),4);
  fixtures[0].publishedAt = new Date(clock-3*86400000-1).toISOString();
  assert.equal(h.read('getRecentAlerts('+JSON.stringify([fixtures[0]])+',3).length'),0);
  assert.equal(h.read("parseAlertDate({date:'Nov 6, 2026'}).toISOString()"),'2026-11-06T00:00:00.000Z');
});

test('archive sorts known CUAI publications ahead of unknown history, independently of source order', () => {
  const h=harness();
  const rows=[
    {headline:'older-post-newer-source',date:'Nov 8, 2026',publishedAt:'2026-11-09T20:00:00Z',publicationEvidence:'https://example.test/old'},
    {headline:'unknown-newest-source',date:'Nov 11, 2026'},
    {headline:'newer-post-old-source',date:'Oct 1, 2026',publishedAt:'2026-11-10T20:00:00Z',publicationEvidence:'https://example.test/new'},
    {headline:'unknown-older-source',date:'Jul 1, 2026'}
  ];
  assert.deepEqual(Array.from(h.read('prepareAlerts('+JSON.stringify(rows)+')'),x=>x.headline),['newer-post-old-source','older-post-newer-source','unknown-newest-source','unknown-older-source']);
  assert.match(h.read('renderAlertDates('+JSON.stringify(rows[1])+')'), /CUAI publication date not verified/);
});

test('timezone offsets are equivalent instants; CUAI calendar labels use Eastern time', () => {
  const h=harness();
  const get=value=>h.read('getAlertPublication('+JSON.stringify({publishedAt:value,publicationEvidence:'https://example.test/receipt'})+').date.toISOString()');
  assert.equal(get('2026-11-09T15:35:32.856-05:00'),'2026-11-09T20:35:32.856Z');
  assert.equal(get('2026-11-09T20:35:32.856Z'),'2026-11-09T20:35:32.856Z');
  // The repeated fall-back hour is two distinct instants, not one local hour.
  assert.equal(get('2026-11-01T01:30:00-04:00'),'2026-11-01T05:30:00.000Z');
  assert.equal(get('2026-11-01T01:30:00-05:00'),'2026-11-01T06:30:00.000Z');
  assert.match(h.read("renderAlertDates({publishedAt:'2026-11-10T02:00:00Z',publicationEvidence:'https://example.test/receipt'})"),/Nov 9, 2026/);
});

test('day-only evidence labels a known date but never invents an exact posting time for freshness', () => {
  const h=harness();
  const row={headline:'day only',date:'Nov 6, 2026',publishedAt:'2026-11-09',publicationEvidence:'https://example.test/receipt'};
  assert.match(h.read('renderAlertDates('+JSON.stringify(row)+')'), /CUAI published <time datetime="2026-11-09">Nov 9, 2026/);
  assert.equal(h.read('getRecentAlerts('+JSON.stringify([row])+',3).length'),0);
  assert.equal(h.read('prepareAlerts('+JSON.stringify([row])+').length'),1);
  for(const value of ['2026-02-30T12:00:00Z','2026-11-10T12:00:00','not-a-date']) {
    assert.equal(h.read('getAlertPublication('+JSON.stringify({...row,publishedAt:value})+')'),null);
  }
});

test('vendor evidence date is identified as the signal date, not CUAI publication', () => {
  const html = fs.readFileSync(path.join(__dirname, '../intelligence/vendors.html'), 'utf8');
  assert.match(html, /Vendor claim · Signal date: <time datetime="2026-07-17">July 17, 2026<\/time>/);
});
