import fs from 'node:fs';
import path from 'node:path';

const directory = path.join(process.cwd(), 'intelligence');
let changed = 0;

for (const name of fs.readdirSync(directory)) {
  if (!name.endsWith('.html') || name === 'index.html') continue;
  const file = path.join(directory, name);
  const original = fs.readFileSync(file, 'utf8');
  const updated = original.replace(/href=["']index\.html["']/g, 'href="/intelligence/"');
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changed += 1;
  }
}

console.log(JSON.stringify({ changedFiles: changed }, null, 2));
