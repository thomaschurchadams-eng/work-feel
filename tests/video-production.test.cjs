const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { hash, checkCues, alignedCues, prepare, handoff, craftReviewTemplate } = require('../lib/video-production.cjs');
const cues = [{ start: 0, end: 3, text: 'A useful point.' }, { start: 3, end: 6, text: 'Evidence comes first.' }];
const text = 'A useful point. Evidence comes first.';
test('display timing covers exact approved text without implying speech timing', () => {
  assert.equal(checkCues(cues, text, 6), cues);
  assert.throws(() => checkCues(cues, text.replace('Evidence', 'Engagement'), 6), /transcript_mismatch/);
});
test('caption overlap, missing coverage and unreadable speed are held', () => {
  assert.throws(() => checkCues([cues[0], { ...cues[1], start: 2 }], text, 6), /timing_invalid/);
  assert.throws(() => checkCues([cues[0]], cues[0].text, 6), /coverage_incomplete/);
  assert.throws(() => checkCues([{ start: 0, end: .1, text: 'Too fast to read.' }], 'Too fast to read.', .1), /readability_invalid/);
});
test('imported word timestamps are bound to audio, transcript and provenance', () => {
  const alignment = { audioSha256: 'a'.repeat(64), transcriptSha256: hash(Buffer.from(text)), method: 'provider-word-timestamps', evidence: 'Existing authorized timestamp receipt fixture', words: text.split(' ').map((text, i) => ({ text, start: i * .7, end: (i + 1) * .7 })) };
  assert.equal(alignedCues(alignment, text, 'a'.repeat(64), 6).length, 2);
  assert.throws(() => alignedCues(alignment, text, 'b'.repeat(64), 6), /identity_mismatch/);
  assert.throws(() => alignedCues({ ...alignment, evidence: '' }, text, 'a'.repeat(64), 6), /provenance_missing/);
  assert.throws(() => alignedCues({ ...alignment, words: alignment.words.slice(1) }, text, 'a'.repeat(64), 6), /word_text_mismatch/);
});
test('inputs reject changed bytes; silent mode rejects covert audio; narrated mode requires alignment', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-video-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source'), 'fixture'); fs.writeFileSync(path.join(root, 'text'), text);
  const spec = { schemaVersion: 1, id: 'review-fixture', mode: 'caption-led-silent', source: { file: 'source', sha256: hash(Buffer.from('fixture')) }, transcript: { file: 'text', sha256: hash(Buffer.from(text)) }, captions: cues, durationSeconds: 6, sources: ['https://example.org/source'], rightsNote: 'Original test fixture.' };
  assert.equal(prepare(spec, root).audio, null);
  assert.throws(() => prepare({ ...spec, audio: spec.source }, root), /must_not_have_audio/);
  assert.throws(() => prepare({ ...spec, mode: 'narrated', audio: spec.source }, root), /identity_missing/);
  fs.writeFileSync(path.join(root, 'source'), 'changed'); assert.throws(() => prepare(spec, root), /hash_mismatch/);
});
test('technical/render receipts cannot assert final listening or publication', () => {
  const job = { id: 'held-cut', mode: 'narrated', fingerprint: 'fingerprint' }, technical = { sha256: 'a'.repeat(64) };
  const review = { finishedSha256: technical.sha256, inputFingerprint: job.fingerprint, reviewer: 'Existing review owner fixture', evidence: 'Continuous full-cut viewing fixture', reviewedAt: '2026-10-12T12:00:00Z', continuousPlayback: true, captionsAndVisuals: true };
  assert.equal(handoff(job, technical, review).status, 'review-blocked');
  const passed = handoff(job, technical, { ...review, actualListening: true, narrationPronunciation: true, audioBalance: true });
  assert.equal(passed.status, 'reviewed-awaiting-normal-release-gates'); assert.equal(passed.productionVerified, false); assert.equal(passed.nativeVideo, null); assert.equal(passed.published, false);
  assert.equal(handoff(job, technical, { ...review, finishedSha256: 'stale' }).review, null);
});
test('silent review requires actual continuous visual playback; no invented hearing', () => {
  const job = { id: 'silent-review', mode: 'caption-led-silent', fingerprint: 'fingerprint' }, technical = { sha256: 'a'.repeat(64) };
  assert.equal(handoff(job, technical).status, 'review-blocked');
  const receipt = handoff(job, technical, { finishedSha256: technical.sha256, inputFingerprint: job.fingerprint, reviewer: 'Existing owner fixture', evidence: 'Actual silent playback fixture', reviewedAt: '2026-10-12T12:00:00Z', continuousPlayback: true, captionsAndVisuals: true });
  assert.equal(receipt.status, 'reviewed-awaiting-normal-release-gates'); assert.equal(receipt.review.actualListening, undefined); assert.equal(receipt.creditsConsumed, 0);
});
test('craft rubric keeps unobserved scores and engagement unknown and marks silent hearing inapplicable', () => {
  const review = craftReviewTemplate('silent-fixture', 'a'.repeat(64), 'caption-led-silent');
  assert.equal(review.dimensions['audio-balance'].status, 'not-applicable-silent');
  assert.equal(review.dimensions['editorial-opening'].score, null);
  assert.equal(review.dimensions['reason-to-share'].evidence, null);
  assert.deepEqual(review.referencesViewed, []);
  assert.equal(review.engagement.shares, null); assert.equal(review.engagement.retention, null);
  assert.equal(review.oneNextImprovement, null);
});
