const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

// Run in the ordinary rendered gate. Inventory all authored content headers,
// including older articles that newest/changed-route selection cannot cover.
module.exports = async function verifyDateHeader(browser, base, out) {
  const routes = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n')
    .filter(file => /^(news\/|insight-)/.test(file) && /<main\b[\s\S]*?<header\b/.test(fs.readFileSync(path.join(root, file), 'utf8')));
  const results = { articleHeaders: [], dates: [], publicationOrderingFixtures: [] };
  const save = () => fs.writeFileSync(path.join(out, 'date-header-results.json'), JSON.stringify({ base, ...results }, null, 2));
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    try {
      for (const file of routes) {
        await page.goto(new URL('/' + file, base).href);
        await page.locator('main h1').waitFor();
        await page.evaluate(() => scrollTo(0, Math.max(...[...document.querySelectorAll('main header')].map(h => h.getBoundingClientRect().bottom + scrollY)) + 40));
        const facts = await page.evaluate(() => {
          const nav = document.querySelector('.site-header');
          return { scrollY, navPosition: getComputedStyle(nav).position, navBottom: nav.getBoundingClientRect().bottom,
            headers: [...document.querySelectorAll('main header')].map(h => ({ position: getComputedStyle(h).position, bottom: h.getBoundingClientRect().bottom })),
            overflow: document.documentElement.scrollWidth > innerWidth };
        });
        const row = { file, width, ...facts }; results.articleHeaders.push(row); save();
        assert.ok(facts.scrollY > 0, file + ' did not exercise scroll');
        assert.equal(facts.navPosition, 'sticky');
        assert.ok(facts.headers.every(h => !['sticky', 'fixed'].includes(h.position) && h.bottom <= facts.navBottom), file + ' content header overlays reading');
        assert.equal(facts.overflow, false, file + ' horizontal overflow');
        // A visible prose link must receive the pointer rather than the title panel.
        const link = page.locator('.article-body a').first();
        if (await link.count()) {
          await link.evaluate(el => el.scrollIntoView({ block: 'center' }));
          row.linkHit = await link.evaluate(el => {
            // An inline link can wrap. Its union bounding box contains blank
            // space; hit-test actual line boxes, not that empty area.
            const boxes = [...el.getClientRects()].filter(r => r.width && r.height);
            return boxes.map(r => { const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { rect: r.toJSON(), receivesPointer: top === el || el.contains(top), hit: top?.tagName + '.' + top?.className }; });
          });
          save();
          assert.ok(row.linkHit.length && row.linkHit.every(hit => hit.receivesPointer), file + ' prose link obstructed');
        }
        if (file.includes('card-dispute-evidence-clock')) {
          await page.screenshot({ path: path.join(out, `dispute-scrolled-${width}.png`) });
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: path.join(out, `dispute-top-${width}.png`), fullPage: false });
          const back = page.locator('.article-header a[href="insights.html"]');
          await Promise.all([page.waitForURL(new URL('/insights.html', base).href), back.click()]); assert.equal(new URL(page.url()).pathname, '/insights.html');
          await page.goBack(); await page.locator('main h1').waitFor();
          await back.focus(); await Promise.all([page.waitForURL(new URL('/insights.html', base).href), page.keyboard.press('Enter')]);
          assert.equal(new URL(page.url()).pathname, '/insights.html');
          await page.goBack(); await page.locator('main h1').waitFor();
          row.backLinkPointerKeyboardRepeat = true;
        }
      }
    } finally { await context.close(); save(); }
  }
  // These clocks bracket one retained historical publication, not today's
  // changing catalogue. Isolate that real record for the boundary journeys;
  // verifyAlerts and verify-site still render the complete current catalogue.
  // Unknown/newer-source ordering is exercised by the separate fixture below.
  const actualApp = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
  const dataStart = actualApp.indexOf('  const alertsData = [');
  const dataEnd = actualApp.indexOf('  // Maintained by the weekday operating cycle.');
  assert.ok(dataStart >= 0 && dataEnd > dataStart);
  const actualAlerts = vm.runInNewContext(actualApp.slice(dataStart, dataEnd) + '\nalertsData');
  const boundaryRecord = actualAlerts.find(item => item.slug === 'fincen-mexc-global-transfer-prohibition');
  assert.ok(boundaryRecord, 'retained historical publication is missing');
  assert.equal(boundaryRecord.publishedAt, '2026-11-09T20:35:32.856Z');
  const boundaryApp = actualApp.slice(0, dataStart) + '  const alertsData = ' + JSON.stringify([boundaryRecord]) + ';\n' + actualApp.slice(dataEnd);
  for (const width of [320, 390, 1440]) {
    for (const [clock, fresh, known, recent] of [['2026-11-11T12:00:00Z', true, true, true], ['2026-11-12T20:35:32.856Z', true, true, true], ['2026-11-12T20:35:32.857Z', false, true, true], ['2026-11-09T20:35:32.855Z', false, false, false], ['2026-11-23T20:35:32.856Z', false, true, true], ['2026-11-23T20:35:32.857Z', false, true, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(clock => { const RealDate = Date; window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return new RealDate(clock).getTime(); } }; }, clock);
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== new URL(base).origin) return route.abort();
        if (url.pathname === '/assets/app.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: boundaryApp });
        return route.continue();
      });
      const page = await context.newPage();
      try {
        await page.goto(new URL('/alerts/', base).href);
        const card = page.locator('#fincen-mexc-global-transfer-prohibition');
        await card.waitFor();
        const dates = await card.locator('.alert-dates').innerText();
        if (known) assert.match(dates, /CUAI published Nov 9, 2026/);
        else assert.match(dates, /CUAI publication date not verified/);
        assert.match(dates, /Source date Nov 6, 2026/);
        assert.equal(await page.locator('.alert-dates').filter({ hasText: 'CUAI published' }).count(), known ? 1 : 0);
        const filter = page.getByRole('checkbox', { name: 'Published in last 14 days' });
        assert.ok(await filter.count());
        assert.equal(await page.locator('#alerts-list > article[id]').first().getAttribute('id'), 'fincen-mexc-global-transfer-prohibition');
        await filter.check();
        assert.equal(await page.locator('#alerts-list > article[id]').count(), recent ? 1 : 0);
        await filter.uncheck();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (clock.includes('11T')) { await card.locator('.alert-meta').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `alert-dates-${width}.png`) }); }
        await page.goto(new URL('/', base).href);
        const home = await page.locator('#latest-alert').innerText();
        assert.equal(home.includes('FinCEN Orders'), fresh, 'verified CUAI posting time must control the 72-hour window');
        assert.equal(await page.locator('#alerts-ticker a[href="/alerts/#fincen-mexc-global-transfer-prohibition"]').count() > 0, recent);
        let dateContrastViolations = [];
        if (fresh) {
          assert.match(home, /CUAI published Nov 9, 2026/); assert.match(home, /Source date Nov 6, 2026/);
          await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
          dateContrastViolations = await page.evaluate(async () => (await axe.run(document.querySelector('#latest-alert'), { runOnly: { type:'rule', values:['color-contrast'] } })).violations.map(v => ({ id:v.id, nodes:v.nodes.map(n => n.target) })));
          assert.deepEqual(dateContrastViolations, [], 'active Alert date labels must meet contrast, independent of the real clock');
        }
        if (clock.includes('11T')) await page.locator('#latest-alert').screenshot({ path: path.join(out, `home-alert-publication-${width}.png`) });
        results.dates.push({ width, clock, dates, homepageFresh: fresh, verifiedPublication: known, recentFilterAndTicker: recent, dateContrastViolations, catalogueScope: 'retained-historical-publication-boundary-fixture' }); save();
      } finally { await context.close(); }
    }
  }
  // Explicitly synthetic ordering fixture: a newer CUAI post with an older
  // source must outrank an older post with a newer source. Unknown history must
  // remain visible in the archive but never enter freshness surfaces.
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => { const RealDate = Date; window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-11T12:00:00Z'])); } static now() { return new RealDate('2026-11-11T12:00:00Z').getTime(); } }; });
    const fixture = [
      { slug:'older-post', headline:'Synthetic older post', date:'Nov 8, 2026', publishedAt:'2026-11-09T20:00:00Z', publicationEvidence:'https://example.test/older' },
      { slug:'unknown-post', headline:'Synthetic unknown history', date:'Nov 11, 2026' },
      { slug:'newer-post', headline:'Synthetic newer post with old source', date:'Oct 1, 2026', publishedAt:'2026-11-10T20:00:00Z', publicationEvidence:'https://example.test/newer' },
      { slug:'day-only-post', headline:'Synthetic known day only', date:'Nov 6, 2026', publishedAt:'2026-11-07', publicationEvidence:'https://example.test/day' }
    ].map(item => ({ ...item, label:'Synthetic fixture', summary:'Test data, not a published Alert.', impact:'No real operating action.', sourceName:'Synthetic source', sourceUrl:'https://example.test/'+item.slug }));
    const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
    const fixtureApp = app.slice(0, app.indexOf('  const alertsData = [')) + '  const alertsData = ' + JSON.stringify(fixture) + ';\n' + app.slice(app.indexOf('  // Maintained by the weekday operating cycle.'));
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/assets/app.js') return route.fulfill({ status:200, contentType:'text/javascript', body:fixtureApp });
      return route.continue();
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/alerts/', base).href);
      const order = await page.locator('#alerts-list > article[id]').evaluateAll(es => es.map(e => e.id));
      assert.deepEqual(order, ['newer-post','older-post','day-only-post','unknown-post']);
      assert.match(await page.locator('#unknown-post').innerText(), /CUAI publication date not verified/);
      await page.getByRole('checkbox', { name:'Published in last 14 days' }).check();
      assert.deepEqual(await page.locator('#alerts-list > article[id]').evaluateAll(es => es.map(e => e.id)), ['newer-post','older-post']);
      await page.goto(new URL('/', base).href);
      assert.match(await page.locator('#latest-alert').innerText(), /Synthetic newer post with old source/);
      results.publicationOrderingFixtures.push({ width, order, recent:['newer-post','older-post'], homepage:'newer-post', synthetic:true }); save();
    } finally { await context.close(); }
  }
  console.log(`Date/header regression: ${results.articleHeaders.length} scrolled article checks; ${results.dates.length} date/freshness journeys; ${results.publicationOrderingFixtures.length} synthetic ordering journeys PASS`);
};
