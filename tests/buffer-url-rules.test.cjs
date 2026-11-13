const test = require('node:test');
const assert = require('node:assert/strict');
const { readInventory } = require('../lib/buffer-inventory.cjs');
const { buildPrivateLog, verifyPrivateLog, stripDiagnostics, emitPrivateLog, PREFIX } = require('../lib/buffer-diagnostics.cjs');
const { distribution } = require('../automation/media-policy.json');
const at = Date.parse('2026-11-13T20:00:00Z'), sha = '1347b1e9db3efa6e36577f8a0361d6cc41382e65';
const known = 'https://creditunionainews.com/news/fixture.html';
const identity = { organizationId: 'fixture', commitSha: sha, channel: { id: distribution.channelId, service: 'linkedin', displayName: distribution.channelName, isQueuePaused: false } };
const meta = fields => ({ __typename: 'LinkedInPostMetadata', firstComment: null, linkAttachment: null, ...fields });
const post = fields => ({ id: 'fixture', status: 'sent', channelId: distribution.channelId, text: known, dueAt: null, sentAt: '2026-11-12T15:00:00Z', metadata: null, ...fields });
async function read(posts, diagnostic = true) {
  let calls = 0;
  const result = await readInventory(async (query, vars) => {
    assert.match(query, /^query /); assert.doesNotMatch(query, /mutation/);
    const index = calls++ * 100, items = posts.slice(index, index + 100), more = index + 100 < posts.length;
    assert.equal(vars.after, index ? 'cursor-' + index : null);
    return { posts: { edges: items.map(node => ({ node })), pageInfo: { hasNextPage: more, endCursor: more ? 'cursor-' + (index + 100) : null } } };
  }, identity, () => at, { diagnostics: diagnostic });
  return { result, calls };
}
const invalid = [
  [undefined, 'not_string'], [null, 'not_string'], [42, 'not_string'], [{}, 'not_string'],
  ['', 'empty_string'], [' \t\n', 'whitespace_only'], ['x'.repeat(10001), 'value_too_long'],
  ['www.creditunionainews.com/news/fixture.html', 'www_without_scheme'],
  ['relative/fixture.html', 'missing_http_scheme'], ['https:/missing-slash', 'malformed_absolute_url'],
  ['ftp://foreign.invalid/PRIVATE', 'unsupported_protocol'], ['javascript:PRIVATE', 'unsupported_protocol'],
  [known + ' ', 'whitespace_present'], [' ' + known, 'whitespace_present'], ['https://creditunionainews.com/\nnews/fixture.html', 'whitespace_present'],
  ['https://creditunionainews.com\\news/fixture.html', 'backslash_present'],
  ['https://[malformed', 'malformed_absolute_url'], ['https://', 'malformed_absolute_url'],
  ['https://user:SECRET@creditunionainews.com/news/fixture.html', 'url_credentials'],
  ['https://creditunionainews.com:8443/news/fixture.html', 'non_default_port']
];
const unresolved = [
  ['http://creditunionainews.com/news/fixture.html', 'non_https_url'],
  ['https://buff.ly/PRIVATE', 'known_shortener'], ['https://bit.ly/PRIVATE', 'known_shortener'],
  ['https://foreign.invalid/PRIVATE', 'foreign_host'], ['https://www.creditunionainews.com/news/fixture.html', 'foreign_host'],
  [known + ']', 'path_terminal_delimiter'], [known + '}', 'path_terminal_delimiter'], [known + '\u201d', 'path_terminal_delimiter'],
  ['https://creditunionainews.com/news/Fixture.html', 'canonical_path_mismatch'],
  ['https://creditunionainews.com/news/fixture', 'canonical_path_mismatch'],
  ['https://creditunionainews.com/news/fixture#PRIVATE]', 'canonical_path_mismatch'],
  ['https://creditunionainews.com/news/%66ixture.html', 'canonical_path_mismatch']
];
test('attachment invalid values explain the precise failed rule without clearing the recognized original URL', async () => {
  for (const [raw, category] of invalid.filter(([raw]) => raw !== null)) {
    const { result } = await read([post({ metadata: meta({ linkAttachment: { url: known, expandedUrl: raw } }) })]);
    assert.deepEqual(result.records[0].canonicalUrls, [known]); assert.equal(result.requiresReview, true);
    assert.deepEqual(result.records[0].diagnostic.reasons, [{ code: 'attachment_expanded_url_invalid', source: 'linkAttachment.expandedUrl', category }]);
    assert.equal(verifyPrivateLog(buildPrivateLog(result), stripDiagnostics(result)).evidenceComplete, true);
  }
});
test('original attachment field uses the same strict validation categories', async () => {
  for (const [raw, category] of invalid) {
    const { result } = await read([post({ metadata: meta({ linkAttachment: { url: raw, expandedUrl: known } }) })]);
    assert.equal(result.requiresReview, true);
    assert.deepEqual(result.records[0].diagnostic.reasons, [{ code: 'attachment_url_invalid', source: 'linkAttachment.url', category }]);
  }
});
test('valid noncanonical attachments identify the exact field and keep unknown destinations held', async () => {
  for (const [raw, category] of unresolved) for (const expanded of [false, true]) {
    const { result } = await read([post({ metadata: meta({ linkAttachment: expanded ? { url: known, expandedUrl: raw } : { url: raw, expandedUrl: null } }) })]);
    assert.equal(result.requiresReview, true);
    assert.deepEqual(result.records[0].diagnostic.reasons, [{ code: 'attachment_destination_unresolved', source: expanded ? 'linkAttachment.expandedUrl' : 'linkAttachment.url', category }]);
    assert.equal(verifyPrivateLog(buildPrivateLog(result), stripDiagnostics(result)).evidenceComplete, true);
  }
});
test('null expansion is absence; blank expansion stays invalid; default HTTPS port stays accepted', async () => {
  for (const expandedUrl of [null, known, known.replace('.com/', '.com:443/'), known + '?PRIVATE=SECRET#PRIVATE']) {
    const { result } = await read([post({ metadata: meta({ linkAttachment: { url: known, expandedUrl } }) })]);
    assert.equal(result.requiresReview, false); assert.deepEqual(result.records[0].canonicalUrls, [known]);
  }
});
test('body and first-comment token rules preserve current trailing punctuation and rejected delimiters', async () => {
  for (const source of ['body','firstComment']) {
    for (const [raw, category] of [...unresolved, ...invalid.filter(([raw]) => typeof raw === 'string' && /^(https?:\/\/|www\.)/.test(raw) && !/\s/.test(raw))]) {
      const fields = source === 'body' ? { text: known + ' ' + raw } : { metadata: meta({ firstComment: raw }) };
      const { result } = await read([post(fields)]);
      assert.equal(result.requiresReview, true);
      assert.deepEqual(result.records[0].diagnostic.reasons, [{ code: 'unresolved_link', source, category }]);
    }
    for (const suffix of [')', ',', '.', ';', '!', '?', '),.;!?']) {
      const fields = source === 'body' ? { text: '[' + known + suffix } : { metadata: meta({ firstComment: known + suffix }) };
      assert.equal((await read([post(fields)])).result.requiresReview, false);
    }
  }
});
test('multiple independent unresolved rules are retained and deduplicated, with no input values in evidence', async () => {
  const fields = { text: `${known} https://buff.ly/PRIVATE https://bit.ly/SECRET ${known}] https://foreign.invalid/PRIVATE https://user:SECRET@foreign.invalid/private`, metadata: meta({ linkAttachment: { url: 'https://buff.ly/PRIVATE', expandedUrl: known } }) };
  const { result } = await read([post(fields)]);
  assert.deepEqual(result.records[0].diagnostic.reasons.map(r => r.category), ['foreign_host','known_shortener','path_terminal_delimiter','url_credentials']);
  assert.equal(result.requiresReview, true);
  const lines = buildPrivateLog(result);
  assert.doesNotMatch(lines.join('\n'), /PRIVATE|SECRET|https?:|buff\.ly|foreign\.invalid|fixture\.html/);
  assert.equal(verifyPrivateLog(lines, stripDiagnostics(result)).evidenceComplete, true);
});
test('mixed body and comment holds are never cleared by a resolved paired attachment', async () => {
  const { result } = await read([post({ text: known + ' https://buff.ly/PRIVATE', metadata: meta({ firstComment: known + ']', linkAttachment: { url: 'https://buff.ly/PRIVATE', expandedUrl: known } }) })]);
  assert.deepEqual(result.records[0].diagnostic.reasons.map(r => [r.source,r.category]), [['body','known_shortener'],['firstComment','path_terminal_delimiter']]);
  assert.equal(result.requiresReview, true);
});
test('diagnostic off has identical output/requests and no explanation fields', async () => {
  for (const [raw] of [...invalid, ...unresolved]) {
    const fixture = [post({ metadata: meta({ linkAttachment: { url: known, expandedUrl: raw } }) })];
    const on = await read(fixture), off = await read(fixture, false);
    assert.deepEqual({ ...on, result: stripDiagnostics(on.result) }, off);
  }
});
test('78 and larger bounded synthetic inventories retain every rule below the actual reader truncation limit', async () => {
  for (const n of [78,100]) {
    const { result, calls } = await read(Array.from({ length: n }, (_, i) => post({ id: 'x'.repeat(190) + String(i).padStart(10,'0'), text: known + ' https://buff.ly/PRIVATE', metadata: meta({ linkAttachment: { url: known, expandedUrl: '  ' } }) })));
    assert.equal(calls, Math.ceil(n / 100));
    const lines = buildPrivateLog(result), readerLines = lines.map(line => line.slice(0, 2000));
    assert.deepEqual(readerLines, lines);
    for (const line of lines) {
      assert.ok(Buffer.byteLength(line) <= 1800); assert.ok(Buffer.byteLength(JSON.stringify(line)) <= 1800);
    }
    const verified = verifyPrivateLog(readerLines, stripDiagnostics(result));
    assert.equal(verified.evidenceComplete, true); assert.equal(verified.records.length, n);
    assert.equal(verifyPrivateLog(lines.slice(0,-1), stripDiagnostics(result)).evidenceComplete, false);
    assert.equal(verifyPrivateLog(lines.map((s,i) => i === 1 ? s.slice(0,-1) : s), stripDiagnostics(result)).evidenceComplete, false);
  }
});
test('1000-record reader still completes; evidence beyond fixed budgets aborts explicitly without raw fallback', async () => {
  const { result, calls } = await read(Array.from({ length: 1000 }, (_,i) => post({ id: 'r'+i, text: known + ' https://buff.ly/PRIVATE' })));
  assert.equal(calls, 10); assert.equal(result.complete, true); assert.equal(result.recordCount, 1000);
  const lines = [];
  const emitted = emitPrivateLog(result, { env: { VERCEL:'1', VERCEL_ENV:'production', VERCEL_GIT_COMMIT_SHA:sha }, write: line => lines.push(line) });
  assert.deepEqual(emitted, { emitted: false, error:'diagnostic_bound_exceeded' });
  assert.equal(lines.length, 1); assert.equal(JSON.parse(lines[0].slice(PREFIX.length)).kind, 'abort');
  assert.equal(verifyPrivateLog(lines, stripDiagnostics(result)).evidenceComplete, false);
  assert.doesNotMatch(lines[0], /PRIVATE|known_shortener|https?:|r999/);
});
test('unknown diagnostic categories and oversized per-record details fail closed', async () => {
  const { result } = await read([post({ text: known + ' https://buff.ly/PRIVATE' })]);
  const bad = structuredClone(result); bad.records[0].diagnostic.reasons[0].category = 'https://foreign.invalid/SECRET';
  assert.throws(() => buildPrivateLog(bad), /diagnostic_evidence_invalid/);
  const large = structuredClone(result);
  large.records[0].diagnostic.reasons = Array.from({length:17}, (_,i) => ({code:'unresolved_link',source:'body',category:String(i)}));
  assert.throws(() => buildPrivateLog(large), /diagnostic_evidence_invalid/);
});
