// Local browser contract only: never sends test events to Google or CAI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '../..');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CUAI_BROWSER_EXECUTABLE ? { executablePath: process.env.CUAI_BROWSER_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const width of [390, 1440]) for (const variant of ['v1a_current_training', 'v1b_current_readiness']) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      await context.route('**/*', route => new URL(route.request().url()).origin === base && ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await context.addInitScript(value => localStorage.setItem('cuai_cai_banner_variant_2026_09', value), variant);
      const page = await context.newPage();
      const entry = base + '/news/raiz-digital-account-opening-case-study.html?utm_source=linkedin&utm_medium=organic_social&utm_campaign=cuai_news&utm_content=local_contract';
      await page.goto(entry, { waitUntil: 'networkidle' });
      const links = page.locator('[data-cai-banner-placement] a');
      assert.equal(await links.count(), 2);
      for (let i = 0; i < 2; i++) {
        await links.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        const url = new URL(await links.nth(i).getAttribute('href'));
        assert.equal(url.searchParams.get('utm_source'), 'creditunionainews');
        assert.equal(url.searchParams.get('utm_medium'), 'site_banner');
        assert.equal(url.searchParams.get('utm_campaign'), 'cai_current_readiness_sep2026');
        await links.nth(i).click({ modifiers: ['Shift'] });
      }
      const events = await page.evaluate(() => window.dataLayer.map(args => Array.from(args)).filter(args => args[0] === 'event').map(args => ({ name: args[1], params: args[2] })));
      const banners = events.filter(event => /^(cai_banner_|cai_bn_)/.test(event.name));
      assert.equal(banners.filter(e => e.name === 'cai_banner_impression').length, 2);
      assert.equal(banners.filter(e => e.name === 'cai_banner_click').length, 2);
      assert.equal(banners.filter(e => e.name.startsWith('cai_bn_imp_')).length, 2);
      assert.equal(banners.filter(e => e.name.startsWith('cai_bn_click_')).length, 2);
      banners.forEach(({ params }) => {
        assert.equal(params.promotion_campaign, 'cai_current_readiness_sep2026');
        assert.equal(Object.hasOwn(params, 'campaign'), false);
      });
      assert.equal(events.filter(e => e.name === 'outbound_click').length, 2);
      assert.equal(page.url(), entry);
      // A normal click must still wait for analytics and invoke the navigation callback.
      await page.evaluate(() => {
        window.__callbackObserved = false;
        const previous = window.gtag;
        window.gtag = (...args) => {
          previous(...args);
          if (args[1] === 'cai_banner_click' && typeof args[2].event_callback === 'function') {
            window.__callbackObserved = true;
            args[2].event_callback();
          }
        };
      });
      let destination;
      await page.route('https://www.cooperativeaiinstitute.com/**', route => { destination = route.request().url(); return route.abort(); });
      const expected = await links.first().getAttribute('href');
      await links.first().click({ noWaitAfter: true });
      await page.waitForTimeout(100);
      assert.equal(destination, expected);
      results.push({ width, variant, bannerEvents: banners.length, entryTagsPreserved: true, outboundTagsPreserved: true, navigationCallback: true });
      await context.close();
    }
    console.log(JSON.stringify({ scope: 'Local captured gtag payload and browser navigation; not provider acquisition attribution', results }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
