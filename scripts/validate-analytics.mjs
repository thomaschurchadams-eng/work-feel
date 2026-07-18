#!/usr/bin/env node
import fs from 'node:fs';

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
if (missing.length || invalid.length) {
  if (missing.length) console.error(`Missing analytics attributes: ${missing.join(', ')}`);
  if (invalid.length) console.error(`Invalid analytics values: ${invalid.join(', ')}`);
  process.exit(1);
}
console.log(`Analytics metadata valid: ${file}`);
