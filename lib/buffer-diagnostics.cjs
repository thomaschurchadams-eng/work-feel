// Server-side evidence only. No transport, filesystem, credentials or provider calls.
const { createHash, randomUUID } = require('node:crypto');
const { distribution } = require('../automation/media-policy.json');
const PREFIX = 'CUAI_BUFFER_DIAGNOSTIC_V3 ';
// The authorized log reader truncates messages at 2,000 characters. Bound the
// complete prefixed line AND its JSON-escaped transport form, with headroom.
const MAX_RECORDS = 1000, MAX_CHUNKS = 128, MAX_LINE_BYTES = 1800, MAX_TOTAL_BYTES = 131072;
const lineBytes = line => Math.max(Buffer.byteLength(line), Buffer.byteLength(JSON.stringify(line)));
const SOURCE_KEYS = ['body','metadata','metadataTypename','firstComment','linkAttachment','attachmentUrl','attachmentExpandedUrl'];
const TYPES = new Set(['missing','unavailable','undefined','null','string','boolean','number','object','array','bigint','function','symbol']);
const REASONS = {
  metadata_missing: ['metadata','schema'], metadata_invalid_type: ['metadata','schema'], metadata_typename_unexpected: ['metadata','schema'],
  first_comment_missing: ['firstComment','schema'], first_comment_invalid_type: ['firstComment','schema'], first_comment_size_limit: ['firstComment','schema'],
  attachment_missing: ['linkAttachment','schema'], attachment_invalid_type: ['linkAttachment','schema'],
  attachment_url_invalid: ['linkAttachment.url','schema'], attachment_expanded_url_invalid: ['linkAttachment.expandedUrl','schema'],
  unresolved_link: [['body','firstComment'],'unresolved_destination'],
  attachment_destination_unresolved: ['linkAttachment','unresolved_destination'], attachment_destination_conflict: ['linkAttachment','unresolved_destination'],
  canonical_destination_absent: ['record','absence'], status_requires_review: ['record','status'], scheduled_time_elapsed: ['record','status']
};
const TOP_REASONS = new Set(['record_review_required','channel_queue_paused','channel_queue_state_unknown','inventory_identity_invalid','inventory_timeout','inventory_page_invalid','inventory_record_invalid','inventory_duplicate_post','inventory_cursor_invalid','inventory_page_limit','inventory_authentication_failed','inventory_rate_limited','inventory_provider_error','inventory_incomplete']);
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = () => { throw Error('diagnostic_evidence_invalid'); };
const idValid = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id);
function binding(inventory) {
  if (!inventory || !/^[a-f0-9]{40}$/.test(inventory.commitSha || '') || inventory.channelId !== distribution.channelId ||
      !Number.isInteger(inventory.recordCount) || inventory.recordCount < 0 || inventory.recordCount > MAX_RECORDS) fail();
  for (const key of ['startedAt','observedAt']) {
    const v = inventory[key];
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail();
  }
  if (inventory.startedAt > inventory.observedAt) fail();
  return { commitSha: inventory.commitSha, channelId: inventory.channelId, startedAt: inventory.startedAt, observedAt: inventory.observedAt, recordCount: inventory.recordCount };
}
function projectRecord(record) {
  if (!idValid(record?.id) || !record.diagnostic || !Array.isArray(record.diagnostic.reasons) || record.diagnostic.reasons.length > 16 || typeof record.requiresReview !== 'boolean') fail();
  const reasons = record.diagnostic.reasons.map(reason => {
    const allowed = REASONS[reason?.code];
    if (!allowed || !(Array.isArray(allowed[0]) ? allowed[0].includes(reason.source) : allowed[0] === reason.source) || allowed[1] !== reason.category) fail();
    return { code: reason.code, source: reason.source, category: reason.category };
  });
  if ((reasons.length > 0) !== record.requiresReview || new Set(reasons.map(digest)).size !== reasons.length) fail();
  const sources = {};
  for (const key of SOURCE_KEYS) {
    const shape = record.diagnostic.sources?.[key];
    if (!shape || typeof shape.present !== 'boolean' || !TYPES.has(shape.type)) fail();
    sources[key] = { present: shape.present, type: shape.type };
  }
  return { id: record.id, reasons, sources };
}
function project(inventory) {
  const bound = binding(inventory);
  if (!Array.isArray(inventory.records) || inventory.records.length !== bound.recordCount || typeof inventory.complete !== 'boolean' || typeof inventory.requiresReview !== 'boolean' ||
      !Array.isArray(inventory.diagnostic?.reasonCodes) || inventory.diagnostic.reasonCodes.length > 4) fail();
  const reasonCodes = inventory.diagnostic.reasonCodes.map(code => { if (!TOP_REASONS.has(code)) fail(); return code; });
  if ((reasonCodes.length > 0) !== inventory.requiresReview || new Set(reasonCodes).size !== reasonCodes.length) fail();
  const records = inventory.records.map(projectRecord);
  if (new Set(records.map(r => r.id)).size !== records.length) fail();
  return { binding: bound, inventoryComplete: inventory.complete, requiresReview: inventory.requiresReview, reasonCodes, records };
}
function stripDiagnostics(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (key, item) => /diagnostic/i.test(key) ? undefined : item));
}
function buildPrivateLog(inventory, trace = randomUUID()) {
  if (typeof trace !== 'string' || !/^[a-f0-9-]{32,36}$/.test(trace)) fail();
  const evidence = project(inventory), common = { schema: 3, trace, ...evidence.binding };
  const chunks = []; let records = [], start = 0;
  const event = (batch, index, offset) => ({ ...common, kind: 'chunk', index, start: offset, records: batch, chunkSha256: digest(batch) });
  const line = v => PREFIX + JSON.stringify(v);
  for (const record of evidence.records) {
    const trial = [...records, record];
    if (lineBytes(line(event(trial, MAX_CHUNKS, start))) > MAX_LINE_BYTES) {
      if (!records.length) throw Error('diagnostic_bound_exceeded');
      chunks.push(event(records, chunks.length, start)); start += records.length; records = [record];
    } else records = trial;
  }
  if (records.length) chunks.push(event(records, chunks.length, start));
  const accounting = { chunks: chunks.length, contentSha256: digest(evidence) };
  const lines = [
    line({ ...common, kind: 'begin', ...accounting, inventoryComplete: evidence.inventoryComplete, requiresReview: evidence.requiresReview, reasonCodes: evidence.reasonCodes }),
    ...chunks.map(line), line({ ...common, kind: 'end', ...accounting })
  ];
  if (chunks.length > MAX_CHUNKS || lines.some(v => lineBytes(v) > MAX_LINE_BYTES) || lines.reduce((n,v) => n + Buffer.byteLength(v) + 1, 0) > MAX_TOTAL_BYTES) throw Error('diagnostic_bound_exceeded');
  return lines;
}
function emitPrivateLog(inventory, { env = process.env, write = line => console.info(line) } = {}) {
  // Runtime identity is not proof of log privacy. Release must separately verify
  // access, sharing and forwarding. This prevents CI/local/preview emission.
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.VERCEL_GIT_COMMIT_SHA !== inventory?.commitSha) return { emitted: false, error: 'diagnostic_runtime_unverified' };
  let lines; const trace = randomUUID();
  try { lines = buildPrivateLog(inventory, trace); }
  catch (error) {
    const code = error?.message === 'diagnostic_bound_exceeded' ? 'diagnostic_bound_exceeded' : 'diagnostic_evidence_invalid';
    try {
      const line = PREFIX + JSON.stringify({ schema: 3, trace, ...binding(inventory), kind: 'abort', code });
      if (lineBytes(line) > MAX_LINE_BYTES) throw Error('diagnostic_bound_exceeded');
      write(line);
    }
    catch { return { emitted: false, error: 'diagnostic_preflight_failed' }; }
    return { emitted: false, error: code };
  }
  try { for (const line of lines) write(line); }
  catch { return { emitted: false, error: 'diagnostic_log_write_failed' }; }
  // No public receipt and no claim of ingestion/durable storage. The consumer
  // must retrieve and validate every line, including the terminal digest.
  return { emitted: true };
}
function verifyPrivateLog(lines, expectedInventory) {
  try {
    const expected = binding(expectedInventory);
    if (!Array.isArray(expectedInventory.records) || expectedInventory.records.length !== expected.recordCount || !expectedInventory.records.every(r => idValid(r.id))) fail();
    if (!Array.isArray(lines) || lines.length > MAX_CHUNKS + 2 || lines.reduce((n,v) => n + (typeof v === 'string' ? Buffer.byteLength(v) + 1 : MAX_TOTAL_BYTES), 0) > MAX_TOTAL_BYTES) fail();
    if (!lines.length) return { evidenceComplete: false, error: 'diagnostic_missing' };
    const events = lines.map(line => {
      if (typeof line !== 'string' || !line.startsWith(PREFIX) || lineBytes(line) > MAX_LINE_BYTES) fail();
      return JSON.parse(line.slice(PREFIX.length));
    });
    if (events.length === 1 && events[0].kind === 'abort') {
      const e = events[0];
      if (e.schema !== 3 || !/^[a-f0-9-]{32,36}$/.test(e.trace || '') || Object.keys(expected).some(key => e[key] !== expected[key]) || !['diagnostic_bound_exceeded','diagnostic_evidence_invalid'].includes(e.code)) fail();
      const allowed = ['schema','trace',...Object.keys(expected),'kind','code'];
      if (Object.keys(e).length !== allowed.length || Object.keys(e).some(key => !allowed.includes(key))) fail();
      return { evidenceComplete: false, error: e.code };
    }
    const starts = events.filter(e => e.kind === 'begin'), ends = events.filter(e => e.kind === 'end');
    if (starts.length !== 1 || ends.length !== 1) return { evidenceComplete: false, error: 'diagnostic_terminal_missing_or_duplicate' };
    const begin = starts[0], end = ends[0];
    if (!/^[a-f0-9-]{32,36}$/.test(begin.trace || '') || !Number.isInteger(begin.chunks) || begin.chunks < 0 || begin.chunks > MAX_CHUNKS) fail();
    for (const e of events) {
      if (e.schema !== 3 || e.trace !== begin.trace || !['begin','chunk','end'].includes(e.kind) || Object.keys(expected).some(key => e[key] !== expected[key])) return { evidenceComplete: false, error: 'diagnostic_binding_mismatch' };
      const allowed = ['schema','trace',...Object.keys(expected),'kind',...(e.kind === 'chunk' ? ['index','start','records','chunkSha256'] : e.kind === 'begin' ? ['chunks','contentSha256','inventoryComplete','requiresReview','reasonCodes'] : ['chunks','contentSha256'])];
      if (Object.keys(e).length !== allowed.length || Object.keys(e).some(key => !allowed.includes(key))) fail();
    }
    const chunks = events.filter(e => e.kind === 'chunk').sort((a,b) => a.index-b.index);
    if (chunks.length !== begin.chunks || end.chunks !== begin.chunks || events.length !== chunks.length + 2) return { evidenceComplete: false, error: 'diagnostic_chunk_missing_or_duplicate' };
    const records = [];
    for (const [index, chunk] of chunks.entries()) {
      if (chunk.index !== index || chunk.start !== records.length || !Array.isArray(chunk.records) || chunk.chunkSha256 !== digest(chunk.records)) return { evidenceComplete: false, error: 'diagnostic_chunk_invalid' };
      records.push(...chunk.records);
    }
    if (records.length !== expected.recordCount || records.some((r,i) => r.id !== expectedInventory.records[i].id) || new Set(records.map(r => r.id)).size !== records.length) return { evidenceComplete: false, error: 'diagnostic_record_accounting_mismatch' };
    const evidence = { binding: expected, inventoryComplete: begin.inventoryComplete, requiresReview: begin.requiresReview, reasonCodes: begin.reasonCodes, records };
    if (begin.inventoryComplete !== expectedInventory.complete || begin.requiresReview !== expectedInventory.requiresReview || begin.contentSha256 !== digest(evidence) || end.contentSha256 !== begin.contentSha256) return { evidenceComplete: false, error: 'diagnostic_digest_mismatch' };
    // Re-apply the same allowlist after retrieval; never accept extra log fields.
    const validated = project({ ...expectedInventory, diagnostic: { reasonCodes: begin.reasonCodes }, records: records.map((r,i) => ({ ...expectedInventory.records[i], diagnostic: { reasons: r.reasons, sources: r.sources } })) });
    if (digest(validated) !== digest(evidence)) fail();
    return { evidenceComplete: true, ...evidence };
  } catch { return { evidenceComplete: false, error: 'diagnostic_malformed_or_truncated' }; }
}
module.exports = { stripDiagnostics, buildPrivateLog, emitPrivateLog, verifyPrivateLog, PREFIX, MAX_RECORDS, MAX_CHUNKS, MAX_LINE_BYTES, MAX_TOTAL_BYTES };
