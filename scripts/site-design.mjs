import fs from 'node:fs';

export const siteHeader = fs.readFileSync(new URL('../templates/site/header.html', import.meta.url), 'utf8').trim();
export const siteFooter = fs.readFileSync(new URL('../templates/site/footer.html', import.meta.url), 'utf8').trim();

function heading(tag, role) {
  let next = tag.replace(/\sstyle="([^"]*)"/i, (_, value) => {
    const kept = value.split(';').filter(rule => !/^\s*(font-size|font-family|line-height|letter-spacing)\s*:/i.test(rule)).filter(rule => rule.trim());
    return kept.length ? ` style="${kept.join(';')}"` : '';
  });
  if (/\bclass="/.test(next)) return next.replace(/class="([^"]*)"/, (_, value) => `class="${[...new Set([...value.split(/\s+/).filter(Boolean), role])].join(' ')}"`);
  return next.replace(/>$/, ` class="${role}">`);
}

// Shared static chrome and semantic typography roles. Never change dates, URLs,
// analytics, article bodies or media/publication state when synchronizing design.
export function applySiteDesign(html, { addShell = false } = {}) {
  let next = html;
  if (/<header\b/.test(next)) next = next.replace(/<header\b[^>]*>[\s\S]*?<\/header>/, siteHeader);
  else if (addShell) next = next.replace(/<main\b/, `${siteHeader}\n<main`);
  if (/<footer\b/.test(next)) next = next.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/, siteFooter);
  else if (addShell) next = next.replace(/<\/main>/, `</main>\n${siteFooter}`);
  next = next.replace(/class="button"/g, 'class="btn btn-primary"');
  next = next.replace(/<h1\b[^>]*>/g, tag => heading(tag, 'page-title'));
  next = next.replace(/<h2\b[^>]*>/g, tag => heading(tag, 'section-title'));
  next = next.replace(/<article\b[^>]*class="[^"]*\bcard\b[^"]*"[^>]*>[\s\S]*?<\/article>/g, card => card.replace(/<h[23]\b[^>]*>/g, tag => heading(tag, 'card-title')));
  next = next.replace(/<main([^>]*\bid="main-content"[^>]*)>/, (tag, attrs) => /tabindex=/.test(attrs) ? tag : `<main${attrs} tabindex="-1">`);
  return next;
}
