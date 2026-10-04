const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/remediate-site-qc.mjs');
const origin = 'https://creditunionainews.com';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-remediation-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, file, content) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
}
function run(dir) {
  execFileSync(process.execPath, [script], { cwd: dir });
}
function snapshot(dir) {
  const files = {};
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else files[path.relative(dir, file)] = fs.readFileSync(file, 'utf8');
    }
  }
  walk(dir);
  return files;
}

test('remediation preserves editorial descriptions and existing sitemap dates byte for byte', t => {
  const dir = fixture(t);
  const names = ['episodes.html', 'news/dort-financial-movemint-personalization-cloud.html', 'privacy.html'];
  const descriptions = [
    '<meta name="description" content="Watch published video briefings and listen to podcasts.">',
    '<meta name="description" content="Dort Financial moved its offer engine to Movemint\'s cloud platform &amp; kept suppression controls.">',
    '<meta name=\'description\' content=\'A "private" policy\'>'
  ];
  names.forEach((name, i) => write(dir, name, `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Existing title</title>${descriptions[i]}<link rel="canonical" href="${origin}/${name}"><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-09-01","dateModified":"2026-09-02"}</script></head><body data-section="news"><main><h1>Existing headline</h1><time datetime="2026-09-01">September 1</time></main></body></html>`));
  // Privacy is excluded from the public sitemap by the existing utility policy.
  const xml = `<?xml version="1.0"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/${names[1]}</loc><lastmod>2026-09-02</lastmod><priority>0.8</priority><changefreq>weekly</changefreq></url>\n  <url><loc>${origin}/${names[0]}</loc><lastmod>2026-09-01</lastmod></url>\n</urlset>\n`;
  const txt = `${origin}/${names[1]}\n${origin}/${names[0]}\n`;
  write(dir, 'sitemap.xml', xml); write(dir, 'sitemap.txt', txt);
  const before = snapshot(dir);
  run(dir);
  names.forEach((name, i) => {
    const html = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.ok(html.includes(descriptions[i]), name);
    for (const pattern of [/<title>[\s\S]*?<\/title>/g, /<link[^>]*rel="canonical"[^>]*>/g, /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, /<time[^>]*>[\s\S]*?<\/time>/g]) {
      assert.deepEqual(html.match(pattern), before[name].match(pattern), name);
    }
  });
  assert.equal(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8'), xml);
  assert.equal(fs.readFileSync(path.join(dir, 'sitemap.txt'), 'utf8'), txt);
  const once = snapshot(dir); run(dir); assert.deepEqual(snapshot(dir), once);
});

test('remediation retains missing-metadata and sitemap-exclusion controls without inventing publication dates', t => {
  const dir = fixture(t);
  write(dir, 'episodes.html', '<html><head><meta charset="UTF-8"><title>Episodes</title></head><body><main><h1>Published episodes</h1></main></body></html>');
  const privateDraft = '<html><head><title>Unpublished</title></head><body><h1>Unpublished</h1></body></html>';
  write(dir, 'drafts/unpublished.html', privateDraft);
  write(dir, 'tests/private-fixture.html', privateDraft);
  run(dir);
  const html = fs.readFileSync(path.join(dir, 'episodes.html'), 'utf8');
  assert.match(html, /<meta name="description" content="Listen to concise/);
  assert.match(html, /<link rel="canonical" href="https:\/\/creditunionainews.com\/episodes.html">/);
  const xml = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
  assert.match(xml, /<loc>https:\/\/creditunionainews.com\/episodes.html<\/loc>/);
  assert.doesNotMatch(xml, /lastmod|unpublished|private-fixture/);
  assert.equal(fs.readFileSync(path.join(dir, 'drafts/unpublished.html'), 'utf8'), privateDraft);
  const redirects = JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'), 'utf8')).redirects;
  assert.ok(redirects.some(r => r.source === '/tests/:path*' && r.destination === '/'));
  const once = snapshot(dir); run(dir); assert.deepEqual(snapshot(dir), once);
});
