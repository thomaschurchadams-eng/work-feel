const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SITE_ORIGIN = 'https://creditunionainews.com';
const EXCLUDED_DIRS = new Set(['.git', '.vercel', 'node_modules', 'api', 'assets', 'automation', 'scripts', 'templates']);

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel.replaceAll('\\', '/'));
  }
  return out;
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

function canonicalPathForFile(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

function normalizeInternalTarget(sourceFile, raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(trimmed)) {
    if (trimmed.startsWith(SITE_ORIGIN)) return normalizeInternalTarget(sourceFile, trimmed.slice(SITE_ORIGIN.length) || '/');
    return null;
  }
  const [withoutHash, hash = ''] = trimmed.split('#', 2);
  const [pathname] = withoutHash.split('?', 1);
  if (!pathname && hash) return { file: sourceFile, hash, raw };
  let rel;
  if (pathname.startsWith('/')) rel = pathname.slice(1);
  else rel = path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), pathname));
  if (!rel || rel === '.') rel = 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  if (!path.posix.extname(rel)) {
    if (fs.existsSync(path.join(ROOT, `${rel}.html`))) rel = `${rel}.html`;
    else if (fs.existsSync(path.join(ROOT, rel, 'index.html'))) rel = `${rel}/index.html`;
  }
  return { file: rel, hash, raw };
}

function linkSignature(block) {
  if (!block) return [];
  const anchors = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
  return anchors.map((anchor) => ({
    label: stripTags(anchor),
    href: attr(anchor, 'href') || ''
  }));
}

function signatureKey(links) {
  return links.map((item) => `${item.label}|${item.href}`).join(' > ');
}

function count(regex, html) {
  return (html.match(regex) || []).length;
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

  const files = walk(ROOT);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const publicFiles = new Set(files);
  const pageMap = new Map();
  const headerGroups = new Map();
  const footerGroups = new Map();
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const issues = [];

  let sitemapUrls = [];
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, 'utf8');
    sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  }
  const sitemapPaths = new Set(sitemapUrls.map((url) => url.startsWith(SITE_ORIGIN) ? new URL(url).pathname : url));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const title = firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const description = metaContent(html, 'name', 'description');
    const canonicalTag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [])[0] || null;
    const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;
    const robots = metaContent(html, 'name', 'robots');
    const headerBlock = (html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i) || [])[0] || null;
    const footerBlock = (html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i) || [])[0] || null;
    const navBlock = headerBlock ? ((headerBlock.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i) || [])[0] || headerBlock) : null;
    const footerNavBlock = footerBlock ? ((footerBlock.match(/<div\b[^>]*class=["'][^"']*footer-links[^"']*["'][^>]*>[\s\S]*?<\/div>/i) || [])[0] || footerBlock) : null;
    const headerLinks = linkSignature(navBlock);
    const footerLinks = linkSignature(footerNavBlock);
    const headerKey = signatureKey(headerLinks);
    const footerKey = signatureKey(footerLinks);
    const h1Count = count(/<h1\b/gi, html);
    const imageTags = html.match(/<img\b[^>]*>/gi) || [];
    const missingAlt = imageTags.filter((tag) => attr(tag, 'alt') === null).map((tag) => attr(tag, 'src'));
    const emptyAlt = imageTags.filter((tag) => attr(tag, 'alt') === '').map((tag) => attr(tag, 'src'));
    const anchors = html.match(/<a\b[^>]*>/gi) || [];
    const links = anchors.map((tag) => attr(tag, 'href')).filter(Boolean);
    const resources = [...(html.match(/<(?:img|script|link)\b[^>]*>/gi) || [])]
      .map((tag) => attr(tag, tag.toLowerCase().startsWith('<link') ? 'href' : 'src'))
      .filter(Boolean);

    const pathName = canonicalPathForFile(file);
    const expectedCanonical = `${SITE_ORIGIN}${pathName}`;
    const inSitemap = sitemapPaths.has(pathName);
    const isUtility = ['corrections.html', 'intelligence/changes.html', 'privacy.html'].includes(file);

    const record = {
      file,
      path: pathName,
      title,
      description,
      canonical,
      robots,
      inSitemap,
      headerKey,
      headerLinks,
      footerKey,
      footerLinks,
      h1Count,
      missingAlt,
      emptyAlt,
      hasGa4: html.includes('G-RF6EFK06G5'),
      hasViewport: /<meta\b[^>]*name=["']viewport["']/i.test(html),
      bodyDataDimensions: ['data-section', 'data-editorial-function', 'data-technology', 'data-content-format', 'data-audience', 'data-maturity']
        .filter((name) => new RegExp(`\\b${name}=["']`, 'i').test(html)),
      isUtility,
      links,
      resources
    };
    pageMap.set(file, record);
    if (!headerGroups.has(headerKey)) headerGroups.set(headerKey, []);
    headerGroups.get(headerKey).push(file);
    if (!footerGroups.has(footerKey)) footerGroups.set(footerKey, []);
    footerGroups.get(footerKey).push(file);
    if (title) {
      if (!titleOwners.has(title)) titleOwners.set(title, []);
      titleOwners.get(title).push(file);
    }
    if (description) {
      if (!descriptionOwners.has(description)) descriptionOwners.set(description, []);
      descriptionOwners.get(description).push(file);
    }

    if (!title) issues.push({ severity: 'high', type: 'missing_title', file });
    if (!description) issues.push({ severity: 'medium', type: 'missing_meta_description', file });
    if (!canonical) issues.push({ severity: 'medium', type: 'missing_canonical', file });
    else if (canonical !== expectedCanonical) issues.push({ severity: 'medium', type: 'canonical_mismatch', file, expected: expectedCanonical, actual: canonical });
    if (!record.hasViewport) issues.push({ severity: 'high', type: 'missing_viewport', file });
    if (!headerBlock) issues.push({ severity: 'high', type: 'missing_header', file });
    if (!footerBlock) issues.push({ severity: 'medium', type: 'missing_footer', file });
    if (h1Count !== 1) issues.push({ severity: h1Count === 0 ? 'high' : 'medium', type: 'h1_count', file, count: h1Count });
    if (missingAlt.length) issues.push({ severity: 'medium', type: 'images_missing_alt', file, images: missingAlt });
    if (inSitemap && /noindex/i.test(robots || '')) issues.push({ severity: 'high', type: 'sitemap_noindex_conflict', file });
    if (isUtility && inSitemap) issues.push({ severity: 'medium', type: 'utility_page_in_sitemap', file });
    if (headerLinks.some((link) => link.label.toLowerCase() === 'corrections')) issues.push({ severity: 'medium', type: 'corrections_in_primary_nav', file });
  }

  for (const [title, owners] of titleOwners) {
    if (owners.length > 1) issues.push({ severity: 'medium', type: 'duplicate_title', title, files: owners });
  }
  for (const [description, owners] of descriptionOwners) {
    if (owners.length > 1) issues.push({ severity: 'low', type: 'duplicate_meta_description', description, files: owners });
  }

  for (const [file, page] of pageMap) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const raw of [...page.links, ...page.resources]) {
      const target = normalizeInternalTarget(file, raw);
      if (!target) continue;
      if (!publicFiles.has(target.file)) {
        issues.push({ severity: 'high', type: 'broken_internal_reference', file, reference: raw, resolved: target.file });
        continue;
      }
      if (target.hash && target.file.endsWith('.html')) {
        const targetHtml = pageMap.has(target.file) ? fs.readFileSync(path.join(ROOT, target.file), 'utf8') : '';
        const escaped = target.hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (targetHtml && !new RegExp(`\\bid=["']${escaped}["']`, 'i').test(targetHtml)) {
          issues.push({ severity: 'medium', type: 'missing_anchor_target', file, reference: raw, resolved: target.file, anchor: target.hash });
        }
      }
    }
  }

  const headerVariants = [...headerGroups.entries()]
    .map(([signature, groupedFiles]) => ({ signature, count: groupedFiles.length, files: groupedFiles }))
    .sort((a, b) => b.count - a.count);
  const footerVariants = [...footerGroups.entries()]
    .map(([signature, groupedFiles]) => ({ signature, count: groupedFiles.length, files: groupedFiles }))
    .sort((a, b) => b.count - a.count);

  const sitemapMissingFiles = sitemapUrls
    .map((url) => ({ url, pathname: new URL(url).pathname }))
    .filter(({ pathname }) => {
      const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '').replace(/\/$/, '/index.html');
      return !publicFiles.has(rel);
    });

  const indexedHtmlMissingFromSitemap = [...pageMap.values()]
    .filter((page) => !page.inSitemap && !/noindex/i.test(page.robots || '') && !['privacy.html'].includes(page.file))
    .map((page) => page.file);

  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.type.localeCompare(b.type));

  return res.status(200).json({
    ok: true,
    commitSha: deploymentCommit,
    generatedAt: new Date().toISOString(),
    summary: {
      htmlPageCount: htmlFiles.length,
      sitemapUrlCount: sitemapUrls.length,
      headerVariantCount: headerVariants.length,
      footerVariantCount: footerVariants.length,
      issueCount: issues.length,
      highCount: issues.filter((i) => i.severity === 'high').length,
      mediumCount: issues.filter((i) => i.severity === 'medium').length,
      lowCount: issues.filter((i) => i.severity === 'low').length
    },
    headerVariants,
    footerVariants,
    sitemapMissingFiles,
    indexedHtmlMissingFromSitemap,
    issues,
    pages: [...pageMap.values()].map(({ links, resources, ...rest }) => rest)
  });
};
