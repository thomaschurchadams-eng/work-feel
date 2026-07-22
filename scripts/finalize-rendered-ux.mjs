import fs from 'node:fs';

const appPath = 'assets/app.js';
let app = fs.readFileSync(appPath, 'utf8');
const tickerBlock = `  const header = document.querySelector('header');
  const buildTicker = () => {
    const current = normalizePath(window.location.pathname);
    const item = tickerAlerts[0];
    if (!header || !item || !['/', '/alerts'].includes(current)) return;
    const tickerBar = document.createElement('aside');
    tickerBar.className = 'ticker-bar';
    tickerBar.setAttribute('aria-label', 'Latest CreditUnionAI News alert');
    tickerBar.innerHTML = \`
      <div class="container ticker-track ticker-track-single">
        <a class="ticker-label" href="/alerts/">Latest Alert</a>
        <a class="ticker-item ticker-item-single" href="/alerts/#\${item.slug}"><span class="ticker-pill">\${item.label}</span><span class="ticker-text">\${item.headline}</span></a>
      </div>
    \`;
    header.insertAdjacentElement('afterend', tickerBar);
  };

  buildTicker();`;

const updated = app.replace(/  const header = document\.querySelector\('header'\);[\s\S]*?  buildTicker\(\);/, tickerBlock);
if (updated === app) throw new Error('Ticker block was not replaced.');
fs.writeFileSync(appPath, updated);

const cssPath = 'assets/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* FINAL_RENDERED_UX */';
css = css.replace(/\n\/\* FINAL_RENDERED_UX \*\/[\s\S]*$/m, '');
css += `\n${marker}\n.ticker-track-single { display:flex; align-items:center; gap:14px; }\n.ticker-item-single { flex:1; min-width:0; }\n@media (max-width:700px) {\n  .home-news-grid > article:nth-of-type(n+5) { display:none; }\n}\n`;
fs.writeFileSync(cssPath, css);

console.log(JSON.stringify({ tickerSimplified: true, mobileStoriesVisible: 4 }, null, 2));
