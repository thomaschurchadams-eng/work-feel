const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const home = fs.readFileSync('index.html', 'utf8');
test('homepage leads with current alerts and one existing news feed, not pinned media', () => {
  assert.doesNotMatch(home, /cuai-weekly-feature|weekly-heading|latest-media-heading|weekly-grid/);
  assert.equal((home.match(/Latest News &amp; Insights/g) || []).length, 1);
  assert.equal((home.match(/home-news-grid/g) || []).length, 1);
  assert.match(home, /<\/section>\s*<section class="latest-alert-section"/);
  assert.match(home, /data-linkedin-placement="home_hero"/);
});
test('archived video and chart remain available with their original dates', () => {
  assert.match(fs.readFileSync('episodes/cuai-weekly-2026-09-28.html', 'utf8'), /September/);
  assert.match(fs.readFileSync('media/finance-ai-skills-measurement-chart.html', 'utf8'), /October 20, 2026/);
});
