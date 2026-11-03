const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function verifyCardArtwork(browser, base, out, axePath) {
  const results = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    let blockApp = true;
    const requests = [];
    await context.addInitScript(() => { window.CUAIInternalTraffic = true; });
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      requests.push(url.pathname);
      if (url.origin !== new URL(base).origin || !['GET', 'HEAD'].includes(req.method()) || blockApp && url.pathname === '/assets/app.js') return route.abort();
      return route.continue();
    });
    try {
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('/news.html', base).href, { waitUntil: 'networkidle' });
      const authored = await page.locator('.grid.cards-3 .card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('h3')?.textContent, images: [...card.querySelectorAll('img')].map(img => img.getAttribute('src')), links: [...card.querySelectorAll('a')].filter(a => !a.closest('.institute-banner')).map(a => a.getAttribute('href')) })));
      blockApp = false;
      await page.reload({ waitUntil: 'networkidle' });
      await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
      const rendered = await page.locator('.grid.cards-3 .card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('h3')?.textContent, images: [...card.querySelectorAll('img')].map(img => img.getAttribute('src')), links: [...card.querySelectorAll('a')].filter(a => !a.closest('.institute-banner')).map(a => a.getAttribute('href')) })));
      assert.deepEqual(rendered, authored, 'runtime must preserve authored images, titles and destinations without inventing artwork');
      const textIndices = authored.flatMap((card, i) => card.images.length ? [] : [i]);
      assert.ok(textIndices.length > 0, 'real legacy text-card cohort required');
      assert.equal(await page.locator('.card--text-only').count(), textIndices.length);
      const inspect = () => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, broken: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')), placeholders: [...document.images].filter(i => /Articalimage[1-5]\.svg(?:$|[?#])/i.test(i.src)).map(i => i.getAttribute('src')) }));
      const normal = await inspect(); assert.equal(normal.overflow, false); assert.deepEqual(normal.broken, []); assert.deepEqual(normal.placeholders, []);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id));
      assert.deepEqual(violations, []);
      const cohort = page.locator('.grid.cards-3 .card').nth(textIndices[0]);
      await cohort.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `card-artwork-text-${width}.png`) });
      // Genuine 404 response on an authored image: degraded UX must remain useful,
      // but the failed asset must remain observable to the normal broken-image gate.
      const first = authored.findIndex(card => card.images.length);
      const src = new URL(authored[first].images[0], base).href;
      await context.route(src, route => route.fulfill({ status: 404, headers: { 'Cache-Control': 'no-store' }, contentType: 'text/plain', body: 'Expected isolated image-error fixture' }));
      await page.reload({ waitUntil: 'networkidle' });
      await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
      const card = page.locator('.grid.cards-3 .card').nth(first);
      assert.equal(await card.getAttribute('data-artwork-state'), 'unavailable');
      assert.ok((await card.getAttribute('class')).includes('card--text-only'));
      assert.equal(await card.locator('img').getAttribute('src'), authored[first].images[0]);
      assert.equal(await card.locator('img').isVisible(), false);
      assert.equal(await card.locator('.card-image').isVisible(), false);
      assert.equal(await card.locator('h3').textContent(), authored[first].title);
      assert.deepEqual(await card.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href'))), authored[first].links);
      const negative = await inspect(); assert.equal(negative.overflow, false); assert.deepEqual(negative.broken, [authored[first].images[0]]); assert.deepEqual(negative.placeholders, []);
      await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `card-artwork-404-${width}.png`) });
      await context.unroute(src);
      await card.locator('img').evaluate(image => { image.src = image.getAttribute('src'); });
      await page.waitForFunction(index => {
        const card = document.querySelectorAll('.grid.cards-3 .card')[index];
        return card.dataset.artworkState === 'authored' && card.querySelector('img').naturalWidth > 0 && !card.querySelector('img').hidden;
      }, first);
      const recovered = await inspect(); assert.deepEqual(recovered.broken, []); assert.equal(recovered.overflow, false);
      assert.equal(await card.locator('.card-image').isVisible(), true);
      assert.equal(await page.locator('.card--text-only').count(), textIndices.length);
      assert.equal(requests.some(src => /Articalimage[1-5]\.svg$/i.test(src)), false);
      assert.deepEqual(errors, []);
      results.push({ width, normal, textIndices, authoredImageCount: authored.reduce((n, c) => n + c.images.length, 0), expected404: negative, recovered, errors, violations, noPlaceholderRequests: true });
      console.log(`Card artwork ${width}: PASS (authored art preserved, text-only cohort, expected404 observed, no placeholder substitution)`);
    } finally { await context.close(); }
  }
  fs.writeFileSync(path.join(out, 'card-artwork-results.json'), JSON.stringify(results, null, 2));
};
