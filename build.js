const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const publicDir = path.join(projectRoot, 'public');

const sources = [
  'index.html',
  'about.html',
  'episodes.html',
  'insights.html',
  'insight-prioritizing-ai-automation.html',
  'newsletter.html',
  'newsletter-log.html',
  'news.html',
  'ai-guide',
  'alerts',
  'news',
  'assets'
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const cleanPublic = () => {
  ensureDir(publicDir);
  const entries = fs.readdirSync(publicDir);
  for (const entry of entries) {
    if (entry === 'sitemap.xml') continue; // preserve the sitemap
    const target = path.join(publicDir, entry);
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const copyItem = (item) => {
  const from = path.join(projectRoot, item);
  const to = path.join(publicDir, item);

  if (!fs.existsSync(from)) {
    console.warn(`Skipping missing path: ${from}`);
    return;
  }

  fs.cpSync(from, to, { recursive: true });
};

const run = () => {
  cleanPublic();
  sources.forEach(copyItem);
  console.log('Static assets copied to public/ for deployment.');
};

run();
