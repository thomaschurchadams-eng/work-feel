const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const axePath = require.resolve('axe-core/axe.min.js');
const contract = require('./contracts.json');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'design-results');
fs.mkdirSync(out, { recursive: true });

async function serve() {
  const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.m4a':'audio/mp4' };
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

(async () => {
  const local = process.env.CUAI_DESIGN_BASE_URL ? null : await serve();
  const base = process.env.CUAI_DESIGN_BASE_URL || local.url;
  const browser = await chromium.launch({ headless: true, ...(process.env.CUAI_BROWSER_EXECUTABLE ? { executablePath:process.env.CUAI_BROWSER_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const route of contract.routes) {
      const widths = ['/topics.html','/topics/payments.html','/intelligence/regulatory-watch.html'].includes(route) ? [320,390,1024,1440] : [390,1440];
      for (const width of widths) {
        const context = await browser.newContext({ viewport:{width,height:width < 700 ? 844 : 1000}, reducedMotion:'reduce' });
        await context.addInitScript(() => { try { localStorage.setItem('cuai_cai_banner_variant_2026_09','v1a_current_training'); } catch { /* Third-party opaque frames have no local storage. */ } });
        await context.route('**/*', request => {
          const req = request.request();
          if (!['GET','HEAD'].includes(req.method())) return request.abort();
          if (new URL(req.url()).origin !== new URL(base).origin) return request.abort();
          return request.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(new URL(route, base).href, { waitUntil:'networkidle' });
        await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading='eager'; return image.decode().catch(() => {}); })));
        await page.evaluate(() => document.fonts.ready);
        const facts = await page.evaluate(() => {
          const title = document.querySelector('h1');
          const titleSize = title ? parseFloat(getComputedStyle(title).fontSize) : 0;
          const overruns = [];
          for (const heading of document.querySelectorAll('.card h2,.card h3')) {
            const box = heading.closest('.card').getBoundingClientRect();
            if (!box.width) continue;
            const range = document.createRange(); range.selectNodeContents(heading);
            for (const line of range.getClientRects()) if (line.right > box.right+2 || line.left < box.left-2) overruns.push(heading.textContent.trim());
          }
          const ordinary = [...document.querySelectorAll('body[data-section="topics"] .card h2,.intelligence-record h2')].map(h => parseFloat(getComputedStyle(h).fontSize));
          return { blank:!document.body.innerText.trim(), mainCount:document.querySelectorAll('main').length, h1Count:document.querySelectorAll('h1').length, titleSize, ordinaryCardSizes:ordinary, primaryNavigation:[...document.querySelectorAll('header nav a')].map(a => a.textContent.trim()), overflow:document.documentElement.scrollWidth>innerWidth, overruns, brokenImages:[...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')), sponsorCount:document.querySelectorAll('[data-cai-banner-placement="sitewide_header"]').length };
        });
        let menuPassed = true;
        if (width < 700) {
          await page.locator('.nav-toggle').click();
          menuPassed = await page.locator('.nav-toggle').getAttribute('aria-expanded') === 'true' && await page.locator('#primary-navigation').isVisible();
          await page.keyboard.press('Escape');
          menuPassed = menuPassed && await page.locator('.nav-toggle').getAttribute('aria-expanded') === 'false';
        }
        let searchPassed = true;
        const search = route.includes('/intelligence/vendors') ? '#vendor-search' : route.includes('/intelligence/regulatory-watch') ? '#reg-search' : null;
        if (search) {
          const before = await page.locator('.intelligence-record:visible').count();
          await page.locator(search).fill('zzzz-cuai-design-no-match');
          searchPassed = await page.locator('.intelligence-record:visible').count() === 0;
          const empty = search === '#vendor-search' ? '#vendor-empty' : '#reg-empty';
          searchPassed = searchPassed && await page.locator(empty).isVisible();
          await page.locator(search).fill('');
          searchPassed = searchPassed && await page.locator('.intelligence-record:visible').count() === before;
        }
        let transcriptPassed = true;
        if (route.startsWith('/episodes/')) {
          await page.locator('summary').focus(); await page.keyboard.press('Enter');
          transcriptPassed = await page.locator('details').getAttribute('open') !== null;
          await page.keyboard.press('Enter');
        }
        await page.addScriptTag({ path:axePath });
        const accessibility = await page.evaluate(async () => {
          const result = await axe.run(document, { runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
          return result.violations.map(v => ({ id:v.id, impact:v.impact, description:v.description, nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) }));
        });
        const failed = [];
        if (response.status() !== 200 || facts.blank || facts.mainCount !== 1 || facts.h1Count !== 1) failed.push('page-structure');
        if (JSON.stringify(facts.primaryNavigation) !== JSON.stringify(contract.primaryNavigation)) failed.push('canonical-navigation');
        if (facts.titleSize < contract.pageTitleMinimumPx || facts.ordinaryCardSizes.some(n => n > contract.ordinaryCardTitleMaximumPx || n >= facts.titleSize)) failed.push('typography-hierarchy');
        if (facts.overflow || facts.overruns.length) failed.push('text-layout');
        if (facts.brokenImages.length || errors.length) failed.push('images-or-page-errors');
        if (!menuPassed || !searchPassed || !transcriptPassed) failed.push('interaction');
        if (accessibility.length) failed.push('accessibility');
        await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0,0); });
        const name = (route === '/' ? 'home' : route.replace(/[^a-z0-9]/gi,'-')) + '-' + width;
        await page.screenshot({ path:path.join(out,name+'.png'), fullPage:true, animations:'disabled' });
        results.push({route,width,httpStatus:response.status(),facts,menuPassed,searchPassed,transcriptPassed,accessibility,errors,failed,screenshot:name+'.png'});
        fs.writeFileSync(path.join(out,'results.json'), JSON.stringify({base,contractVersion:contract.version,results},null,2));
        console.log(`${route} ${width}: ${failed.length ? 'FAIL '+failed.join(', ') : 'PASS'}`);
        await context.close();
      }
    }
  } finally { await browser.close(); if (local) await new Promise(resolve => local.server.close(resolve)); }
  const failures = results.filter(r => r.failed.length);
  console.log(`${results.length} rendered checks; ${failures.length} failed. Evidence: design-results/`);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
