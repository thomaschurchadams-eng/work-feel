import fs from 'node:fs';
import path from 'node:path';
import { applySiteDesign } from './site-design.mjs';

const check = process.argv.includes('--check');
const skip = new Set(['.git', '.github', '.vercel', 'node_modules', 'api', 'automation', 'tests', 'drafts', 'review']);
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith('.html')) files.push(file);
  }
}
walk('.');
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const template = /^templates\/(news-article|insight-article|newsletter-edition)\.html$/.test(file);
  if (!template && !/<header class="site-header"/.test(before)) continue;
  const after = applySiteDesign(before, { addShell: template });
  if (after !== before) {
    changed++;
    if (check) console.error(`Design shell/roles out of sync: ${file}`);
    else fs.writeFileSync(file, after);
  }
}
console.log(`Site design ${check ? 'checked' : 'synchronized'}; ${changed} ${check ? 'stale' : 'updated'} files.`);
if (check && changed) process.exitCode = 1;
