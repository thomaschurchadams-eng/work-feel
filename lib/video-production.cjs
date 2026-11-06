// Local production only: no network, credentials, manifest, queue or publication writes.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { inspectPrefix, validateVideo } = require('./native-video.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const tokens = text => String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
function requireThat(ok, reason) { if (!ok) throw Error(reason); }
function checkCues(cues, transcript, duration) {
  requireThat(Array.isArray(cues) && cues.length > 0 && cues.length <= 500, 'captions_missing');
  let end = 0;
  for (const cue of cues) {
    requireThat(Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.start >= end && cue.end > cue.start && cue.end <= duration + .01, 'caption_timing_invalid');
    requireThat(cue.start - end <= .5, 'caption_gap_too_large');
    requireThat(typeof cue.text === 'string' && cue.text.trim() && cue.text.length <= 100 && cue.text.length / (cue.end - cue.start) <= 22, 'caption_readability_invalid');
    end = cue.end;
  }
  requireThat(cues[0].start === 0 && Math.abs(end - duration) <= .1, 'caption_coverage_incomplete');
  requireThat(JSON.stringify(tokens(cues.map(c => c.text).join(' '))) === JSON.stringify(tokens(transcript)), 'caption_transcript_mismatch');
  return cues;
}
function alignedCues(alignment, transcript, audioSha256, duration) {
  requireThat(alignment && alignment.audioSha256 === audioSha256 && alignment.transcriptSha256 === hash(Buffer.from(transcript)), 'alignment_identity_mismatch');
  requireThat(['provider-word-timestamps', 'local-forced-alignment', 'listened-word-timestamps'].includes(alignment.method) && typeof alignment.evidence === 'string' && alignment.evidence.trim(), 'alignment_provenance_missing');
  const words = alignment.words;
  requireThat(Array.isArray(words) && words.length > 0 && words.length <= 5000, 'alignment_words_missing');
  let end = 0;
  for (const word of words) {
    requireThat(typeof word.text === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= end && word.end > word.start && word.end <= duration, 'alignment_word_timing_invalid');
    end = word.end;
  }
  requireThat(JSON.stringify(tokens(words.map(w => w.text).join(' '))) === JSON.stringify(tokens(transcript)), 'alignment_word_text_mismatch');
  const cues = []; let pending = [];
  function flush() { if (pending.length) { cues.push({ start: pending[0].start, end: pending.at(-1).end, text: pending.map(w => w.text).join(' ') }); pending = []; } }
  for (const word of words) {
    if (pending.length && (pending.map(w => w.text).join(' ').length + word.text.length > 70 || word.end - pending[0].start > 5 || word.start - pending.at(-1).end > .5)) flush();
    pending.push(word);
    if (/[.!?]$/.test(word.text)) flush();
  }
  flush();
  // Extend display across inter-word pauses, never infer speech cutpoints from this.
  cues[0].start = 0;
  for (let i = 0; i < cues.length - 1; i++) cues[i].end = cues[i + 1].start;
  cues.at(-1).end = duration;
  return checkCues(cues, transcript, duration);
}
function verifiedInput(input, root) {
  const path = require('node:path');
  requireThat(input && typeof input.file === 'string' && /^[a-f0-9]{64}$/.test(input.sha256 || ''), 'input_identity_missing');
  const file = path.resolve(root, input.file), bytes = fs.readFileSync(file);
  requireThat(hash(bytes) === input.sha256, 'input_hash_mismatch');
  return { file, bytes, sha256: input.sha256 };
}
function prepare(spec, root) {
  requireThat(spec.schemaVersion === 1 && /^[a-z0-9-]{1,100}$/.test(spec.id || ''), 'job_identity_invalid');
  requireThat(['caption-led-silent', 'narrated'].includes(spec.mode), 'production_mode_invalid');
  requireThat(Number.isFinite(spec.durationSeconds) && spec.durationSeconds >= 3 && spec.durationSeconds <= 180, 'production_duration_invalid');
  const source = verifiedInput(spec.source, root), transcript = verifiedInput(spec.transcript, root);
  const text = transcript.bytes.toString('utf8').trim();
  let audio = null, cues;
  if (spec.mode === 'narrated') {
    audio = verifiedInput(spec.audio, root);
    const alignment = verifiedInput(spec.alignment, root);
    cues = alignedCues(JSON.parse(alignment.bytes), text, audio.sha256, spec.durationSeconds);
  } else {
    requireThat(!spec.audio && !spec.alignment, 'silent_job_must_not_have_audio');
    cues = checkCues(spec.captions, text, spec.durationSeconds);
  }
  requireThat(Array.isArray(spec.sources) && spec.sources.length && spec.sources.every(u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } }), 'source_links_missing');
  requireThat(typeof spec.rightsNote === 'string' && spec.rightsNote.trim(), 'rights_note_missing');
  return { id: spec.id, mode: spec.mode, source: source.file, audio: audio?.file || null, transcript: text, captions: cues, durationSeconds: spec.durationSeconds, inputSha256: { source: source.sha256, transcript: transcript.sha256, audio: audio?.sha256 || null }, sources: spec.sources, rightsNote: spec.rightsNote };
}
function technicalCheck(bytes, probe, mode) {
  const facts = inspectPrefix(bytes.subarray(0, 1048576));
  requireThat(probe.videoDecodeCompleted === true && probe.videoFrames > 0 && probe.videoCodec === 'avc1', 'video_decode_failed');
  requireThat(mode === 'caption-led-silent' ? probe.audioTracks === 0 : probe.audioTracks === 1 && probe.audioDecodeCompleted === true && probe.fullScaleSamples === 0, 'audio_track_check_failed');
  requireThat(Math.abs(facts.durationSeconds - probe.durationSeconds) <= .1 && facts.width === probe.width && facts.height === probe.height, 'probe_metadata_mismatch');
  const sha256 = hash(bytes);
  // Caption verification stays false until a genuine finished-playback receipt is supplied.
  const native = { url: `https://creditunionainews.com/assets/${sha256.slice(0, 12)}-${sha256.slice(0, 12)}.mp4`, sha256, bytes: bytes.length, durationSeconds: probe.durationSeconds, width: probe.width, height: probe.height, frameRate: probe.frameRate, mimeType: 'video/mp4', videoCodec: 'h264', hasVideoTrack: true, probeVerified: true, burnedInCaptionsVerified: true };
  requireThat(validateVideo(native) === null, 'native_technical_limits_failed');
  return { ...native, url: null, burnedInCaptionsVerified: false, audioTracks: probe.audioTracks, fullDecodeVerified: true, captionLayoutVerified: probe.captionLayoutVerified === true };
}
function handoff(job, technical, review = null) {
  const matched = review && review.finishedSha256 === technical.sha256 && review.inputFingerprint === job.fingerprint && typeof review.reviewer === 'string' && review.reviewer.trim() && typeof review.evidence === 'string' && review.evidence.trim() && Number.isFinite(Date.parse(review.reviewedAt)) && review.continuousPlayback === true && review.captionsAndVisuals === true;
  const heard = matched && review.actualListening === true && review.narrationPronunciation === true && review.audioBalance === true;
  const passed = !!matched && (job.mode === 'caption-led-silent' || heard);
  return { schemaVersion: 1, assetId: job.id, mode: job.mode, inputFingerprint: job.fingerprint, finishedSha256: technical.sha256, status: passed ? 'reviewed-awaiting-normal-release-gates' : 'review-blocked', nextOwner: 'cuai-media-coordinator', blocker: passed ? null : job.mode === 'caption-led-silent' ? 'Finished continuous visual playback and caption/source acceptance not yet recorded.' : 'Actual full-cut listening, pronunciation/audio balance and caption/playback acceptance not yet recorded.', alignmentScope: job.mode === 'caption-led-silent' ? 'Verified transcript-to-display schedule; no audio or speech alignment claim.' : 'Imported hash-bound word timestamps; timing checks do not establish actual listening.', nativeVideo: null, localVideo: { ...technical, burnedInCaptionsVerified: passed }, productionVerified: false, publisherAction: 'none; publisher re-reads main, sources, rights, current queue, dedup and release authorization after qualified production verification', creditsConsumed: 0, queueWrites: 0, published: false, review: matched ? review : null };
}
function craftReviewTemplate(id, sha256, mode) {
  const dimensions = ['editorial-opening', 'narration-pronunciation', 'pacing', 'visual-hierarchy', 'source-attribution', 'captions-mobile-accessibility', 'audio-balance', 'finished-playback', 'reason-to-share'];
  return { assetId: id, finishedSha256: sha256, status: 'unreviewed', asOf: null, previousAsset: null, referencesViewed: [], dimensions: Object.fromEntries(dimensions.map(name => [name, { score: null, status: mode === 'caption-led-silent' && ['narration-pronunciation', 'audio-balance'].includes(name) ? 'not-applicable-silent' : 'unknown', evidence: null }])), oneNextImprovement: null, improvementOutcome: 'unknown; requires actual comparable craft review', engagement: { reviewDueAt: null, actualPostId: null, companyChannelId: null, measuredAgeDays: null, shares: null, retention: null, status: 'unknown; no publication or provider metrics implied' } };
}
module.exports = { hash, tokens, checkCues, alignedCues, verifiedInput, prepare, technicalCheck, handoff, craftReviewTemplate };
