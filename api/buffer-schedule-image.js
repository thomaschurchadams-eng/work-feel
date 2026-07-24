const fs = require('node:fs');
const path = require('node:path');

const BUFFER_API_URL = 'https://api.buffer.com';
const HOST = 'creditunionainews.com';
const CHANNEL_NAME = 'creditunionai news';
const TIME_ZONE = 'America/New_York';
const MIN_ADVANCE_MS = 5 * 60 * 1000;
const MAX_ADVANCE_MS = 8 * 24 * 60 * 60 * 1000;

async function bufferRequest(apiKey, query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.errors?.length) {
    const error = new Error(payload?.errors?.[0]?.message || `Buffer API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function value(req, key) {
  return typeof req.query?.[key] === 'string'
    ? req.query[key]
    : typeof req.body?.[key] === 'string' ? req.body[key] : '';
}

function easternParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function easternDate(date) {
  const p = easternParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function validateSchedule(raw) {
  const dueAt = new Date(raw);
  if (!raw || Number.isNaN(dueAt.getTime())) return { error: 'scheduled_for_invalid' };
  const advance = dueAt.getTime() - Date.now();
  if (advance < MIN_ADVANCE_MS) return { error: 'scheduled_for_not_in_future' };
  if (advance > MAX_ADVANCE_MS) return { error: 'scheduled_for_too_far_ahead' };
  const p = easternParts(dueAt);
  const expected = ['Mon', 'Fri'].includes(p.weekday) ? [12, 30]
    : ['Tue', 'Wed', 'Thu'].includes(p.weekday) ? [11, 30] : null;
  if (!expected) return { error: 'scheduled_for_weekend' };
  if (Number(p.hour) !== expected[0] || Number(p.minute) !== expected[1]) {
    return { error: 'scheduled_for_outside_policy' };
  }
  return { dueAt: dueAt.toISOString(), date: easternDate(dueAt) };
}

function loadItem(itemId) {
  const queue = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'automation', 'social-queue.json'), 'utf8'));
  const item = queue.items?.find((entry) => entry.id === itemId);
  if (!item) return { error: 'queue_item_not_found' };
  if (item.platform !== 'linkedin') return { error: 'queue_item_not_linkedin' };
  if (item.status !== 'queued') return { error: 'queue_item_not_queued' };
  if (typeof item.copy !== 'string' || item.copy.trim().length < 20) return { error: 'queue_item_copy_invalid' };
  let article;
  let distribution;
  try {
    article = new URL(item.articleUrl);
    distribution = new URL(item.distributionUrl);
  } catch {
    return { error: 'queue_item_url_invalid' };
  }
  if (article.protocol !== 'https:' || article.hostname !== HOST ||
      distribution.protocol !== 'https:' || distribution.hostname !== HOST) {
    return { error: 'queue_item_url_not_allowed' };
  }
  if (!item.copy.includes(distribution.toString())) return { error: 'queue_item_link_missing' };
  const schedule = validateSchedule(item.scheduledFor);
  return schedule.error ? schedule : { item, articleUrl: article.toString(), schedule };
}

function meta(html, key, attribute = 'property') {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta\\b[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*${attribute}=["']${escaped}["']`, 'i')
  ];
  return html.match(patterns[0])?.[1] || html.match(patterns[1])?.[1] || '';
}

async function heroImage(item, articleUrl) {
  const page = await fetch(articleUrl, { headers: { Accept: 'text/html' } });
  if (!page.ok) return { error: 'article_page_unavailable_for_image', status: page.status };
  const pageFinal = new URL(page.url || articleUrl);
  if (pageFinal.hostname !== HOST || pageFinal.protocol !== 'https:') return { error: 'article_page_redirect_not_allowed' };
  const html = await page.text();
  const raw = item.imageUrl || meta(html, 'og:image') || meta(html, 'twitter:image', 'name');
  if (!raw) return { error: 'hero_image_missing' };
  let url;
  try { url = new URL(raw, articleUrl); } catch { return { error: 'hero_image_url_invalid' }; }
  if (url.protocol !== 'https:' || url.hostname !== HOST || url.search || url.hash ||
      !/^\/assets\/[a-z0-9._-]+\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    return { error: 'hero_image_url_not_allowed' };
  }
  const image = await fetch(url, { headers: { Accept: 'image/jpeg,image/png,image/webp', Range: 'bytes=0-4095' } });
  if (!image.ok) return { error: 'hero_image_unavailable', status: image.status };
  const contentType = String(image.headers.get('content-type') || '').toLowerCase();
  if (!/^image\/(jpeg|png|webp)(;|$)/i.test(contentType)) return { error: 'hero_image_content_type_invalid', contentType };
  if ((await image.arrayBuffer()).byteLength === 0) return { error: 'hero_image_empty' };
  return {
    url: url.toString(),
    contentType,
    altText: (item.imageAlt || meta(html, 'og:title') || 'CreditUnionAI News article illustration').slice(0, 300)
  };
}

function imageAssets(post) {
  return (post?.assets || []).filter((asset) => String(asset.mimeType || '').startsWith('image/'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'buffer_api_key_missing' });
  if (!process.env.VERCEL_GIT_COMMIT_SHA || value(req, 'commitSha') !== process.env.VERCEL_GIT_COMMIT_SHA) {
    return res.status(403).json({ ok: false, error: 'deployment_commit_mismatch' });
  }
  const loaded = loadItem(value(req, 'itemId'));
  if (loaded.error) return res.status(400).json({ ok: false, error: loaded.error });

  try {
    const media = await heroImage(loaded.item, loaded.articleUrl);
    if (media.error) return res.status(422).json({ ok: false, ...media });

    const account = await bufferRequest(apiKey, 'query { account { organizations { id name } } }');
    const organizations = account?.account?.organizations || [];
    if (organizations.length !== 1) return res.status(409).json({ ok: false, error: 'buffer_organization_ambiguous' });
    const organizationId = organizations[0].id;
    const channelData = await bufferRequest(apiKey, `query ($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) { id name displayName service isQueuePaused }
    }`, { organizationId });
    const channel = (channelData.channels || []).find((entry) =>
      String(entry.service || '').toLowerCase().includes('linkedin') &&
      String(entry.displayName || entry.name || '').trim().toLowerCase() === CHANNEL_NAME);
    if (!channel) return res.status(409).json({ ok: false, error: 'creditunionai_linkedin_channel_not_found' });
    if (channel.isQueuePaused) return res.status(409).json({ ok: false, error: 'linkedin_channel_queue_paused' });

    const existingData = await bufferRequest(apiKey, `query ($organizationId: OrganizationId!, $channelId: ChannelId!) {
      posts(first: 100, input: { organizationId: $organizationId, filter: { status: [scheduled, sending, sent], channelIds: [$channelId] } }) {
        edges { node { id text status dueAt sentAt assets { id mimeType source thumbnail } } }
      }
    }`, { organizationId, channelId: channel.id });
    const existing = (existingData.posts?.edges || []).map((edge) => edge.node);
    const duplicate = existing.find((post) => post.text === loaded.item.copy);
    if (duplicate) {
      if (!imageAssets(duplicate).length) return res.status(409).json({ ok: false, error: 'duplicate_post_missing_image', postId: duplicate.id });
      return res.status(200).json({ ok: true, duplicate: true, postId: duplicate.id, status: duplicate.status, dueAt: duplicate.dueAt, imageAttached: true });
    }
    const dayConflict = existing.find((post) => {
      const timestamp = post.dueAt || post.sentAt;
      return timestamp && easternDate(new Date(timestamp)) === loaded.schedule.date;
    });
    if (dayConflict) return res.status(409).json({ ok: false, error: 'linkedin_daily_cap_conflict', existingPostId: dayConflict.id });

    const created = await bufferRequest(apiKey, `mutation ($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id text status dueAt sentAt assets { id mimeType source thumbnail } } }
        ... on MutationError { message }
      }
    }`, { input: {
      text: loaded.item.copy,
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'customScheduled',
      dueAt: loaded.schedule.dueAt,
      saveToDraft: false,
      aiAssisted: true,
      source: 'creditunionainews',
      assets: [{ image: { url: media.url, metadata: { altText: media.altText } } }]
    } });
    const result = created.createPost;
    if (!result?.post) return res.status(502).json({ ok: false, error: 'buffer_schedule_creation_failed', message: result?.message });
    const images = imageAssets(result.post);
    if (!images.length) return res.status(502).json({ ok: false, error: 'buffer_image_asset_missing', postId: result.post.id });
    return res.status(201).json({
      ok: true, duplicate: false, itemId: loaded.item.id, postId: result.post.id,
      status: result.post.status, dueAt: result.post.dueAt || loaded.schedule.dueAt,
      sentAt: result.post.sentAt || null, channelId: channel.id,
      channelName: channel.displayName || channel.name, imageAttached: true,
      imageUrl: images[0].source || media.url, imageMimeType: images[0].mimeType || media.contentType
    });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 502).json({
      ok: false,
      error: error.status === 401 ? 'buffer_authentication_failed' : 'buffer_api_error',
      message: error.message
    });
  }
};