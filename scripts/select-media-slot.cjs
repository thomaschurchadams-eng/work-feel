// Read-only selection: the publisher owns all writes and the trusted workflow executes.
const fs = require('node:fs');
const { selectSlot } = require('../lib/media-slots.cjs');
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { console.error('Usage: node scripts/select-media-slot.cjs YYYY-MM-DD [qualified-article-candidates.json]'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync('automation/media-manifest.json', 'utf8'));
const queue = JSON.parse(fs.readFileSync('automation/social-queue.json', 'utf8'));
const input = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : [];
// Legacy article arrays still work for a single candidate. A mixed qualified
// pool needs the publisher's reasoned order, including eligible manifest media.
const articles = Array.isArray(input) ? input : input?.articles;
if (!Array.isArray(articles)) { console.error('Candidates must be an article array or { articles, editorialOrder }.'); process.exit(1); }
const editorialOrder = Array.isArray(input) ? undefined : input.editorialOrder;
const { preparedHouseItems } = require('../lib/house-campaign.cjs');
// A prepared selection is not a reservation or proof of current provider capacity.
console.log(JSON.stringify(selectSlot({ date, queue: queue.items, media: manifest.assets, articles, editorialOrder, campaigns: preparedHouseItems() }), null, 2));
