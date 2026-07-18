#!/usr/bin/env node
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/validate-seo-package.mjs <article.html>');
  process.exit(2);
}
const policy = JSON.parse(fs.readFileSync('automation/seo-policy.json', 'utf8'));
let failed = false;

const readMeta = (html, key, property = false) => {
  const attr = property ? 'property' : 'name';
  return html.match(new RegExp(`<meta\\s+[^>]*${attr}=["']${key.replace(':', '\\:')}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'))?.[1]
    || html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${key.replace(':', '\\:')}["'][^>]*>`, 'i'))?.[1]
    || '';
};

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const errors = [];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const description = readMeta(html, 'description');
  const canonical = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || '';
  const path = canonical.replace('https://creditunionainews.com', '');
  const route = path.startsWith('/news/') ? policy.routes.news : path.startsWith('/insight-') ? policy.routes.insights : null;
  if (!route || !new RegExp(route.pathPattern).test(path)) errors.push('canonical route');
  if (title.length < policy.requirements.titleCharacters.min || title.length > policy.requirements.titleCharacters.max) errors.push('title length');
  if (description.length < 50 || description.length > 160) errors.push('description length');

  for (const key of policy.requiredMeta) {
    const value = key === 'canonical'
      ? canonical
      : readMeta(html, key, key.startsWith('og:') || key.startsWith('article:'));
    if (!value) errors.push(`meta ${key}`);
  }
  const ogUrl = readMeta(html, 'og:url', true);
  if (canonical && ogUrl !== canonical) errors.push('og:url must equal canonical');
  const ogImage = readMeta(html, 'og:image', true);
  if (ogImage && !/^https:\/\/creditunionainews\.com\//.test(ogImage)) errors.push('absolute first-party og:image');

  const blocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  let structured = null;
  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]);
      const values = Array.isArray(value?.['@graph']) ? value['@graph'] : [value];
      structured = values.find((item) => item?.['@type'] === route?.schemaType) || structured;
    } catch {
      errors.push('invalid JSON-LD');
    }
  }
  if (!structured) {
    errors.push(`${route?.schemaType || 'article'} JSON-LD`);
  } else {
    for (const key of policy.requiredStructuredData) if (!structured[key]) errors.push(`JSON-LD ${key}`);
    if (structured.headline?.length > policy.requirements.headlineCharacters.max) errors.push('headline length');
    if (structured.mainEntityOfPage?.['@id'] !== canonical) errors.push('mainEntityOfPage canonical');
    if (structured.publisher?.name !== policy.site.name) errors.push('publisher name');
    for (const key of ['datePublished', 'dateModified']) {
      if (structured[key] && Number.isNaN(Date.parse(structured[key]))) errors.push(`invalid ${key}`);
    }
  }

  const related = html.match(/class=["'][^"']*related-coverage[^"']*["'][\s\S]*?<\/div>/i)?.[0] || '';
  const internalLinks = [...related.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('http') || href.startsWith('https://creditunionainews.com/'))
    .filter((href) => !/^(?:\/)?(?:news|insights)\.html$/.test(href));
  if (internalLinks.length < policy.requirements.relatedInternalLinks) errors.push('two related internal article links');

  const articleBody = html.match(/class=["'][^"']*article-body[^"']*["'][\s\S]*?<\/div>/i)?.[0] || html;
  const externalSources = [...articleBody.matchAll(/href=["'](https:\/\/[^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('https://creditunionainews.com/'));
  if (externalSources.length < policy.requirements.externalSourceLinks) errors.push('external source link');

  if (errors.length) {
    failed = true;
    console.error(`${file}: FAIL ${[...new Set(errors)].join(', ')}`);
  } else {
    console.log(`${file}: PASS`);
  }
}
process.exit(failed ? 1 : 0);
