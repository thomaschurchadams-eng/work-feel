const { validateVideo } = require('./native-video.cjs');
const DEFAULT_POLICY = require('../automation/media-policy.json');
const DAY = 86400000;
const ACTIVE = new Set(['planned', 'queued', 'scheduled', 'sending', 'sent', 'blocked']);
const TIMING_ASSIGNMENTS = new Map([['2026-10-20', '10:00'], ['2026-10-22', '11:30'], ['2026-10-27', '11:30'], ['2026-10-29', '10:00'], ['2026-11-03', '11:30'], ['2026-11-05', '10:00'], ['2026-11-10', '10:00'], ['2026-11-12', '11:30']]);
const FORMATS = new Set(['cartoon', 'chart', 'decision-card', 'podcast', 'short-video']);
function parts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
function easternDate(date) { const p = parts(date); return `${p.year}-${p.month}-${p.day}`; }
function dateValue(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const value = new Date(date + 'T12:00:00Z');
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date ? value : null;
}
function midday(date) {
  const day = dateValue(date)?.getUTCDay();
  return day === 1 || day === 5 ? '12:30' : day >= 2 && day <= 4 ? '11:30' : null;
}
function testValid(test) {
  const start = dateValue(test?.startsOn), end = dateValue(test?.endsOn);
  if (test?.status !== 'active' || !FORMATS.has(test.format) || test.experimentId !== 'cuai-timing-media-2026-10-20' || (!Number.isInteger(test.baselineValidatedObservations) || test.baselineValidatedObservations < 3) || !start || !end || end < start || (end - start) / DAY >= 42 || !Array.isArray(test.assignments) || test.assignments.length !== 8) return false;
  const dates = new Set(), weekdays = new Map(); let morning = 0, noon = 0;
  for (const a of test.assignments) {
    if (!a || typeof a !== 'object') return false;
    const d = dateValue(a.date), baseline = midday(a.date);
    if (!d || TIMING_ASSIGNMENTS.get(a.date) !== a.time || d < start || d > end || !baseline || dates.has(a.date) || !['10:00', baseline].includes(a.time)) return false;
    dates.add(a.date); const weekday = d.getUTCDay(); const arms = weekdays.get(weekday) || [0, 0]; arms[a.time === '10:00' ? 0 : 1]++; weekdays.set(weekday, arms); if (a.time === '10:00') morning++; else noon++;
  }
  return morning === 4 && noon === 4 && [...weekdays.values()].every(([a, b]) => a === b);
}
function validateSchedule(raw, item = {}, policy = DEFAULT_POLICY, now = Date.now()) {
  // Require a real ISO instant with seconds; reject JS's rollover of impossible dates.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw || '') || !dateValue(raw.slice(0, 10))) return { error: 'scheduled_for_invalid' };
  const due = new Date(raw); if (!Number.isFinite(due.getTime())) return { error: 'scheduled_for_invalid' };
  if (due.getTime() - now < 5 * 60000) return { error: 'scheduled_for_not_in_future' };
  if (due.getTime() - now > 8 * DAY) return { error: 'scheduled_for_too_far_ahead' };
  const date = easternDate(due), base = midday(date), p = parts(due);
  if (!base) return { error: 'scheduled_for_weekend' };
  let expected = base;
  if (item.timingExperimentId) {
    const t = policy.timingTest;
    const assignment = testValid(t) ? t.assignments.find(a => a.date === date) : null;
    if (!testValid(t) || item.contentKind !== 'media' || item.mediaFormat !== t.format || item.timingExperimentId !== t.experimentId || !assignment) return { error: 'timing_test_not_authorized' };
    expected = assignment.time;
  }
  if (`${p.hour}:${p.minute}` !== expected) return { error: 'scheduled_for_outside_policy' };
  return { dueAt: due.toISOString(), date };
}
function weekOf(date) {
  const d = dateValue(date); if (!d) return null;
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10);
}
function reservations(queue, providerPosts = []) {
  const rows = queue.filter(i => i.platform === 'linkedin' && ACTIVE.has(i.status)).map(i => ({ id: i.postId || i.id, date: Number.isFinite(Date.parse(i.scheduledFor)) ? easternDate(new Date(i.scheduledFor)) : null }));
  for (const p of providerPosts) {
    if (!['scheduled', 'sending', 'sent'].includes(p.status)) continue;
    const at = p.dueAt || p.sentAt;
    if (!p.id || !Number.isFinite(Date.parse(at))) throw Error('provider_reservation_invalid');
    const date = easternDate(new Date(at));
    const prior = rows.find(r => r.id === p.id);
    if (prior && prior.date !== date) throw Error('provider_reservation_mismatch');
    if (!prior) rows.push({ id: p.id, date });
  }
  return rows;
}
function checkCapacity(date, queue, providerPosts = [], excludeId) {
  if (!midday(date)) return { error: 'scheduled_for_weekend' };
  const rows = reservations(queue, providerPosts).filter(r => r.id !== excludeId);
  if (rows.some(r => r.date === date)) return { error: 'linkedin_daily_cap_conflict' };
  if (rows.filter(r => r.date && weekOf(r.date) === weekOf(date)).length >= 5) return { error: 'linkedin_weekly_cap_conflict' };
  return { ok: true };
}
function preparedInTime(asset, date) {
  if (!Number.isFinite(Date.parse(asset.preparedAt))) return false;
  const target = dateValue(date), ready = dateValue(easternDate(new Date(asset.preparedAt)));
  if (!target || !ready || ready >= target) return false;
  let days = 0; for (let d = new Date(ready); d < target; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() > 0 && d.getUTCDay() < 6) days++;
  return days >= 2;
}
function publicSource(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/^\d[\d.]*$/.test(u.hostname) && !u.hostname.endsWith('.localhost'); } catch { return false; }
}
function mediaPrepared(asset, date, now = Date.now()) {
  const target = dateValue(asset?.targetDate), promotion = dateValue(date);
  return Date.parse(asset?.preparedAt) <= now && !!target && !!promotion && promotion >= target && (promotion - target) / DAY <= 7 && ['ready', 'published'].includes(asset.status) && FORMATS.has(asset.format) && preparedInTime(asset, asset.targetDate) && asset.sourceVerified === true && Array.isArray(asset.sourceURLs) && asset.sourceURLs.length > 0 && asset.sourceURLs.every(publicSource) && asset.rightsVerified === true && asset.accessibilityVerified === true && (asset.distributionMode !== 'native-video' || !!asset.nativeVideo) && (!asset.nativeVideo || (!validateVideo(asset.nativeVideo) && asset.format === 'short-video' && asset.transcriptUrl === asset.canonicalUrl)) && /^https:\/\/creditunionainews\.com\//.test(asset.canonicalUrl || '') && /^https:\/\/creditunionainews\.com\/assets\/[a-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/.test(asset.thumbnailUrl || '');
}
function mediaReady(asset, date, now = Date.now()) { return mediaPrepared(asset, date, now) && asset.status === 'published' && asset.productionVerified === true; }
function selectSlot({ date, queue, media = [], articles = [], providerPosts = [], now = Date.now() }) {
  const existing = queue.find(i => i.platform === 'linkedin' && ACTIVE.has(i.status) && Number.isFinite(Date.parse(i.scheduledFor)) && easternDate(new Date(i.scheduledFor)) === date);
  if (existing) {
    const asset = media.find(a => a.id === existing.mediaAssetId);
    const matches = asset && (!(asset.distributionMode === 'native-video' || asset.nativeVideo) || existing.mediaType === 'video') && asset.canonicalUrl === existing.articleUrl && asset.thumbnailUrl === existing.imageUrl && asset.altText === existing.imageAlt && asset.format === existing.mediaFormat && (existing.mediaType !== 'video' || (asset.nativeVideo?.url === existing.videoUrl && asset.nativeVideo?.sha256 === existing.videoSha256));
    if (existing.status === 'planned' && existing.contentKind === 'media' && matches && mediaReady(asset, date, now)) return { status: 'ready-to-queue', itemId: existing.id };
    return { status: 'reserved', itemId: existing.id }; // immutable, never replace
  }
  const cap = checkCapacity(date, queue, providerPosts); if (cap.error) return { status: 'blocked', reason: cap.error };
  const usedUrls = new Set(queue.filter(i => i.platform === 'linkedin' && ACTIVE.has(i.status)).map(i => i.articleUrl));
  const parentAlreadyReserved = candidate => !!candidate.parentPublicationId && queue.some(item => item.parentPublicationId === candidate.parentPublicationId);
  const news = articles.find(a => a.eligible === true && a.classification === 'High' && !usedUrls.has(a.canonicalUrl) && !parentAlreadyReserved(a));
  const visual = media.find(a => mediaPrepared(a, date, now) && !usedUrls.has(a.canonicalUrl) && !queue.some(i => i.mediaAssetId === a.id) && !parentAlreadyReserved(a));
  const library = articles.find(a => a.eligible === true && a.classification === 'Library' && !usedUrls.has(a.canonicalUrl) && !parentAlreadyReserved(a));
  const choice = news || visual || library;
  return choice ? { status: choice === visual && !mediaReady(choice, date, now) ? 'prepared-selection' : 'selected', contentKind: choice === visual ? 'media' : 'article', assetId: choice.id, canonicalUrl: choice.canonicalUrl } : { status: 'no-qualified-selection' };
}
module.exports = { validateSchedule, easternDate, testValid, checkCapacity, selectSlot, mediaReady, mediaPrepared, preparedInTime };
