// Conservative Buffer/LinkedIn subset. No external host, signed URL or upload service.
const MAX_BYTES = 1000000000, PREFIX_BYTES = 1048576;
function validateVideo(video) {
  if (!video || typeof video !== 'object') return 'native_video_missing';
  let u; try { u = new URL(video.url); } catch { return 'video_url_invalid'; }
  if (u.protocol !== 'https:' || u.hostname !== 'creditunionainews.com' || u.port || u.username || u.password || u.search || u.hash || !/^\/assets\/[a-z0-9._-]+\.mp4$/.test(u.pathname)) return 'video_url_not_allowed';
  if (!/^[a-f0-9]{64}$/.test(video.sha256 || '') || !u.pathname.endsWith('-' + video.sha256.slice(0, 12) + '.mp4')) return 'video_content_address_missing';
  if (video.mimeType !== 'video/mp4' || video.videoCodec !== 'h264' || video.hasVideoTrack !== true || video.probeVerified !== true) return 'video_format_not_verified';
  if (!Number.isInteger(video.bytes) || video.bytes < 75000 || video.bytes > MAX_BYTES) return 'video_size_not_allowed';
  if (!Number.isFinite(video.durationSeconds) || video.durationSeconds < 3 || video.durationSeconds > 1800) return 'video_duration_not_allowed';
  if (!Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width < 256 || video.height < 144 || Math.max(video.width, video.height) > 1280 || Math.min(video.width, video.height) > 720 || video.width / video.height < 9 / 16 || video.width / video.height > 16 / 9) return 'video_dimensions_not_allowed';
  if (!Number.isFinite(video.frameRate) || video.frameRate < 10 || video.frameRate > 60 || video.bytes * 8 / video.durationSeconds >= 25000000) return 'video_rate_not_allowed';
  if (video.burnedInCaptionsVerified !== true) return 'video_captions_not_verified';
  return null;
}
function boxes(bytes, start = 0, end = bytes.length) {
  const rows = []; let at = start;
  while (at + 8 <= end) {
    let size = bytes.readUInt32BE(at), header = 8;
    if (size === 1) { if (at + 16 > end) throw Error('video_container_invalid'); size = Number(bytes.readBigUInt64BE(at + 8)); header = 16; }
    if (size === 0) size = end - at;
    if (!Number.isSafeInteger(size) || size < header) throw Error('video_container_invalid');
    if (at + size > end) break; // incomplete mdat is expected in a bounded range
    rows.push({ type: bytes.toString('ascii', at + 4, at + 8), start: at + header, end: at + size }); at += size;
  }
  return rows;
}
function inspectPrefix(bytes) {
  const top = boxes(bytes), ftyp = top.find(b => b.type === 'ftyp'), moov = top.find(b => b.type === 'moov');
  if (!ftyp || !moov) throw Error('video_faststart_metadata_missing');
  for (const track of boxes(bytes, moov.start, moov.end).filter(b => b.type === 'trak')) {
    const children = boxes(bytes, track.start, track.end), mdia = children.find(b => b.type === 'mdia'), tkhd = children.find(b => b.type === 'tkhd');
    if (!mdia || !tkhd) continue;
    const media = boxes(bytes, mdia.start, mdia.end), handler = media.find(b => b.type === 'hdlr'), mdhd = media.find(b => b.type === 'mdhd'), minf = media.find(b => b.type === 'minf');
    if (!handler || handler.end - handler.start < 12 || bytes.toString('ascii', handler.start + 8, handler.start + 12) !== 'vide') continue;
    if (!mdhd || !minf || tkhd.end - tkhd.start < 8) throw Error('video_track_invalid');
    const version = bytes[mdhd.start]; if (![0, 1].includes(version)) throw Error('video_track_invalid');
    const need = version === 1 ? 32 : 20; if (mdhd.end - mdhd.start < need) throw Error('video_track_invalid');
    const scale = bytes.readUInt32BE(mdhd.start + (version === 1 ? 20 : 12));
    const ticks = version === 1 ? Number(bytes.readBigUInt64BE(mdhd.start + 24)) : bytes.readUInt32BE(mdhd.start + 16);
    if (!scale || !Number.isFinite(ticks)) throw Error('video_track_invalid');
    const stbl = boxes(bytes, minf.start, minf.end).find(b => b.type === 'stbl');
    const stsd = stbl && boxes(bytes, stbl.start, stbl.end).find(b => b.type === 'stsd');
    if (!stsd || stsd.end - stsd.start < 8 || bytes.readUInt32BE(stsd.start + 4) !== 1) throw Error('video_codec_not_allowed');
    const sample = boxes(bytes, stsd.start + 8, stsd.end)[0]; if (!sample || sample.type !== 'avc1' || sample.end - sample.start < 78) throw Error('video_codec_not_allowed');
    const config = boxes(bytes, sample.start + 78, sample.end).find(b => b.type === 'avcC');
    if (!config || config.end - config.start < 7 || bytes[config.start] !== 1) throw Error('video_codec_not_allowed');
    return { durationSeconds: ticks / scale, width: bytes.readUInt32BE(tkhd.end - 8) / 65536, height: bytes.readUInt32BE(tkhd.end - 4) / 65536 };
  }
  throw Error('video_track_missing');
}
async function prefix(response) {
  if (!response.body?.getReader) { const b = Buffer.from(await response.arrayBuffer()); if (b.length > PREFIX_BYTES) throw Error('video_prefix_too_large'); return b; }
  const reader = response.body.getReader(), chunks = []; let count = 0;
  try { while (count < PREFIX_BYTES) { const r = await reader.read(); if (r.done) break; const b = Buffer.from(r.value); chunks.push(b.subarray(0, PREFIX_BYTES - count)); count += chunks.at(-1).length; } } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
async function inspectPublicVideo(video, fetcher = fetch) {
  const invalid = validateVideo(video); if (invalid) throw Error(invalid);
  const options = { redirect: 'error', signal: AbortSignal.timeout(10000) };
  const head = await fetcher(video.url, { ...options, method: 'HEAD' });
  const type = response => String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!head.ok || type(head) !== 'video/mp4' || Number(head.headers.get('content-length')) !== video.bytes) throw Error('video_public_headers_mismatch');
  const response = await fetcher(video.url, { ...options, headers: { Accept: 'video/mp4', Range: `bytes=0-${Math.min(video.bytes, PREFIX_BYTES) - 1}` } });
  if (!response.ok || ![200, 206].includes(response.status) || type(response) !== 'video/mp4') throw Error('video_public_range_invalid');
  const expectedBytes = Math.min(video.bytes, PREFIX_BYTES);
  if (response.status === 206 && response.headers.get('content-range') !== `bytes 0-${expectedBytes - 1}/${video.bytes}`) throw Error('video_public_range_invalid');
  const bytes = await prefix(response);
  if (bytes.length !== expectedBytes) throw Error('video_public_range_invalid');
  const facts = inspectPrefix(bytes);
  if (Math.abs(facts.durationSeconds - video.durationSeconds) > .1 || facts.width !== video.width || facts.height !== video.height) throw Error('video_public_probe_mismatch');
  return { type: 'video', url: video.url, contentType: 'video/mp4' };
}
function videoReceipt(post, media, context = {}) {
  const videos = (post.assets || []).filter(a => String(a.mimeType || '').toLowerCase() === 'video/mp4');
  const hasId = typeof post.id === 'string' && post.id.length > 0;
  const dueMatches = !post.dueAt || !context.dueAt || Date.parse(post.dueAt) === Date.parse(context.dueAt);
  const success = dueMatches && hasId && ['scheduled', 'sending', 'sent'].includes(post.status) && videos.length === 1 && post.assets.length === 1;
  const state = !hasId ? 'ambiguous' : success ? 'attached' : !dueMatches ? 'receipt-mismatch' : ['error', 'draft', 'needs_approval'].includes(post.status) ? 'failed' : 'pending-media';
  return { ...context, ok: success, postId: post.id, status: success ? post.status : 'blocked', providerStatus: post.status, dueAt: post.dueAt || context.dueAt, sentAt: post.sentAt || null, mediaType: 'video', videoAttached: success, videoUrl: media.url, videoMimeType: videos[0]?.mimeType || null, nativeVideoReceiptState: state, reconciliationRequired: !success };
}
module.exports = { validateVideo, inspectPrefix, inspectPublicVideo, videoReceipt };
