const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../../assets/app.js'), 'utf8');
const records = vm.runInNewContext(app.slice(app.indexOf('const alertsData = ['), app.indexOf('  const parseAlertDate')) + '\nalertsData');
const urls = new Set(), headlines = new Set();
const archive = records.filter(item => !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => new Date(b.date) - new Date(a.date)).filter(item => {
  const url = item.sourceUrl?.trim().toLowerCase(), headline = item.headline?.trim().toLowerCase();
  if ((url && urls.has(url)) || (headline && headlines.has(headline))) return false;
  if (url) urls.add(url);
  if (headline) headlines.add(headline);
  return true;
});
const recentCount = archive.filter(item => new Date(item.date) >= new Date('2026-09-30T15:00:00Z')).length;
const visaIndex = archive.findIndex(item => item.slug === 'visa-ai-financial-assistant-us-issuer-pilot');
const visaPageCount = Math.min(archive.length, Math.max(12, Math.ceil((visaIndex + 1) / 12) * 12));

// The real DOM, fixed historical clock, and blocked external traffic make this
// regression independent of alert aging and avoid analytics/provider calls.
module.exports = async function verifyAlerts(browser, base, out, axePath) {
  const results = [];
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(() => {
        const OriginalDate = Date;
        window.Date = class extends OriginalDate {
          constructor(...args) { super(...(args.length ? args : ['2026-10-14T15:00:00Z'])); }
          static now() { return new OriginalDate('2026-10-14T15:00:00Z').getTime(); }
        };
        localStorage.setItem('cuai_cai_banner_variant_2026_09', 'v1a_current_training');
      });
      await context.route('**/*', route => {
        const req = route.request();
        return ['GET', 'HEAD'].includes(req.method()) && new URL(req.url()).origin === new URL(base).origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      assert.equal((await page.goto(new URL('/alerts/', base).href)).status(), 200);
      const cards = page.locator('#alerts-list > article[id]');
      const search = page.getByRole('searchbox', { name: 'Search all alerts' });
      const recent = page.getByRole('checkbox', { name: 'Last 14 days' });
      const more = page.getByRole('button', { name: 'Show more alerts' });
      assert.equal(await cards.count(), 12);
      assert.equal(await recent.isChecked(), false);
      assert.equal(await page.locator('#alert-count').innerText(), `${archive.length} alerts in archive · Showing 12`);
      await more.click(); assert.equal(await cards.count(), 24);
      await search.fill('Visa');
      assert.equal(await page.locator('#visa-ai-financial-assistant-us-issuer-pilot').count(), 1);
      assert.match(await cards.allTextContents().then(text => text.join(' ')), /Jul 18, 2026/);
      await recent.check();
      assert.equal(await cards.count(), 0);
      assert.match(await page.locator('#alert-count').innerText(), /^0 matching alerts in last 14 days/);
      await recent.uncheck(); assert.ok(await cards.count() > 0);
      await search.fill('Jackson'); assert.equal(await cards.count(), 1);
      await page.screenshot({ path: path.join(out, `alerts-old-search-${width}.png`), fullPage: true });
      await search.fill(''); await recent.check(); assert.equal(await cards.count(), Math.min(12, recentCount));
      await page.screenshot({ path: path.join(out, `alerts-recent-${width}.png`), fullPage: true });
      // Initial navigation must reveal an alert on the seventh page and focus it.
      await page.goto(new URL('/alerts/#ai-fraud-protection-necessity', base).href);
      const target = page.locator('#ai-fraud-protection-necessity');
      await target.waitFor({ state: 'visible' });
      assert.equal(await cards.count(), archive.length);
      await page.waitForFunction(() => document.activeElement?.id === 'ai-fraud-protection-necessity');
      assert.equal(await target.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= document.querySelector('.site-header').getBoundingClientRect().bottom && r.top < innerHeight; }), true);
      await page.screenshot({ path: path.join(out, `alerts-deep-link-${width}.png`), fullPage: false });
      await search.fill('missing'); await recent.check();
      // A real same-page link exercises hashchange without setting app state.
      await page.evaluate(() => { const a = document.createElement('a'); a.id = 'test-alert-link'; a.href = '#visa-ai-financial-assistant-us-issuer-pilot'; a.textContent = 'Older alert'; document.body.append(a); });
      await page.locator('#test-alert-link').click();
      await page.waitForFunction(() => document.activeElement?.id === 'visa-ai-financial-assistant-us-issuer-pilot');
      assert.equal(await page.locator('#visa-ai-financial-assistant-us-issuer-pilot').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom), true);
      assert.equal(await recent.isChecked(), false);
      assert.equal(await search.inputValue(), '');
      assert.equal(await cards.count(), visaPageCount);
      await page.locator('#test-alert-link').evaluate(el => el.remove());
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false);
      assert.deepEqual(errors, []); assert.deepEqual(violations, []);
      await search.fill('');
      await search.focus();
      await page.keyboard.press('Tab');
      assert.equal(await recent.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Space'); assert.equal(await recent.isChecked(), true);
      await recent.uncheck();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `alerts-archive-${width}.png`), fullPage: true });
      results.push({ width, archive: archive.length, initial: 12, nextPage: 24, recent: recentCount, oldSearch: true, initialDeepLink: true, filteredHashChange: true, keyboardFilter: true, overflow, errors, violations });
      console.log(`Alerts archive ${width}: PASS (search, dates/counts, recent filter, pagination, deep links, keyboard, axe)`);
    } finally { await context.close(); }
  }
  fs.writeFileSync(path.join(out, 'alerts-results.json'), JSON.stringify({ base, clock: '2026-10-14T15:00:00Z', results }, null, 2));
};
