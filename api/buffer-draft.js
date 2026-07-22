const fs = require('node:fs');
const path = require('node:path');

const BUFFER_API_URL = 'https://api.buffer.com';
const ALLOWED_HOST = 'creditunionainews.com';
const DEFAULT_LINKEDIN_CHANNEL_NAME = 'creditunionai news';

async function bufferRequest(apiKey, query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
    const message = payload?.errors?.[0]?.message || `Buffer API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload.data;
}

function loadQueueItem(itemId) {
  const queuePath = path.join(process.cwd(), 'automation', 'social-queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const item = Array.isArray(queue.items) ? queue.items.find((entry) => entry.id === itemId) : null;

  if (!item) return { error: 'queue_item_not_found' };
  if (item.platform !== 'linkedin') return { error: 'queue_item_not_linkedin' };
  if (item.status !== 'queued') return { error: 'queue_item_not_queued' };
  if (typeof item.copy !== 'string' || item.copy.trim().length < 20) return { error: 'queue_item_copy_invalid' };

  let articleUrl;
  try {
    articleUrl = new URL(item.articleUrl);
  } catch {
    return { error: 'queue_item_url_invalid' };
  }

  if (articleUrl.protocol !== 'https:' || articleUrl.hostname !== ALLOWED_HOST) {
    return { error: 'queue_item_url_not_allowed' };
  }

  if (!item.copy.includes(item.articleUrl)) return { error: 'queue_item_link_missing' };
  return { item };
}

function requestValue(req, key) {
  const queryValue = req.query?.[key];
  if (typeof queryValue === 'string') return queryValue;
  const bodyValue = req.body?.[key];
  return typeof bodyValue === 'string' ? bodyValue : '';
}

function normalizedName(channel) {
  return String(channel.displayName || channel.name || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'buffer_api_key_missing' });

  const suppliedCommit = requestValue(req, 'commitSha');
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!deploymentCommit || suppliedCommit !== deploymentCommit) {
    return res.status(403).json({ ok: false, error: 'deployment_commit_mismatch' });
  }

  const itemId = requestValue(req, 'itemId');
  const loaded = loadQueueItem(itemId);
  if (loaded.error) return res.status(400).json({ ok: false, error: loaded.error });
  const { item } = loaded;

  try {
    const accountData = await bufferRequest(
      apiKey,
      `query BufferAccount {
        account {
          organizations { id name }
        }
      }`
    );

    const organizations = accountData?.account?.organizations || [];
    if (organizations.length !== 1) {
      return res.status(409).json({
        ok: false,
        error: organizations.length === 0 ? 'buffer_organization_not_found' : 'buffer_organization_ambiguous',
        organizationCount: organizations.length
      });
    }

    const organization = organizations[0];
    const channelData = await bufferRequest(
      apiKey,
      `query BufferChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          displayName
          service
          isQueuePaused
        }
      }`,
      { organizationId: organization.id }
    );

    const linkedinChannels = (channelData?.channels || []).filter((channel) =>
      String(channel.service || '').toLowerCase().includes('linkedin')
    );

    const configuredChannelId = process.env.BUFFER_LINKEDIN_CHANNEL_ID || '';
    const namedChannel = linkedinChannels.find(
      (entry) => normalizedName(entry) === DEFAULT_LINKEDIN_CHANNEL_NAME
    );
    const channel = configuredChannelId
      ? linkedinChannels.find((entry) => entry.id === configuredChannelId)
      : namedChannel || (linkedinChannels.length === 1 ? linkedinChannels[0] : null);

    if (!channel) {
      return res.status(409).json({
        ok: false,
        error: linkedinChannels.length === 0 ? 'linkedin_channel_not_found' : 'linkedin_channel_ambiguous',
        linkedinChannels: linkedinChannels.map((entry) => ({
          id: entry.id,
          name: entry.displayName || entry.name,
          service: entry.service
        }))
      });
    }

    if (normalizedName(channel) !== DEFAULT_LINKEDIN_CHANNEL_NAME) {
      return res.status(409).json({ ok: false, error: 'linkedin_channel_name_mismatch' });
    }

    const existingData = await bufferRequest(
      apiKey,
      `query ExistingDrafts($organizationId: OrganizationId!, $channelId: ChannelId!) {
        posts(
          first: 50
          input: {
            organizationId: $organizationId
            filter: { status: [draft], channelIds: [$channelId] }
          }
        ) {
          edges { node { id text status channelId createdAt } }
        }
      }`,
      { organizationId: organization.id, channelId: channel.id }
    );

    const existingPost = (existingData?.posts?.edges || [])
      .map((edge) => edge.node)
      .find((post) => post.text === item.copy);

    if (existingPost) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        itemId: item.id,
        postId: existingPost.id,
        status: existingPost.status,
        channelId: channel.id,
        channelName: channel.displayName || channel.name
      });
    }

    const createdData = await bufferRequest(
      apiKey,
      `mutation CreateLinkedInDraft($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post { id text status channelId createdAt }
          }
          ... on MutationError { message }
        }
      }`,
      {
        input: {
          text: item.copy,
          channelId: channel.id,
          schedulingType: 'automatic',
          mode: 'addToQueue',
          saveToDraft: true,
          aiAssisted: true,
          source: 'creditunionainews'
        }
      }
    );

    const result = createdData?.createPost;
    if (!result?.post) {
      return res.status(502).json({
        ok: false,
        error: 'buffer_draft_creation_failed',
        message: result?.message || 'Buffer did not return a created post.'
      });
    }

    return res.status(201).json({
      ok: true,
      duplicate: false,
      itemId: item.id,
      postId: result.post.id,
      status: result.post.status,
      channelId: channel.id,
      channelName: channel.displayName || channel.name
    });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 502).json({
      ok: false,
      error: error.status === 401 ? 'buffer_authentication_failed' : 'buffer_api_error',
      message: error.message
    });
  }
};
