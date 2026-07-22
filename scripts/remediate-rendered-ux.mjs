import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.vercel', 'node_modules', 'api', 'automation', 'tests']);
const LINKEDIN_ICON = '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.985V9h3.111v1.561h.043c.434-.82 1.494-1.685 3.073-1.685 3.287 0 3.894 2.164 3.894 4.977v6.599zM5.337 7.433a1.804 1.804 0 1 1 0-3.608 1.804 1.804 0 0 1 0 3.608zM6.956 20.452H3.719V9h3.237v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.545C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.273V1.727C24 .774 23.2 0 22.222 0h.003z"/></svg><span class="sr-only">LinkedIn</span>';

const HEADER = `<a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <div class="container navbar">
      <a href="/" class="brand" aria-label="CreditUnionAI News home">
        <img src="/assets/download.png" alt="CreditUnionAI News" class="brand-logo">
      </a>
      <button type="button" class="nav-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation">
        <span></span><span></span><span></span>
      </button>
      <nav id="primary-navigation" class="nav-links" aria-label="Primary navigation">
        <a href="/alerts/">Alerts</a>
        <a href="/news.html">News</a>
        <a href="/insights.html">Insights</a>
        <a href="/intelligence/">Intelligence</a>
        <a href="/episodes.html">Episodes</a>
        <a class="nav-subscribe" href="/newsletter.html">Subscribe</a>
        <a class="social-link" href="https://www.linkedin.com/company/creditunionai-news/" target="_blank" rel="noopener" aria-label="Follow CreditUnionAI News on LinkedIn">${LINKEDIN_ICON}</a>
      </nav>
    </div>
  </header>`;

const FOOTER = `  <footer class="footer">
    <div class="container footer-shell">
      <div class="footer-brand">© CreditUnionAI News</div>
      <div class="footer-links">
        <a href="/alerts/">Alerts</a>
        <a href="/news.html">News</a>
        <a href="/insights.html">Insights</a>
        <a href="/topics.html">Topics</a>
        <a href="/intelligence/">Intelligence</a>
        <a href="/episodes.html">Episodes</a>
        <a href="/newsletter.html">Subscribe</a>
        <a href="/sponsorships/">Sponsorships</a>
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/corrections.html">Editorial Standards</a>
        <a href="/privacy.html">Privacy</a>
        <a class="social-link" href="https://www.linkedin.com/company/creditunionai-news/" target="_blank" rel="noopener" aria-label="Follow CreditUnionAI News on LinkedIn">${LINKEDIN_ICON}</a>
      </div>
    </div>
  </footer>`;

const CSS = `
/* RENDERED_UX_REMEDIATION */
:root { --link-teal: #0b746c; }
html { scroll-padding-top: 92px; }
.skip-link { position:fixed; left:12px; top:8px; z-index:1000; transform:translateY(-160%); background:#fff; color:var(--navy); padding:10px 14px; border-radius:8px; box-shadow:var(--shadow); font-weight:800; }
.skip-link:focus { transform:translateY(0); }
.site-header { min-height:0; }
.navbar { padding:10px 0; min-height:76px; }
.brand { height:56px; max-height:56px; max-width:265px; }
.brand-logo { max-height:56px; }
.nav-links { gap:5px; }
.nav-links a { padding:8px 10px; font-size:.95rem; }
.nav-links .nav-subscribe { background:var(--teal); color:var(--navy); box-shadow:0 8px 18px rgba(31,182,170,.22); }
.nav-links .nav-subscribe:hover { background:#2bc8bb; color:var(--navy); }
.nav-toggle { appearance:none; border:0; background:transparent; padding:10px; border-radius:10px; }
.nav-toggle:hover { background:rgba(31,182,170,.1); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline:3px solid #e58b00; outline-offset:3px; }
.ticker-bar { position:relative; z-index:10; }
.ticker-track { padding:7px 0; }
.ticker-item { padding:5px 9px; }
.ticker-label { color:#41d7ca; }
.link, .alert-source a, .mailto-secondary { color:var(--link-teal); }
.eyebrow { color:var(--link-teal); }
.hero .eyebrow, .newsletter-hero .eyebrow { color:#41d7ca; }
.btn-primary:hover { color:var(--navy); }
.card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:20px; align-items:stretch; }
.card-grid > .card { height:100%; }
.footer-shell { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; }
.footer-brand { white-space:nowrap; padding-top:2px; }
.footer .footer-links { justify-content:flex-end; max-width:900px; }
main h1 { line-height:1.15; }
.article-kicker-row { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
.article-kicker-row .label-tag { margin-bottom:0; }
.article-summary { font-size:1.08rem; line-height:1.7; color:#34445a; }
.article-body { font-size:1.1rem; line-height:1.75; }
.article-body h2 { line-height:1.22; }
.article-body a { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
.article-newsletter-cta { padding:24px 28px; }
.article-newsletter-cta h2 { line-height:1.2; }
.home-news-actions { grid-column:1 / -1; display:flex; justify-content:center; gap:14px; padding-top:8px; }
.growth-band { padding:24px 0 8px; }
.growth-band-shell { display:grid; grid-template-columns:minmax(0,1.3fr) auto; align-items:center; gap:28px; padding:30px; background:#0f294b; color:#fff; border-radius:18px; box-shadow:var(--shadow); }
.growth-band h2 { color:#fff; margin:5px 0 8px; }
.growth-band p { color:#dbe8f2; max-width:760px; }
.growth-band .button-row { justify-content:flex-end; }
.podcast-summary { max-width:850px; }
.alerts-toolbar { display:flex; align-items:end; justify-content:space-between; gap:18px; flex-wrap:wrap; background:#fff; border:1px solid var(--soft-gray); border-radius:14px; padding:16px; margin:0 0 22px; box-shadow:0 8px 24px rgba(11,31,59,.08); }
.alerts-search { flex:1 1 360px; }
.alerts-search label { display:block; margin-bottom:6px; }
.alerts-search input { width:100%; padding:11px 13px; border:1px solid #aeb8c8; border-radius:10px; background:#fff; font:inherit; }
.alert-count { color:#526273; font-weight:700; padding-bottom:10px; }
.alerts-more { display:flex; justify-content:center; margin-top:24px; }
.alerts-more[hidden] { display:none; }
.newsletter-value-grid { margin-top:28px; }
.newsletter-value-grid .card { min-height:190px; }
.newsletter-request-note { color:#dbe8f2; font-size:.9rem; margin-top:12px; max-width:580px; }
.intelligence-method { margin-top:32px; }
.intelligence-method .button-row { margin-top:16px; }
@media (max-width:900px) {
  .navbar { min-height:64px; }
  .brand { height:48px; max-height:48px; max-width:230px; }
  .brand-logo { max-height:48px; }
  .nav-links { top:calc(100% + 6px); max-height:calc(100vh - 82px); padding:12px; }
  .nav-links a { padding:11px 12px; }
  .growth-band-shell { grid-template-columns:1fr; }
  .growth-band .button-row { justify-content:flex-start; }
}
@media (max-width:700px) {
  html { scroll-padding-top:68px; }
  .ticker-bar { display:none; }
  .navbar { min-height:60px; padding:7px 0; }
  .brand { height:44px; max-height:44px; max-width:210px; }
  .nav-links { max-height:calc(100vh - 72px); }
  .hero { padding:52px 0 58px; }
  .section { padding:48px 0; }
  .home-news-actions { flex-direction:column; align-items:stretch; }
  .home-news-actions .btn { width:100%; }
  .article-body { font-size:1.04rem; line-height:1.72; }
  .article-summary { font-size:1.03rem; }
  .article-newsletter-cta { padding:22px; }
  .article-newsletter-cta h2 { font-size:1.55rem; }
  .growth-band-shell { padding:24px; }
  .growth-band .btn { width:100%; }
  .footer-shell { flex-direction:column; }
  .footer .footer-links { justify-content:flex-start; gap:13px 16px; }
}
`;

function walk(dir, prefix = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(abs, rel));
    else results.push(rel.replaceAll('\\', '/'));
  }
  return results;
}

function normalizeChrome(html) {
  html = html.replace(/<a\b[^>]*class=["']skip-link["'][^>]*>[\s\S]*?<\/a>\s*/i, '');
  html = html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i, HEADER);
  html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, FOOTER);
  html = html.replace(/<main(?![^>]*\bid=)[^>]*>/i, (tag) => tag.replace('<main', '<main id="main-content"'));
  html = html.replace(/<iframe(?![^>]*\btitle=)([^>]*)>/gi, '<iframe title="CreditUnionAI News media player"$1>');
  if (!html.includes('article-kicker-row')) {
    html = html.replace(/(<a class=["']link["'][^>]*>← Back to (?:News|Insights)<\/a>)\s*(<span class=["']label-tag[^"']*["'][^>]*>[\s\S]*?<\/span>)/i, '<div class="article-kicker-row">$1$2</div>');
  }
  return html;
}

function updateHome(html) {
  html = html.replace(
    /<div class="button-row">\s*<a class="btn btn-primary" href="episodes\.html">Listen to Latest Episode<\/a>\s*<a class="btn btn-outline" href="newsletter\.html">Get Weekly Briefing<\/a>\s*<\/div>/i,
    '<div class="button-row"><a class="btn btn-primary" href="newsletter.html">Get Weekly Briefing</a><a class="btn btn-outline" href="news.html">Read Latest News</a></div>'
  );

  const newsHeading = html.indexOf('<h2>Latest News</h2>');
  const episodeHeading = html.indexOf('<h2>Latest Episode</h2>');
  if (newsHeading !== -1 && episodeHeading !== -1) {
    const newsSectionStart = html.lastIndexOf('<section', newsHeading);
    const episodeSectionStart = html.lastIndexOf('<section', episodeHeading);
    let section = html.slice(newsSectionStart, episodeSectionStart);
    section = section.replace('class="grid cards-3"', 'class="grid cards-3 home-news-grid"');
    const articles = [...section.matchAll(/<article class="card">[\s\S]*?<\/article>/g)];
    if (articles.length > 6) {
      const first = articles[0].index;
      const last = articles.at(-1).index + articles.at(-1)[0].length;
      const selected = articles.slice(0, 6).map((match) => match[0]).join('\n');
      const actions = `\n<div class="home-news-actions"><a class="btn btn-primary" href="/news.html">View all News</a><a class="btn" href="/topics.html">Browse by topic</a></div>`;
      section = `${section.slice(0, first)}${selected}${actions}${section.slice(last)}`;
      html = `${html.slice(0, newsSectionStart)}${section}${html.slice(episodeSectionStart)}`;
    }
  }

  if (!html.includes('class="growth-band"')) {
    const latestEpisode = html.indexOf('<h2>Latest Episode</h2>');
    const episodeSectionStart = latestEpisode === -1 ? -1 : html.lastIndexOf('<section', latestEpisode);
    if (episodeSectionStart !== -1) {
      const band = `<section class="growth-band"><div class="container"><div class="growth-band-shell"><div><p class="eyebrow">CreditUnionAI Weekly Briefing</p><h2>One useful briefing. Every Friday.</h2><p>The developments credit-union leaders need to understand, translated into practical operating implications.</p></div><div class="button-row"><a class="btn btn-primary" href="/newsletter.html">Get the weekly briefing</a></div></div></div></section>\n`;
      html = `${html.slice(0, episodeSectionStart)}${band}${html.slice(episodeSectionStart)}`;
    }
  }

  html = html.replace(
    /(<h3>Podcast Episode 2[^<]*<\/h3>)\s*<p>[\s\S]*?<\/p>/i,
    '$1<p class="podcast-summary">A concise discussion of where AI is already improving lending, fraud prevention, member service and operations—and what credit-union leaders should do next.</p>'
  );
  return html;
}

function updateNewsletter(html) {
  const main = `<main id="main-content">
<section class="newsletter-hero"><div class="container newsletter-hero-grid"><div><p class="eyebrow">Friday intelligence for credit-union leaders</p><h1>The important AI developments—without the noise.</h1><p class="lead">A concise weekly briefing connecting AI, fintech and regulation to the decisions credit-union boards, executives and functional leaders actually face.</p><div class="newsletter-benefits"><span>5-minute read</span><span>Practical implications</span><span>Credit-union specific</span></div><a class="btn btn-primary newsletter-subscribe-action" href="mailto:info@creditunionainews.com?subject=Subscribe%20to%20CreditUnionAI%20Weekly%20Briefing&body=Please%20add%20me%20to%20the%20CreditUnionAI%20Weekly%20Briefing.">Join the weekly briefing</a><p class="newsletter-request-note">Send a quick subscription request. We will confirm your place by email.</p></div><aside class="newsletter-preview"><p class="eyebrow">Every edition includes</p><h2>The week in one minute</h2><ul><li>The development leaders should understand</li><li>What changed across vendors, regulation and operations</li><li>Specific actions for credit-union teams</li><li>Only the source links worth your time</li></ul></aside></div></section>
<section class="section"><div class="container"><div class="section-header"><div><p class="eyebrow">Built for decisions</p><h2>What the briefing does differently</h2></div></div><div class="grid cards-3 newsletter-value-grid"><article class="card"><h3>Filters the noise</h3><p>Prioritizes developments with a credible, specific implication for credit unions.</p></article><article class="card"><h3>Translates the impact</h3><p>Connects each signal to governance, member service, risk, lending or operations.</p></article><article class="card"><h3>Points to action</h3><p>Gives leaders practical questions and next steps rather than a generic AI recap.</p></article></div></div></section>
<section class="section"><div class="container"><div class="section-header"><div><p class="eyebrow">Briefing archive</p><h2>Recent editions</h2><p class="lead">Web editions will appear here as they are published.</p></div></div><div class="newsletter-archive">
<!-- NEWSLETTER_ARCHIVE_START -->
<div class="newsletter-empty"><h3>Start with the current reporting.</h3><p>Explore the latest <a class="link" href="/news.html">News</a>, practical <a class="link" href="/insights.html">Insights</a> and source-linked <a class="link" href="/alerts/">Alerts</a>.</p></div>
<!-- NEWSLETTER_ARCHIVE_END -->
</div></div></section>
</main>`;
  return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, main);
}

function updateIntelligence(html) {
  const main = `<main id="main-content"><section class="section"><div class="container"><div style="max-width:850px;margin-bottom:34px"><span class="label-tag">Evidence Layer</span><h1>Credit Union AI Intelligence</h1><p class="article-summary">Evidence-backed vendor and regulatory intelligence for credit unions, connected to current reporting and practical analysis.</p><p>Track what vendors are changing, what regulators are signaling and how each development connects to credit-union functions. Records preserve primary sources and evidence labels; inclusion is not endorsement.</p></div><div class="card-grid"><article class="card"><span class="label-tag">Market Intelligence</span><h2><a href="vendors.html">AI Vendor Tracker</a></h2><p>Search normalized vendor capabilities and dated signals across core, digital banking, payments, fraud, lending and enterprise technology.</p><a class="link" href="vendors.html">Explore vendors →</a></article><article class="card"><span class="label-tag">Policy Intelligence</span><h2><a href="regulatory-watch.html">Regulatory Watch</a></h2><p>Follow primary-source guidance, hearings, resources and supervisory signals, mapped to affected functions and technologies.</p><a class="link" href="regulatory-watch.html">Open Regulatory Watch →</a></article></div><div class="card intelligence-method"><h2>How the intelligence is built</h2><p>CreditUnionAI News adds a structured record only when a development has an attributable source and a specific credit-union implication. Vendor claims remain clearly labeled until corroborated. Regulatory summaries link to the issuing authority and are not legal advice.</p><div class="button-row"><a class="btn btn-primary" href="../about.html">About CreditUnionAI News</a><a class="link" href="changes.html">Review the public change log →</a></div></div></div></section></main>`;
  return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, main);
}

function updateAlerts(html) {
  if (html.includes('id="alert-search"')) return html;
  return html.replace(
    '<div class="grid cards-3" id="alerts-list"></div>',
    '<div class="alerts-toolbar"><div class="alerts-search"><label for="alert-search">Search recent alerts</label><input id="alert-search" type="search" placeholder="Try lending, fraud, governance or a vendor"></div><div id="alert-count" class="alert-count" aria-live="polite"></div></div><div class="grid cards-3" id="alerts-list"></div><div id="alerts-more" class="alerts-more"><button type="button" id="show-more-alerts" class="btn btn-primary">Show more alerts</button></div>'
  );
}

function updateApp(app) {
  const navBlock = `  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    const setMenu = (open) => {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
    navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });
    document.addEventListener('click', (event) => {
      if (!navLinks.classList.contains('open')) return;
      if (!navLinks.contains(event.target) && !navToggle.contains(event.target)) setMenu(false);
    });
  }

  const currentPath = normalizePath(window.location.pathname);
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const linkPath = normalizePath(new URL(link.getAttribute('href'), window.location.origin).pathname);
    const active = linkPath === currentPath
      || (currentPath.startsWith('/news/') && linkPath === '/news.html')
      || (currentPath.startsWith('/insight-') && linkPath === '/insights.html')
      || (currentPath.startsWith('/intelligence/') && linkPath === '/intelligence');
    if (active) link.classList.add('active');
  });

  const newsletterForm = document.querySelector('#newsletter-form');`;

  app = app.replace(
    /  const navToggle = document\.querySelector\('\.nav-toggle'\);[\s\S]*?  const newsletterForm = document\.querySelector\('#newsletter-form'\);/,
    navBlock
  );

  const tickerBlock = `  const header = document.querySelector('header');
  const buildTicker = () => {
    const current = normalizePath(window.location.pathname);
    if (!header || !tickerAlerts.length || !['/', '/alerts'].includes(current)) return;
    const tickerBar = document.createElement('div');
    tickerBar.className = 'ticker-bar';
    tickerBar.innerHTML = \`
      <div class="container ticker-track" aria-label="Latest alerts">
        <a class="ticker-label" href="/alerts/">Latest Alerts</a>
        <div class="ticker-window"><div class="ticker-strip"></div></div>
      </div>
    \`;
    header.insertAdjacentElement('afterend', tickerBar);
    const strip = tickerBar.querySelector('.ticker-strip');
    if (!strip) return;
    const items = tickerAlerts.slice(0, 3);
    const renderItems = () => items.map((item) => \`<a class="ticker-item" href="/alerts/#\${item.slug}"><span class="ticker-pill">\${item.label}</span><span class="ticker-text">\${item.headline}</span></a>\`).join('');
    strip.innerHTML = \`\${renderItems()}\${renderItems()}\`;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggleAnimation = () => { strip.style.animationPlayState = prefersReducedMotion.matches ? 'paused' : 'running'; };
    toggleAnimation();
    prefersReducedMotion.addEventListener('change', toggleAnimation);
  };

  buildTicker();`;

  app = app.replace(/  const header = document\.querySelector\('header'\);[\s\S]*?  buildTicker\(\);/, tickerBlock);

  const alertsBlock = `  const alertsList = document.querySelector('#alerts-list');
  const alertSearch = document.querySelector('#alert-search');
  const alertCount = document.querySelector('#alert-count');
  const alertsMore = document.querySelector('#alerts-more');
  const showMoreAlerts = document.querySelector('#show-more-alerts');
  let alertLimit = 12;

  const renderAlerts = () => {
    if (!alertsList) return;
    const query = (alertSearch?.value || '').trim().toLowerCase();
    const filtered = preparedAlerts.filter((item) => !query || [item.label, item.headline, item.summary, item.impact, item.sourceName].join(' ').toLowerCase().includes(query));
    const visible = filtered.slice(0, alertLimit);
    if (alertCount) alertCount.textContent = query ? \`\${filtered.length} matching alerts\` : \`\${filtered.length} recent alerts\`;
    if (!filtered.length) {
      alertsList.innerHTML = '<article class="card alert-card" aria-live="polite"><div class="alert-content"><h3>No matching alerts.</h3><p>Try a broader topic or vendor name.</p></div></article>';
    } else {
      alertsList.innerHTML = visible.map((item) => \`
        <article class="card alert-card" id="\${item.slug}">
          <div class="meta"><span class="tag">\${item.label}</span><span class="tag tag-secondary">Alert</span></div>
          <div class="alert-content"><h3>\${item.headline}</h3><p class="alert-summary">\${item.summary}</p><p class="alert-impact"><span class="muted-label">What this means for credit unions:</span> \${item.impact || ''}</p><p class="alert-meta"><span class="alert-date">\${item.date || ''}</span> · <span class="alert-source"><span class="muted-label">Source:</span> <a href="\${item.sourceUrl}" target="_blank" rel="noopener noreferrer">\${item.sourceName}</a></span></p></div>
        </article>\`).join('');
    }
    if (alertsMore) alertsMore.hidden = visible.length >= filtered.length;
  };

  alertSearch?.addEventListener('input', () => { alertLimit = 12; renderAlerts(); });
  showMoreAlerts?.addEventListener('click', () => { alertLimit += 12; renderAlerts(); });
  renderAlerts();`;

  app = app.replace(/  const alertsList = document\.querySelector\('#alerts-list'\);[\s\S]*?  renderAlerts\(\);/, alertsBlock);
  return app;
}

let changed = 0;
const htmlFiles = walk(ROOT).filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const abs = path.join(ROOT, file);
  let html = fs.readFileSync(abs, 'utf8');
  const original = html;
  if (file !== 'subscribe.html') html = normalizeChrome(html);
  if (file === 'index.html') html = updateHome(html);
  if (file === 'newsletter.html') html = updateNewsletter(html);
  if (file === 'intelligence/index.html') html = updateIntelligence(html);
  if (file === 'alerts/index.html') html = updateAlerts(html);
  if (html !== original) { fs.writeFileSync(abs, html); changed += 1; }
}

const cssPath = path.join(ROOT, 'assets/styles.css');
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace(/\n\/\* RENDERED_UX_REMEDIATION \*\/[\s\S]*$/m, '');
fs.writeFileSync(cssPath, `${css.trimEnd()}\n${CSS}`);

const appPath = path.join(ROOT, 'assets/app.js');
const app = fs.readFileSync(appPath, 'utf8');
const updatedApp = updateApp(app);
if (updatedApp === app) throw new Error('Expected app.js UX blocks were not replaced.');
fs.writeFileSync(appPath, updatedApp);

console.log(JSON.stringify({ changedHtmlFiles: changed, updatedCss: true, updatedApp: true }, null, 2));
