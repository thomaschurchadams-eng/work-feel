const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { probeBrowser } = require('../lib/browser-readiness.cjs');
const root = path.resolve(__dirname, '..');
probeBrowser({ chromium, root }).then(result => {
  const out = path.join(root, 'design-results');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'browser-preflight.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'launched') process.exitCode = 1;
}).catch(error => { console.error(error.message); process.exitCode = 1; });
