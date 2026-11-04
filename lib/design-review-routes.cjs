const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const article = /^\/?(?:news\/[a-z0-9-]+|insight-[a-z0-9-]+)\.html$/;
function selectRoutes({ baseline, changed = [], explicit = [], recent = [] }) {
  for (const route of explicit) if (!article.test(route)) throw new Error('invalid-review-article-path: ' + route);
  return [...new Set([...baseline, ...recent, ...changed.filter(file => article.test(file)), ...explicit].map(file => '/' + file.replace(/^\//, '')))];
}
function reviewRoutes(root, baseline, env = process.env) {
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'automation/coverage-ledger.json'), 'utf8'));
  const recent = ['news', 'insights'].map(section => ledger.articles.find(item => item.section === section)?.url).filter(Boolean);
  const changed = env.CUAI_DESIGN_BASE_REF ? execFileSync('git', ['diff', '--name-only', env.CUAI_DESIGN_BASE_REF, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n') : [];
  const explicit = (env.CUAI_DESIGN_ARTICLE_PATHS || '').split(/[\s,]+/).filter(Boolean);
  const routes = selectRoutes({ baseline, changed, explicit, recent });
  for (const route of routes) {
    const file = path.join(root, route.slice(1));
    if (!fs.existsSync(file)) throw new Error('review-route-missing: ' + route);
  }
  return routes;
}
module.exports = { selectRoutes, reviewRoutes };
