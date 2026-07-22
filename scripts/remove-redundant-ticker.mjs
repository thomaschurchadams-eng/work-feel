import fs from 'node:fs';
const file = 'assets/app.js';
let app = fs.readFileSync(file, 'utf8');
const updated = app.replace(/  const header = document\.querySelector\('header'\);[\s\S]*?  buildTicker\(\);\n/, '');
if (updated === app) throw new Error('Ticker block was not found.');
fs.writeFileSync(file, updated);
console.log(JSON.stringify({ removedRedundantTicker: true }, null, 2));
