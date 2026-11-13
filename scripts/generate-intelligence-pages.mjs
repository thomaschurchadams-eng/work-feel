#!/usr/bin/env node
import fs from 'node:fs';

// Static output: no runtime data fetch and no writes outside the two trackers.
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = date => `<time datetime="${escape(date)}">${new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</time>`;
const label = value => escape(value.replaceAll('-', ' '));
function dates(record) {
  // One reader-facing freshness date; announcement/modified/added dates and
  // publication uncertainty remain in the authoritative record and summary.
  return `<p class="intelligence-dates">Reviewed ${time(record.lastReviewed)}</p>`;
}
function links(signal) {
  return `<div class="actions">${signal.relatedCoverage ? `<a class="link" href="/${escape(signal.relatedCoverage)}">Related coverage →</a> ` : ''}<a class="link" href="${escape(signal.sourceUrl)}" target="_blank" rel="noopener noreferrer">Primary source ↗</a></div>`;
}
function card(record, signal, vendor) {
  const heading = vendor ? record.name : signal.title;
  const category = vendor ? record.category : record.authority;
  return `<article class="card intelligence-record" data-record-id="${escape(record.id)}">
<span class="label-tag">${label(vendor ? signal.evidenceLevel : signal.type+' · '+signal.status)}</span>
<h2 class="section-title card-title">${escape(heading)}</h2>
<p><strong>${escape(category)}</strong></p>
${vendor ? `<p>${escape(record.capabilities.join(' · '))}</p>` : `<p>${escape(record.jurisdiction)}</p>`}
<p>${escape(signal.publicSummary ?? signal.summary)}</p>
${dates(record)}
${links(signal)}
</article>`;
}
function replaceBlock(html, name, body) {
  const start = `<!-- intelligence:${name}:start -->`, end = `<!-- intelligence:${name}:end -->`;
  if (html.split(start).length !== 2 || html.split(end).length !== 2) throw new Error(`Missing or repeated ${name} block`);
  return html.slice(0, html.indexOf(start)) + start+'\n'+body+'\n'+end + html.slice(html.indexOf(end)+end.length);
}
let changed = 0;
for (const vendor of [true, false]) {
  const records = vendor ? read('automation/vendor-registry.json').vendors.filter(r => !r.promotionStatus?.startsWith('withheld')) : read('automation/regulatory-watch.json').records;
  // Preserve signal ordering in the vendor ledger; regulatory reviews append.
  const ordered = [...records].sort((a,b) => b.lastReviewed.localeCompare(a.lastReviewed));
  const kind = vendor ? 'vendor' : 'reg', file = `intelligence/${vendor ? 'vendors' : 'regulatory-watch'}.html`;
  const original = fs.readFileSync(file, 'utf8');
  let result = original;
  // Keep process narration and retired controls out of the reader's path.
  // Provenance stays in the registries; each card retains its own dates, evidence
  // label, source and substantive qualifications.
  for (const block of ['count', 'review-note', 'evidence-notes', 'controls', 'empty', 'filter-script']) result = replaceBlock(result, block, '');
  result = replaceBlock(result, 'records', `<div class="card-grid" id="${kind}-grid">\n`+ordered.map(r => card(r, vendor ? r.signals[0] : r.developments.at(-1), vendor)).join('\n')+'\n</div>');
  if (result !== original) {
    changed++;
    if (process.argv.includes('--check')) console.error(`Registry/page drift: ${file}`);
    else fs.writeFileSync(file, result);
  }
}
if (process.argv.includes('--check') && changed) process.exitCode = 1;
console.log(`Intelligence pages: ${changed} ${process.argv.includes('--check') ? 'stale' : 'updated'}.`);
