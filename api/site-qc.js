const SITE_ORIGIN = 'https://creditunionainews.com';
const MAX_PAGES = 120;
const UTILITY_PATHS = new Set(['/corrections.html', '/intelligence/changes.html', '/privacy.html']);

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

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1].trim() : null;
}

function firstMatch(html, regex) {
  const match = html.match(regex);
  return match ? stripTags(match[1]) : null;
}

function metaContent(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if ((attr(tag, key) || '').toLowerCase() === value.toLowerCase()) return attr(tag, 'content');
  }
  return null;
}

function linkSignature(block, pageUrl) {
  if (!block) return [];
  return (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []).map((anchor) => {
    const raw = attr(anchor, 'href') || '';
    let href = raw;
    try {
      const url = new URL(raw, pageUrl);
      href = url.origin === SITE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch {}
    return { label: stripTags(anchor), href };
  });
}

function signatureKey(links) {
  return links.map((item) => `${item.label}|${item.href}`).join(' > ');
}

function count(regex, html) {
  return (html.match(regex) || []).length;
}

function normalizePageUrl(raw, base) {
  try {
    const url = new URL(raw, base);
    if (url.origin !== SITE_ORIGIN) return null;
    url.hash = '';
    url.search = '';
    const pathname = url.pathname;
    if (pathname.startsWith('/api/')) return null;
    if (pathname === '/' || pathname.endsWith('/') || pathname.endsWith('.html')) return url.href;
    return null;
  } catch {
    return null;
  }
}

function internalResourceUrl(raw, base) {
  try {
    const url = new URL(raw, base);
    if (url.origin !== SITE_ORIGIN) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'CUAI-Site-QC/1.0' }, redirect: 'follow' });
    const contentType = response.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? await response.text() : '';
    return { requestedUrl: url, finalUrl: response.url, status: response.status, contentType, html };
  } catch (error) {
    return { requestedUrl: url, finalUrl: url, status: 0, contentType: '', html: '', error: error.message };
  }
}

async function checkResource(url) {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'CUAI-Site-QC/1.0' } });
    if (response.status === 405) response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-32', 'User-Agent': 'CUAI-Site-QC/1.0' } });
    return { url, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { url, status: 0, finalUrl: url, error: error.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const suppliedCommit = typeof req.query?.commitSha === 'string' ? req.query.commitSha : '';
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!deploymentCommit || suppliedCommit !== deploymentCommit) {
    return res.status(403).json({ ok: false, error: 'deployment_commit_mismatch' });
  }

  const sitemapResponse = await fetch(`${SITE_ORIGIN}/sitemap.xml`, { headers: { 'User-Agent': 'CUAI-Site-QC/1.0' } });
  const sitemapText = await sitemapResponse.text();
  const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  const sitemapPaths = new Set(sitemapUrls.map((url) => new URL(url).pathname));
  const queued = new Set([...sitemapUrls, `${SITE_ORIGIN}/privacy.html`]);
  const fetched = new Map();

  for (let round = 0; round < 3 && fetched.size < MAX_PAGES; round++) {
    const batch = [...queued].filter((url) => !fetched.has(url)).slice(0, MAX_PAGES - fetched.size);
    if (!batch.length) break;
    const pages = await mapLimit(batch, 12, fetchPage);
    for (const page of pages) {
      fetched.set(page.requestedUrl, page);
      if (!page.html) continue;
      const hrefTags = page.html.match(/<a\b[^>]*>/gi) || [];
      for (const tag of hrefTags) {
        const discovered = normalizePageUrl(attr(tag, 'href'), page.finalUrl || page.requestedUrl);
        if (discovered && fetched.size + queued.size < MAX_PAGES * 2) queued.add(discovered);
      }
    }
  }

  const pageMap = new Map();
  for (const page of fetched.values()) {
    const url = new URL(page.finalUrl || page.requestedUrl);
    pageMap.set(url.pathname, page);
  }

  const issues = [];
  const headerGroups = new Map();
  const footerGroups = new Map();
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const internalResources = new Set();
  const pageRecords = [];

  for (const page of fetched.values()) {
    const pageUrl = page.finalUrl || page.requestedUrl;
    const pathname = new URL(pageUrl).pathname;
    if (page.status !== 200 || !page.html) {
      issues.push({ severity: 'high', type: 'page_fetch_failure', path: pathname, status: page.status, error: page.error || null });
      continue;
    }
    const html = page.html;
    const title = firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const description = metaContent(html, 'name', 'description');
    const canonicalTag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [])[0] || null;
    const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;
    const robots = metaContent(html, 'name', 'robots');
    const headerBlock = (html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i) || [])[0] || null;
    const footerBlock = (html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i) || [])[0] || null;
    const navBlock = headerBlock ? ((headerBlock.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i) || [])[0] || headerBlock) : null;
    const footerNavBlock = footerBlock ? ((footerBlock.match(/<div\b[^>]*class=["'][^"']*footer-links[^"']*["'][^>]*>[\s\S]*?<\/div>/i) || [])[0] || footerBlock) : null;
    const headerLinks = linkSignature(navBlock, pageUrl);
    const footerLinks = linkSignature(footerNavBlock, pageUrl);
    const headerKey = signatureKey(headerLinks);
    const footerKey = signatureKey(footerLinks);
    const h1Count = count(/<h1\b/gi, html);
    const imageTags = html.match(/<img\b[^>]*>/gi) || [];
    const missingAlt = imageTags.filter((tag) => attr(tag, 'alt') === null).map((tag) => attr(tag, 'src'));
    const emptyAlt = imageTags.filter((tag) => attr(tag, 'alt') === '').map((tag) => attr(tag, 'src'));
    const hrefTags = html.match(/<a\b[^>]*>/gi) || [];
    const hrefs = hrefTags.map((tag) => attr(tag, 'href')).filter(Boolean);
    const resourceTags = html.match(/<(?:img|script|link)\b[^>]*>/gi) || [];
    const resourceUrls = resourceTags.map((tag) => attr(tag, tag.toLowerCase().startsWith('<link') ? 'href' : 'src')).filter(Boolean);
    for (const raw of resourceUrls) {
      const resource = internalResourceUrl(raw, pageUrl);
      if (resource) internalResources.add(resource);
    }

    const expectedCanonical = `${SITE_ORIGIN}${pathname}`;
    const isUtility = UTILITY_PATHS.has(pathname);
    const inSitemap = sitemapPaths.has(pathname);
    const bodyDataDimensions = ['data-section', 'data-editorial-function', 'data-technology', 'data-content-format', 'data-audience', 'data-maturity']
      .filter((name) => new RegExp(`\\b${name}=["']`, 'i').test(html));
    const isArticle = pathname.startsWith('/news/') || /^\/insight-[^/]+\.html$/.test(pathname);
    const hasArticleSchema = /["']@type["']\s*:\s*["'](?:NewsArticle|Article)["']/i.test(html);
    const primaryNavCount = headerLinks.filter((link) => !/linkedin/i.test(link.label)).length;

    const record = {
      path: pathname,
      status: page.status,
      title,
      description,
      canonical,
      robots,
      inSitemap,
      isUtility,
      headerKey,
      headerLinks,
      footerKey,
      footerLinks,
      primaryNavCount,
      h1Count,
      missingAlt,
      emptyAlt,
      hasGa4: html.includes('G-RF6EFK06G5'),
      hasViewport: /<meta\b[^>]*name=["']viewport["']/i.test(html),
      hasNavToggle: /class=["'][^"']*nav-toggle/i.test(html),
      bodyDataDimensions,
      isArticle,
      hasArticleSchema,
      hrefs
    };
    pageRecords.push(record);

    if (!headerGroups.has(headerKey)) headerGroups.set(headerKey, []);
    headerGroups.get(headerKey).push(pathname);
    if (!footerGroups.has(footerKey)) footerGroups.set(footerKey, []);
    footerGroups.get(footerKey).push(pathname);
    if (title) {
      if (!titleOwners.has(title)) titleOwners.set(title, []);
      titleOwners.get(title).push(pathname);
    }
    if (description) {
      if (!descriptionOwners.has(description)) descriptionOwners.set(description, []);
      descriptionOwners.get(description).push(pathname);
    }

    if (!title) issues.push({ severity: 'high', type: 'missing_title', path: pathname });
    if (!description) issues.push({ severity: 'medium', type: 'missing_meta_description', path: pathname });
    if (!canonical) issues.push({ severity: 'medium', type: 'missing_canonical', path: pathname });
    else if (canonical !== expectedCanonical) issues.push({ severity: 'medium', type: 'canonical_mismatch', path: pathname, expected: expectedCanonical, actual: canonical });
    if (!record.hasViewport) issues.push({ severity: 'high', type: 'missing_viewport', path: pathname });
    if (!headerBlock) issues.push({ severity: 'high', type: 'missing_header', path: pathname });
    if (!footerBlock) issues.push({ severity: 'medium', type: 'missing_footer', path: pathname });
    if (h1Count !== 1) issues.push({ severity: h1Count === 0 ? 'high' : 'medium', type: 'h1_count', path: pathname, count: h1Count });
    if (missingAlt.length) issues.push({ severity: 'medium', type: 'images_missing_alt', path: pathname, images: missingAlt });
    if (inSitemap && /noindex/i.test(robots || '')) issues.push({ severity: 'high', type: 'sitemap_noindex_conflict', path: pathname });
    if (isUtility && inSitemap) issues.push({ severity: 'medium', type: 'utility_page_in_sitemap', path: pathname });
    if (headerLinks.some((link) => link.label.toLowerCase() === 'corrections')) issues.push({ severity: 'medium', type: 'corrections_in_primary_nav', path: pathname });
    if (primaryNavCount > 9) issues.push({ severity: 'medium', type: 'primary_nav_overloaded', path: pathname, count: primaryNavCount });
    if (!record.hasNavToggle && headerBlock) issues.push({ severity: 'medium', type: 'header_missing_mobile_toggle', path: pathname });
    if (!record.hasGa4) issues.push({ severity: 'medium', type: 'ga4_missing', path: pathname });
    if (isArticle && bodyDataDimensions.length < 6) issues.push({ severity: 'medium', type: 'article_analytics_dimensions_incomplete', path: pathname, present: bodyDataDimensions });
    if (isArticle && !hasArticleSchema) issues.push({ severity: 'medium', type: 'article_schema_missing', path: pathname });
  }

  for (const [title, paths] of titleOwners) {
    if (paths.length > 1) issues.push({ severity: 'medium', type: 'duplicate_title', title, paths });
  }
  for (const [description, paths] of descriptionOwners) {
    if (paths.length > 1) issues.push({ severity: 'low', type: 'duplicate_meta_description', description, paths });
  }

  for (const page of pageRecords) {
    for (const raw of page.hrefs) {
      let target;
      try { target = new URL(raw, `${SITE_ORIGIN}${page.path}`); } catch { continue; }
      if (target.origin !== SITE_ORIGIN || target.pathname.startsWith('/api/')) continue;
      const targetPage = pageMap.get(target.pathname);
      if ((target.pathname === '/' || target.pathname.endsWith('/') || target.pathname.endsWith('.html')) && (!targetPage || targetPage.status !== 200)) {
        issues.push({ severity: 'high', type: 'broken_internal_page_link', path: page.path, reference: raw, target: target.pathname, status: targetPage?.status || null });
      } else if (target.hash && targetPage?.html) {
        const anchor = target.hash.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`\\bid=["']${anchor}["']`, 'i').test(targetPage.html)) {
          issues.push({ severity: 'medium', type: 'missing_anchor_target', path: page.path, reference: raw, target: target.pathname, anchor: target.hash });
        }
      }
    }
  }

  const resourceChecks = await mapLimit([...internalResources].slice(0, 300), 20, checkResource);
  for (const resource of resourceChecks) {
    if (resource.status >= 400 || resource.status === 0) issues.push({ severity: 'high', type: 'broken_internal_resource', url: resource.url, status: resource.status, error: resource.error || null });
  }

  const headerVariants = [...headerGroups.entries()].map(([signature, paths]) => ({ signature, count: paths.length, paths })).sort((a, b) => b.count - a.count);
  const footerVariants = [...footerGroups.entries()].map(([signature, paths]) => ({ signature, count: paths.length, paths })).sort((a, b) => b.count - a.count);
  const indexedPagesMissingFromSitemap = pageRecords.filter((page) => !page.inSitemap && !/noindex/i.test(page.robots || '') && page.path !== '/privacy.html').map((page) => page.path);
  const sitemapFetchFailures = sitemapUrls.filter((url) => {
    const page = pageMap.get(new URL(url).pathname);
    return !page || page.status !== 200;
  });
  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.type.localeCompare(b.type));

  return res.status(200).json({
    ok: true,
    commitSha: deploymentCommit,
    generatedAt: new Date().toISOString(),
    summary: {
      crawledPageCount: pageRecords.length,
      sitemapUrlCount: sitemapUrls.length,
      discoveredPageCount: fetched.size,
      checkedResourceCount: resourceChecks.length,
      headerVariantCount: headerVariants.length,
      footerVariantCount: footerVariants.length,
      issueCount: issues.length,
      highCount: issues.filter((issue) => issue.severity === 'high').length,
      mediumCount: issues.filter((issue) => issue.severity === 'medium').length,
      lowCount: issues.filter((issue) => issue.severity === 'low').length
    },
    headerVariants,
    footerVariants,
    sitemapFetchFailures,
    indexedPagesMissingFromSitemap,
    issues,
    pages: pageRecords.map(({ hrefs, ...page }) => page)
  });
};
