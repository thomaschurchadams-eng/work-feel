import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://creditunionainews.com';
const TODAY = new Date().toISOString().slice(0, 10);
const SKIP_DIRS = new Set(['.git', '.vercel', 'node_modules', 'api', 'automation', 'tests']);
const UTILITY_FILES = new Set([
  'corrections.html',
  'intelligence/changes.html',
  'privacy.html',
  'subscribe.html',
  'newsletter-log.html',
  'news/article-template.html'
]);
const SITEMAP_EXCLUSIONS = new Set([...UTILITY_FILES]);

const LINKEDIN_ICON = '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.985V9h3.111v1.561h.043c.434-.82 1.494-1.685 3.073-1.685 3.287 0 3.894 2.164 3.894 4.977v6.599zM5.337 7.433a1.804 1.804 0 1 1 0-3.608 1.804 1.804 0 0 1 0 3.608zM6.956 20.452H3.719V9h3.237v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.545C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.273V1.727C24 .774 23.2 0 22.222 0h.003z"/></svg><span class="sr-only">LinkedIn</span>';

const HEADER = `  <header>
    <div class="container navbar">
      <a href="/" class="brand" aria-label="CreditUnionAI News home">
        <img src="/assets/download.png" alt="CreditUnionAI News logo" class="brand-logo">
      </a>
      <div class="nav-toggle" aria-label="Toggle navigation" role="button" tabindex="0">
        <span></span><span></span><span></span>
      </div>
      <nav class="nav-links" aria-label="Primary navigation">
        <a href="/alerts/">Alerts</a>
        <a href="/news.html">News</a>
        <a href="/insights.html">Insights</a>
        <a href="/topics.html">Topics</a>
        <a href="/intelligence/">Intelligence</a>
        <a href="/episodes.html">Episodes</a>
        <a href="/newsletter.html">Subscribe</a>
        <a href="/about.html">About</a>
        <a class="social-link" href="https://www.linkedin.com/company/creditunionai-news/" target="_blank" rel="noopener" aria-label="LinkedIn">${LINKEDIN_ICON}</a>
      </nav>
    </div>
  </header>`;

const FOOTER = `  <footer class="footer">
    <div class="container" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
      <div>© CreditUnionAI News</div>
      <div class="footer-links">
        <a href="/news.html">News</a>
        <a href="/insights.html">Insights</a>
        <a href="/topics.html">Topics</a>
        <a href="/intelligence/">Intelligence</a>
        <a href="/newsletter.html">Subscribe</a>
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/corrections.html">Editorial Standards</a>
        <a href="/privacy.html">Privacy</a>
        <a class="social-link" href="https://www.linkedin.com/company/creditunionai-news/" target="_blank" rel="noopener" aria-label="LinkedIn">${LINKEDIN_ICON}</a>
      </div>
    </div>
  </footer>`;

const DESCRIPTION_OVERRIDES = new Map([
  ['episodes.html', 'Listen to concise CreditUnionAI News podcast episodes on artificial intelligence strategy, operations, governance and member experience.'],
  ['alerts/index.html', 'Fast, source-linked artificial intelligence developments with specific operating implications for credit-union leaders.'],
  ['sponsorships/index.html', 'Sponsorship and partnership opportunities for organizations seeking to reach credit-union leaders through CreditUnionAI News.'],
  ['insight-credit-union-ai-use-cases.html', 'Practical artificial intelligence use cases for credit unions across lending, fraud, operations, member service and governance.'],
  ['insight-prioritizing-ai-automation.html', 'A practical framework for prioritizing artificial intelligence automation opportunities across credit-union back-office operations.'],
  ['insight-ces-ai-financial-services.html', 'What CES signals about the next phase of artificial intelligence adoption in financial services and credit unions.'],
  ['news/ncuas-ai-opportunities-risks.html', 'NCUA artificial intelligence resources and guidance give credit unions a practical starting point for governance, risk management and adoption.']
]);

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

function stripTags(value = '') {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function canonicalPath(file) {
  if (file === 'index.html') return '/';
  if (file === 'intelligence/index.html') return '/intelligence/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

function isArticleFile(file) {
  return (file.startsWith('news/') && file.endsWith('.html') && file !== 'news/article-template.html') || /^insight-[^/]+\.html$/.test(file);
}

function deriveDescription(html, file) {
  if (DESCRIPTION_OVERRIDES.has(file)) return DESCRIPTION_OVERRIDES.get(file);
  const heading = stripTags((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length >= 45 && !/cookie|copyright|subscribe/i.test(text));
  const base = paragraphs[0] || heading || 'Artificial intelligence reporting and analysis for credit-union leaders.';
  const combined = heading && !base.toLowerCase().includes(heading.toLowerCase()) ? `${heading}. ${base}` : base;
  return combined.length <= 158 ? combined : `${combined.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

function upsertMeta(html, name, content) {
  const matcher = new RegExp(`<meta\\b[^>]*name=["']${name}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${escapeAttribute(content)}">`;
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/title>/i, `</title>\n  ${tag}`);
}

function upsertCanonical(html, href) {
  const matcher = /<link\b[^>]*rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${href}">`;
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/title>/i, `</title>\n  ${tag}`);
}

function ensureViewport(html) {
  if (/<meta\b[^>]*name=["']viewport["']/i.test(html)) return html;
  return html.replace(/<meta\b[^>]*charset=[^>]*>/i, (match) => `${match}\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
}

function normalizeChrome(html) {
  if (/<header\b[^>]*>[\s\S]*?<\/header>/i.test(html)) html = html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i, HEADER);
  if (/<footer\b[^>]*>[\s\S]*?<\/footer>/i.test(html)) html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, FOOTER);
  return html;
}

function fixAlertsHeading(html) {
  if (/<h1\b/i.test(html)) return html;
  return html.replace(
    /(<div class="container">\s*)(<div class="grid cards-3" id="alerts-list">)/i,
    `$1<div class="section-header"><div><p class="eyebrow">AI Newsroom</p><h1>AI Newsroom Alerts</h1><p class="lead">Fast, source-linked developments with practical implications for credit-union leaders.</p></div></div>\n          $2`
  );
}

function inferDimensions(html, file) {
  const text = stripTags(html).toLowerCase();
  const functionId = /loan|lending|underwriting|collections/.test(text)
    ? 'lending-collections'
    : /payment|card|deposit|fednow|wallet/.test(text)
      ? 'payments-deposits'
      : /fraud|identity|compliance|regulat|governance|risk/.test(text)
        ? 'risk-compliance'
        : /cyber|security|cloud|api|data/.test(text)
          ? 'it-data-cybersecurity'
          : /member service|contact center|customer service|messaging|assistant/.test(text)
            ? 'member-service'
            : /vendor|core banking|provider/.test(text)
              ? 'vendor-management'
              : /marketing|growth|personalization/.test(text)
                ? 'marketing-growth'
                : /workforce|employee|training|skills/.test(text)
                  ? 'hr-training'
                  : 'operations';

  const technology = /fraud/.test(text)
    ? 'fraud-analytics'
    : /identity|biometric/.test(text)
      ? 'identity-biometrics'
      : /agentic|ai agent|automation/.test(text)
        ? 'agents-automation'
        : /core banking|cloud|api|mcp/.test(text)
          ? 'core-api-cloud'
          : /underwriting|decisioning|analytics/.test(text)
            ? 'data-decisioning'
            : /chat|assistant|contact center|voice/.test(text)
              ? 'conversational-ai'
              : /personalization|recommendation/.test(text)
                ? 'personalization'
                : /privacy|cyber|security/.test(text)
                  ? 'privacy-security'
                  : /regulat|compliance|governance/.test(text)
                    ? 'regtech-monitoring'
                    : 'generative-ai';

  const format = /checklist/.test(text)
    ? 'checklist'
    : /how to|guide|what .* should|framework/.test(text)
      ? 'explainer'
      : file.startsWith('insight-')
        ? 'analysis'
        : 'reported-news';
  const audience = /board|director/.test(text) ? 'board' : /frontline|employee|agent/.test(text) ? 'practitioner' : 'executive';
  const maturity = /future|long-term|next phase/.test(text) ? 'emerging' : 'practical-now';
  return { section: file.startsWith('news/') ? 'news' : 'insights', functionId, technology, format, audience, maturity };
}

function ensureArticleDimensions(html, file) {
  if (!isArticleFile(file) || /\bdata-section=["']/.test(html)) return html;
  const dims = inferDimensions(html, file);
  return html.replace(/<body\b([^>]*)>/i, `<body$1 data-section="${dims.section}" data-editorial-function="${dims.functionId}" data-technology="${dims.technology}" data-content-format="${dims.format}" data-audience="${dims.audience}" data-maturity="${dims.maturity}" data-qc-inferred="true">`);
}

function absoluteUrl(raw, file) {
  if (!raw) return null;
  try { return new URL(raw, `${ORIGIN}${canonicalPath(file)}`).href; } catch { return null; }
}

function ensureArticleSchema(html, file, description) {
  if (!isArticleFile(file) || /["']@type["']\s*:\s*["'](?:NewsArticle|Article)["']/i.test(html)) return html;
  const headline = stripTags((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || 'CreditUnionAI News article');
  const firstImage = (html.match(/<img\b[^>]*src=["']([^"']+)["']/i) || [])[1] || '/assets/download.png';
  const dateMatch = (html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i) || [])[1]
    || (html.match(/<meta\b[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) || [])[1];
  const schema = {
    '@context': 'https://schema.org',
    '@type': file.startsWith('news/') ? 'NewsArticle' : 'Article',
    headline,
    description,
    mainEntityOfPage: `${ORIGIN}${canonicalPath(file)}`,
    image: [absoluteUrl(firstImage, file)],
    author: { '@type': 'Organization', name: 'CreditUnionAI News' },
    publisher: {
      '@type': 'Organization',
      name: 'CreditUnionAI News',
      logo: { '@type': 'ImageObject', url: `${ORIGIN}/assets/download.png` }
    },
    dateModified: TODAY
  };
  if (dateMatch) schema.datePublished = dateMatch;
  const tag = `  <script type="application/ld+json">${JSON.stringify(schema)}</script>\n`;
  return html.replace(/<\/head>/i, `${tag}</head>`);
}

function validPublicHtml(file) {
  if (!file.endsWith('.html') || file.startsWith('templates/') || file.startsWith('tests/')) return false;
  if (SITEMAP_EXCLUSIONS.has(file)) return false;
  return true;
}

function sitemapUrl(file) {
  return `${ORIGIN}${canonicalPath(file)}`;
}

function writeSitemaps(files) {
  const urls = [...new Set(files.filter(validPublicHtml).map(sitemapUrl))].sort((a, b) => {
    if (a === `${ORIGIN}/`) return -1;
    if (b === `${ORIGIN}/`) return 1;
    return a.localeCompare(b);
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(ROOT, 'sitemap.txt'), `${urls.join('\n')}\n`);
  return urls.length;
}

function writeRedirectConfig() {
  const configPath = path.join(ROOT, 'vercel.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { config = {}; }
  }
  const managedSources = new Set(['/subscribe.html', '/intelligence/index.html', '/newsletter-log.html', '/news/article-template.html', '/tests/:path*']);
  const redirects = Array.isArray(config.redirects) ? config.redirects.filter((entry) => !managedSources.has(entry.source)) : [];
  redirects.push(
    { source: '/subscribe.html', destination: '/newsletter.html', permanent: true },
    { source: '/intelligence/index.html', destination: '/intelligence/', permanent: true },
    { source: '/newsletter-log.html', destination: '/newsletter.html', permanent: true },
    { source: '/news/article-template.html', destination: '/news.html', permanent: true },
    { source: '/tests/:path*', destination: '/', permanent: false }
  );
  config.redirects = redirects;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function writeSubscribeFallback() {
  const file = path.join(ROOT, 'subscribe.html');
  if (!fs.existsSync(file)) return;
  fs.writeFileSync(file, `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Subscribe | CreditUnionAI News</title>\n  <meta name="description" content="Subscribe to the CreditUnionAI Weekly Briefing.">\n  <meta name="robots" content="noindex,follow">\n  <link rel="canonical" href="${ORIGIN}/newsletter.html">\n  <meta http-equiv="refresh" content="0; url=/newsletter.html">\n</head>\n<body>\n  <main><h1>Subscribe to CreditUnionAI News</h1><p><a href="/newsletter.html">Continue to the subscription page</a>.</p></main>\n</body>\n</html>\n`);
}

const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
let changed = 0;

for (const file of htmlFiles) {
  const abs = path.join(ROOT, file);
  let html = fs.readFileSync(abs, 'utf8');
  const original = html;

  if (file !== 'subscribe.html') {
    html = normalizeChrome(html);
    html = ensureViewport(html);
  }

  let description = '';
  if (!file.startsWith('templates/') && file !== 'subscribe.html') {
    const existing = (html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) || [])[1];
    description = DESCRIPTION_OVERRIDES.get(file) || (existing && existing.trim().length > 20 ? existing.trim() : deriveDescription(html, file));
    html = upsertMeta(html, 'description', description);
    html = upsertCanonical(html, `${ORIGIN}${canonicalPath(file)}`);
  }

  if (UTILITY_FILES.has(file) && file !== 'subscribe.html') html = upsertMeta(html, 'robots', 'noindex,follow');
  if (file === 'alerts/index.html') html = fixAlertsHeading(html);
  html = ensureArticleDimensions(html, file);
  html = ensureArticleSchema(html, file, description || deriveDescription(html, file));

  html = html
    .replace(/\.\.\/alerts\/#fis-tests-anthropic-mythos-5-financial-infrastructure/g, '/alerts/')
    .replace(/href=["'](?:\.\.\/)?intelligence\/index\.html["']/g, 'href="/intelligence/"');

  if (html !== original) {
    fs.writeFileSync(abs, html);
    changed += 1;
  }
}

writeSubscribeFallback();
writeRedirectConfig();
const sitemapEntries = writeSitemaps(allFiles);

console.log(JSON.stringify({ changedHtmlFiles: changed, sitemapEntries, date: TODAY }, null, 2));
