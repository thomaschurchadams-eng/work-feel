#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-analytics.mjs <article.html>');
  process.exit(2);
}
const html = fs.readFileSync(file, 'utf8');
const schema = JSON.parse(fs.readFileSync('automation/analytics-measurement.json', 'utf8'));
const required = Object.keys(schema.bodyDataAttributes);
const body = html.match(/<body\b([^>]*)>/i)?.[1] || '';
const missing = required.filter((name) => !new RegExp(`${name}=["'][^"']+["']`, 'i').test(body));
const invalid = [];
for (const [attribute, allowed] of Object.entries({
  'data-section': schema.editorialDimensions.content_section,
  'data-editorial-function': schema.editorialDimensions.editorial_function,
  'data-technology': schema.editorialDimensions.technology,
  'data-content-format': schema.editorialDimensions.content_format,
  'data-audience': schema.editorialDimensions.audience,
  'data-maturity': schema.editorialDimensions.maturity
})) {
  const value = body.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1];
  if (value && !allowed.includes(value)) invalid.push(`${attribute}=${value}`);
}

const scriptSources = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
const sharedScript = scriptSources.find((src) => /(?:^|\/)(?:app|site)\.js(?:[?#].*)?$/i.test(src));
let missingSharedScript = null;
if (!sharedScript) {
  missingSharedScript = 'missing shared article script reference (assets/app.js or assets/site.js)';
} else {
  const cleanSource = sharedScript.split(/[?#]/, 1)[0];
  const resolved = cleanSource.startsWith('/')
    ? path.resolve(process.cwd(), `.${cleanSource}`)
    : path.resolve(path.dirname(file), cleanSource);
  if (!fs.existsSync(resolved)) {
    missingSharedScript = `shared article script does not exist: ${sharedScript}`;
  }
}

if (missing.length || invalid.length || missingSharedScript) {
  if (missing.length) console.error(`Missing analytics attributes: ${missing.join(', ')}`);
  if (invalid.length) console.error(`Invalid analytics values: ${invalid.join(', ')}`);
  if (missingSharedScript) console.error(missingSharedScript);
  process.exit(1);
}
console.log(`Analytics metadata valid: ${file}`);
