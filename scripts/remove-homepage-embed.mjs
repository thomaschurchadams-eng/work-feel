import fs from 'node:fs';
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const replacement = '<div class="button-row"><a class="btn btn-primary" href="/episodes.html">Listen to the episode</a></div>';
const updated = html.replace(/<div class="audio-player">[\s\S]*?<\/div>/i, replacement);
if (updated === html) throw new Error('Homepage audio embed was not found.');
fs.writeFileSync(file, updated);
console.log(JSON.stringify({ removedHomepageEmbed: true }, null, 2));
