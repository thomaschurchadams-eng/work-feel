const test = require('node:test');
const assert = require('node:assert/strict');
const { readInventory } = require('../lib/buffer-inventory.cjs');
const d = require('../lib/buffer-diagnostics.cjs');
const policy = require('../automation/media-policy.json');
const now = Date.parse('2026-11-13T17:30:00Z');
const sha = 'e8cf8da2934ff3b689ef53ff409c818fd90dbc97';
const channel = { id: policy.distribution.channelId, displayName: 'CreditUnionAI News', service: 'linkedin', isQueuePaused: false };
const env = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: sha };
const trace = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const page = records => ({ posts: { edges: records.map(node => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } } });
async function inventory(count = 78) {
  const records = Array.from({ length: count }, (_, i) => ({ id: 'synthetic-' + i, channelId: channel.id, status: 'sent', dueAt: null, sentAt: '2026-11-12T15:00:00Z', text: i < 13 ? 'https://creditunionainews.com/news/synthetic.html' : '', metadata: undefined }));
  let offset = 0;
  return readInventory(async () => {
    const part = records.slice(offset, offset + 100); offset += part.length;
    const p = page(part); if (offset < records.length) p.posts.pageInfo = { hasNextPage: true, endCursor: 'cursor-' + offset };
    return p;
  }, { channel, organizationId: 'fixture-org', commitSha: sha }, () => now, { diagnostics: true });
}
function decode(lines) { return lines.map(line => JSON.parse(line.slice(d.PREFIX.length))); }
function encode(events) { return events.map(e => d.PREFIX + JSON.stringify(e)); }

test('78 synthetic records produce bounded complete accounting; public output keeps the original holds', async () => {
  const inv = await inventory(), lines = d.buildPrivateLog(inv, trace), publicInv = d.stripDiagnostics(inv);
  const verified = d.verifyPrivateLog(lines, publicInv);
  assert.equal(verified.evidenceComplete, true); assert.equal(verified.inventoryComplete, true);
  assert.equal(verified.records.length, 78); assert.equal(verified.requiresReview, true);
  assert.ok(lines.length <= d.MAX_CHUNKS + 2); assert.ok(lines.every(line => Buffer.byteLength(line) <= d.MAX_LINE_BYTES));
  assert.ok(lines.reduce((n,v) => n + Buffer.byteLength(v) + 1, 0) <= d.MAX_TOTAL_BYTES);
  assert.doesNotMatch(JSON.stringify(publicInv), /diagnostic|metadata_missing|firstComment/);
  assert.equal(publicInv.recordCount, 78); assert.equal(publicInv.records.filter(r => r.canonicalUrls.length).length, 13);
  assert.equal(publicInv.records.filter(r => r.requiresReview).length, 78);
  assert.doesNotMatch(lines.join('\n'), /https?:|canonicalUrls|sentAt|dueAt|text/);
});
test('empty and incomplete inventories have distinct evidence completeness and inventory completeness', async () => {
  const empty = await inventory(0);
  assert.equal(d.verifyPrivateLog(d.buildPrivateLog(empty, trace), empty).evidenceComplete, true);
  assert.equal(d.buildPrivateLog(empty, trace).length, 2);
  const incomplete = await readInventory(async () => ({}), { channel, organizationId: 'fixture-org', commitSha: sha }, () => now, { diagnostics: true });
  const checked = d.verifyPrivateLog(d.buildPrivateLog(incomplete, trace), incomplete);
  assert.equal(checked.evidenceComplete, true); assert.equal(checked.inventoryComplete, false); assert.equal(checked.requiresReview, true);
});
test('missing begin, middle or end; duplicate chunks; truncated and malformed lines all reject', async () => {
  const inv = await inventory(), lines = d.buildPrivateLog(inv, trace);
  const variants = [[], lines.slice(1), lines.slice(0,-1), lines.filter((_,i) => i !== 2), [...lines, lines[1]], [lines[0], lines[1].slice(0,-8), ...lines.slice(2)], ['bad', ...lines.slice(1)], [lines[0], d.PREFIX + '{', ...lines.slice(2)]];
  for (const variant of variants) assert.equal(d.verifyPrivateLog(variant, inv).evidenceComplete, false);
});
test('reordered log transport can be reconstructed by sequence, but wrong record order/count cannot', async () => {
  const inv = await inventory(), lines = d.buildPrivateLog(inv, trace);
  assert.equal(d.verifyPrivateLog([...lines].reverse(), inv).evidenceComplete, true);
  for (const mutate of [e => e[1].start++, e => e[1].index++, e => e[1].records.pop(), e => e[1].records[0].id = 'other-id', e => e.at(-1).chunks++]) {
    const events = decode(lines); mutate(events); assert.equal(d.verifyPrivateLog(encode(events), inv).evidenceComplete, false);
  }
});
test('wrong commit/channel/time, digest, interleaved trace and unexpected fields reject', async () => {
  const inv = await inventory(), lines = d.buildPrivateLog(inv, trace);
  for (const mutate of [e => e[1].commitSha = 'a'.repeat(40), e => e[1].channelId = 'wrong', e => e[1].observedAt = '2026-11-13T17:30:01.000Z', e => e[1].trace = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', e => e.at(-1).contentSha256 = '0'.repeat(64), e => e[0].unrequested = 'PRIVATE', e => e[1].records[0].reasons[0].source = 'wrong']) {
    const events = decode(lines); mutate(events); assert.equal(d.verifyPrivateLog(encode(events), inv).evidenceComplete, false);
  }
  assert.equal(d.verifyPrivateLog([...lines, ...d.buildPrivateLog(inv, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')], inv).evidenceComplete, false);
});
test('writer projection rejects unknown reason/type/identifier inputs without dumping their values', async () => {
  for (const mutate of [i => i.records[0].diagnostic.reasons[0].code = 'PRIVATE_SECRET', i => i.records[0].diagnostic.sources.body.type = 'PRIVATE_SECRET', i => i.records[0].id = 'https://private.invalid/SECRET', i => i.records[0].id = 'line\nbreak', i => i.records[0].diagnostic.reasons = [], i => i.records.push(i.records[0])]) {
    const inv = await inventory(1); mutate(inv); const lines = [];
    const result = d.emitPrivateLog(inv, { env, write: line => lines.push(line) });
    assert.equal(result.emitted, false); assert.doesNotMatch(JSON.stringify({ result, lines }), /PRIVATE|SECRET|private\.invalid|line\\nbreak/);
    if (lines.length) {
      assert.equal(decode(lines)[0].kind, 'abort');
      const events = decode(lines); events[0].extra = 'PRIVATE_SECRET';
      assert.equal(d.verifyPrivateLog(encode(events), inv).evidenceComplete, false);
    }
  }
});
test('1000-record diagnostic bound failure emits only a fixed abort marker, never partial data', async () => {
  const inv = await inventory(1000), lines = [];
  const result = d.emitPrivateLog(inv, { env, write: line => lines.push(line) });
  assert.equal(result.emitted, false); assert.equal(result.error, 'diagnostic_bound_exceeded');
  assert.equal(lines.length, 1); assert.equal(decode(lines)[0].kind, 'abort');
  assert.doesNotMatch(lines[0], /synthetic-|metadata_missing|firstComment/);
  assert.deepEqual(d.verifyPrivateLog(lines, inv), { evidenceComplete: false, error: 'diagnostic_bound_exceeded' });
});
test('CI/local/preview/incorrect revision never emit; sink failure cannot escape or create false completion', async () => {
  const inv = await inventory(), lines = [];
  for (const environment of [{}, { ...env, VERCEL: '0' }, { ...env, VERCEL_ENV: 'preview' }, { ...env, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) }]) {
    assert.equal(d.emitPrivateLog(inv, { env: environment, write: line => lines.push(line) }).emitted, false);
  }
  assert.equal(lines.length, 0);
  const result = d.emitPrivateLog(inv, { env, write: line => { if (lines.length === 2) throw Error('PRIVATE ' + line); lines.push(line); } });
  assert.deepEqual(result, { emitted: false, error: 'diagnostic_log_write_failed' });
  assert.equal(d.verifyPrivateLog(lines, inv).evidenceComplete, false);
});
test('redaction removes nested diagnostic keys without mutating operational values or input', () => {
  const original = { data: { complete: false, requiresReview: true, error: 'inventory_timeout', records: [{ id: 'old-public-id', canonicalUrls: [], diagnostic: { reasons: ['PRIVATE'] } }], diagnostic: { reasonCodes: ['PRIVATE'] }, diagnosticLogs: ['PRIVATE'] }, errors: [{ diagnosticEvidence: 'PRIVATE', error: 'fixed' }] };
  const saved = JSON.stringify(original), clean = d.stripDiagnostics(original);
  assert.doesNotMatch(JSON.stringify(clean), /PRIVATE|diagnostic/i);
  assert.equal(clean.data.complete, false); assert.equal(clean.data.requiresReview, true); assert.equal(clean.data.error, 'inventory_timeout');
  assert.equal(clean.data.records[0].id, 'old-public-id'); assert.equal(JSON.stringify(original), saved);
});
