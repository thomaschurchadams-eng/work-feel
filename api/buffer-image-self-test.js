const fs = require('node:fs');
const path = require('node:path');

const BUFFER_API_URL = 'https://api.buffer.com';
const HOST = 'creditunionainews.com';
const CHANNEL_NAME = 'creditunionai news';

async function buffer(apiKey, query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || `Buffer request failed (${response.status})`);
  }
  return payload.data;
}

function input(req, key) {
  return typeof req.query?.[key] === 'string' ? req.query[key] : '';
}

function meta(html, key) {
  return html.match(new RegExp(`<meta\\b[^>]*property=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*property=["']${key}["']`, 'i'))?.[1]
    || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!commit || input(req, 'commitSha') !== commit) return res.status(403).json({ ok: false, error: 'deployment_commit_mismatch' });
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'buffer_api_key_missing' });

  const queue = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'automation', 'social-queue.json'), 'utf8'));
  const item = queue.items?.find((entry) => entry.id === input(req, 'itemId'));
  if (!item) return res.status(404).json({ ok: false, error: 'queue_item_not_found' });

  let draftId = null;
  try {
    const page = await fetch(item.articleUrl, { headers: { Accept: 'text/html' } });
    if (!page.ok) throw new Error(`Article fetch failed (${page.status})`);
    const html = await page.text();
    const imageUrl = new URL(meta(html, 'og:image'), item.articleUrl);
    if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== HOST || !imageUrl.pathname.startsWith('/assets/')) {
      throw new Error('Article hero image is not an approved public asset');
    }

    const account = await buffer(apiKey, 'query { account { organizations { id } } }');
    const organizationId = account.account.organizations?.[0]?.id;
    if (!organizationId) throw new Error('Buffer organization not found');
    const channels = await buffer(apiKey, `query ($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) { id name displayName service }
    }`, { organizationId });
    const channel = channels.channels.find((entry) =>
      String(entry.service || '').toLowerCase().includes('linkedin') &&
      String(entry.displayName || entry.name || '').trim().toLowerCase() === CHANNEL_NAME);
    if (!channel) throw new Error('CreditUnionAI News LinkedIn channel not found');

    const created = await buffer(apiKey, `mutation ($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id status assets { id mimeType source thumbnail } } }
        ... on MutationError { message }
      }
    }`, { input: {
      text: `CUAI media pipeline verification ${Date.now()}`,
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      saveToDraft: true,
      aiAssisted: true,
      source: 'creditunionainews-self-test',
      assets: [{ image: { url: imageUrl.toString(), metadata: { altText: meta(html, 'og:title') || 'CreditUnionAI News article illustration' } } }]
    } });
    if (!created.createPost?.post) throw new Error(created.createPost?.message || 'Buffer did not create the test draft');
    draftId = created.createPost.post.id;
    const images = (created.createPost.post.assets || []).filter((asset) => String(asset.mimeType || '').startsWith('image/'));
    if (!images.length) throw new Error('Buffer test draft did not contain an image asset');

    const deleted = await buffer(apiKey, `mutation ($input: DeletePostInput!) {
      deletePost(input: $input) {
        ... on DeletePostSuccess { id }
        ... on VoidMutationError { message }
      }
    }`, { input: { id: draftId } });
    if (!deleted.deletePost?.id) throw new Error(deleted.deletePost?.message || 'Test draft could not be deleted');

    return res.status(200).json({
      ok: true,
      imageAttached: true,
      imageUrl: images[0].source || imageUrl.toString(),
      mimeType: images[0].mimeType,
      testDraftDeleted: true
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: 'buffer_image_self_test_failed', message: error.message, draftId });
  }
};