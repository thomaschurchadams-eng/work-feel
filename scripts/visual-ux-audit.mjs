import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://creditunionainews.com';
const OUT = path.resolve('automation/ux-audit');
const pages = [
  { path: '/', name: 'Home' },
  { path: '/news/bank-of-america-ericaassist-generative-ai.html', name: 'Article' },
  { path: '/newsletter.html', name: 'Newsletter' },
  { path: '/topics.html', name: 'Topics' },
  { path: '/intelligence/', name: 'Intelligence' },
  { path: '/alerts/', name: 'Alerts' }
];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const shots = [];

const safeName = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

for (const item of pages) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const response = await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);

    const slug = `${safeName(item.name)}-${viewport.name}`;
    const topFile = path.join(OUT, `${slug}-top.png`);
    await page.screenshot({ path: topFile, fullPage: false });
    shots.push({ label: `${item.name} — ${viewport.name} — top`, file: topFile });

    const metrics = await page.evaluate(() => {
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) };
      };
      const text = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
      const header = document.querySelector('header');
      const ticker = document.querySelector('.ticker-bar');
      const nav = document.querySelector('.nav-links');
      const h1 = document.querySelector('h1');
      const articleBody = document.querySelector('.article-body');
      const newsletterCta = document.querySelector('.article-newsletter-cta');
      const cards = [...document.querySelectorAll('.card')].filter(visible);
      const navLinks = nav ? [...nav.querySelectorAll('a')].filter(visible).map((a) => text(a)) : [];
      const ctas = [...document.querySelectorAll('a,button,input[type="submit"]')]
        .filter(visible)
        .filter((el) => /subscribe|briefing|newsletter|follow|linkedin|read more|browse|listen|explore|request/i.test(text(el) || el.getAttribute('aria-label') || ''))
        .map((el) => ({ label: text(el) || el.getAttribute('aria-label'), href: el.href || '', rect: rect(el) }));
      const headings = [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((el) => ({ level: el.tagName, text: text(el).slice(0, 120), rect: rect(el), fontSize: getComputedStyle(el).fontSize }));
      const forms = [...document.querySelectorAll('form')].filter(visible).map((el) => ({ action: el.action, method: el.method, rect: rect(el), text: text(el).slice(0, 180) }));
      const paragraphs = [...document.querySelectorAll('.article-body p')].filter(visible);
      return {
        title: document.title,
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        header: rect(header),
        ticker: rect(ticker),
        stickyHeader: header ? getComputedStyle(header).position : null,
        navLinks,
        navLinkCount: navLinks.length,
        h1: h1 ? { text: text(h1), rect: rect(h1), fontSize: getComputedStyle(h1).fontSize, lineHeight: getComputedStyle(h1).lineHeight } : null,
        cardCount: cards.length,
        ctas,
        forms,
        headings,
        article: articleBody ? {
          rect: rect(articleBody),
          paragraphCount: paragraphs.length,
          bodyFontSize: getComputedStyle(articleBody).fontSize,
          bodyLineHeight: getComputedStyle(articleBody).lineHeight,
          newsletterCta: rect(newsletterCta)
        } : null,
        visibleTextStart: text(document.body).slice(0, 1200)
      };
    });

    let axe = { violations: [] };
    try {
      axe = await new AxeBuilder({ page }).analyze();
    } catch (error) {
      axe = { error: error.message, violations: [] };
    }

    if (viewport.name === 'mobile') {
      const toggle = page.locator('.nav-toggle');
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await page.waitForTimeout(250);
        const menuFile = path.join(OUT, `${slug}-menu.png`);
        await page.screenshot({ path: menuFile, fullPage: false });
        shots.push({ label: `${item.name} — mobile menu open`, file: menuFile });
        metrics.mobileMenu = await page.evaluate(() => {
          const nav = document.querySelector('.nav-links');
          if (!nav) return null;
          const r = nav.getBoundingClientRect();
          return {
            open: nav.classList.contains('open'),
            rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) },
            viewportHeight: innerHeight,
            scrollHeight: nav.scrollHeight,
            clientHeight: nav.clientHeight
          };
        });
        await toggle.click().catch(() => {});
      }
    }

    const docHeight = metrics.document.height;
    if (docHeight > viewport.height * 1.35) {
      const targetY = Math.max(0, docHeight - viewport.height);
      await page.evaluate((y) => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(350);
      const bottomFile = path.join(OUT, `${slug}-bottom.png`);
      await page.screenshot({ path: bottomFile, fullPage: false });
      shots.push({ label: `${item.name} — ${viewport.name} — bottom`, file: bottomFile });
    }

    results.push({ page: item.name, path: item.path, viewport: viewport.name, status: response?.status() || null, metrics, axeViolations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length })) });
    await context.close();
  }
}

await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

const reportBrowser = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const sections = [];
sections.push(`<section class="sheet summary"><h1>CreditUnionAI News rendered UX audit</h1><p>Generated ${new Date().toISOString()}</p><table><thead><tr><th>Page</th><th>Viewport</th><th>Header</th><th>Ticker</th><th>Nav links</th><th>Cards</th><th>Overflow</th><th>A11y violations</th></tr></thead><tbody>${results.map((r) => `<tr><td>${r.page}</td><td>${r.viewport}</td><td>${r.metrics.header?.height || 0}px</td><td>${r.metrics.ticker?.height || 0}px</td><td>${r.metrics.navLinkCount}</td><td>${r.metrics.cardCount}</td><td>${r.metrics.horizontalOverflow ? 'Yes' : 'No'}</td><td>${r.axeViolations.length}</td></tr>`).join('')}</tbody></table></section>`);
for (const shot of shots) {
  const data = await fs.readFile(shot.file, 'base64');
  sections.push(`<section class="sheet"><h2>${shot.label}</h2><img src="data:image/png;base64,${data}"></section>`);
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4 landscape; margin: 10mm; }
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17263a;margin:0}.sheet{page-break-after:always;min-height:180mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px}.sheet h2{font-size:18px;margin:0}.sheet img{max-width:100%;max-height:170mm;object-fit:contain;border:1px solid #cfd8e3}.summary{align-items:stretch}.summary h1{font-size:28px}.summary table{border-collapse:collapse;width:100%;font-size:11px}.summary th,.summary td{border:1px solid #cfd8e3;padding:6px;text-align:left}.summary th{background:#eef3f7}
</style></head><body>${sections.join('')}</body></html>`;
await reportBrowser.setContent(html, { waitUntil: 'load' });
await reportBrowser.pdf({ path: path.join(OUT, 'visual-report.pdf'), format: 'A4', landscape: true, printBackground: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
await reportBrowser.close();
await browser.close();
