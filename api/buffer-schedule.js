const fs = require('node:fs');
const path = require('node:path');

const BUFFER_API_URL = 'https://api.buffer.com';
const ALLOWED_HOST = 'creditunionainews.com';
const LINKEDIN_CHANNEL_NAME = 'creditunionai news';
const TIME_ZONE = 'America/New_York';
const MAX_ADVANCE_MS = 8 * 24 * 60 * 60 * 1000;
const MIN_ADVANCE_MS = 5 * 60 * 1000;

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

function requestValue(req, key) {
  const queryValue = req.query?.[key];
  if (typeof queryValue === 'string') return queryValue;
  const bodyValue = req.body?.[key];
  return typeof bodyValue === 'string' ? bodyValue : '';
}

function normalizedName(channel) {
  return String(channel.displayName || channel.name || '').trim().toLowerCase();
}

function easternParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
}

function easternDateKey(date) {
  const parts = easternParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validateScheduledFor(value) {
  const dueAt = new Date(value);
  if (!value || Number.isNaN(dueAt.getTime())) return { error: 'scheduled_for_invalid' };

  const delta = dueAt.getTime() - Date.now();
  if (delta < MIN_ADVANCE_MS) return { error: 'scheduled_for_not_in_future' };
  if (delta > MAX_ADVANCE_MS) return { error: 'scheduled_for_too_far_ahead' };

  const parts = easternParts(dueAt);
  const expected = parts.weekday === 'Mon' || parts.weekday === 'Fri'
    ? { hour: 12, minute: 30 }
    : ['Tue', 'Wed', 'Thu'].includes(parts.weekday)
      ? { hour: 11, minute: 30 }
      : null;

  if (!expected) return { error: 'scheduled_for_weekend' };
  if (Number(parts.hour) !== expected.hour || Number(parts.minute) !== expected.minute) {
    return {
      error: 'scheduled_for_outside_policy',
      expectedEasternTime: `${String(expected.hour).padStart(2, '0')}:${String(expected.minute).padStart(2, '0')}`
    };
  }

  return { dueAtIso: dueAt.toISOString(), easternDate: easternDateKey(dueAt) };
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
  let distributionUrl;
  try {
    articleUrl = new URL(item.articleUrl);
    distributionUrl = new URL(item.distributionUrl || item.articleUrl);
  } catch {
    return { error: 'queue_item_url_invalid' };
  }

  if (
    articleUrl.protocol !== 'https:' || articleUrl.hostname !== ALLOWED_HOST ||
    distributionUrl.protocol !== 'https:' || distributionUrl.hostname !== ALLOWED_HOST
  ) {
    return { error: 'queue_item_url_not_allowed' };
  }

  const previewUrl = distributionUrl.toString();
  if (!item.copy.includes(previewUrl)) return { error: 'queue_item_link_missing' };

  const schedule = validateScheduledFor(item.scheduledFor);
  if (schedule.error) return schedule;
  return { item, schedule, previewUrl };
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
  if (loaded.error) {
    return res.status(400).json({
      ok: false,
      error: loaded.error,
      expectedEasternTime: loaded.expectedEasternTime
    });
  }
  const { item, schedule, previewUrl } = loaded;

  try {
    const accountData = await bufferRequest(apiKey, `query BufferAccount {
      account { organizations { id name } }
    }`);
    const organizations = accountData?.account?.organizations || [];
    if (organizations.length !== 1) {
      return res.status(409).json({
        ok: false,
        error: organizations.length === 0 ? 'buffer_organization_not_found' : 'buffer_organization_ambiguous',
        organizationCount: organizations.length
      });
    }

    const organization = organizations[0];
    const channelData = await bufferRequest(apiKey, `query BufferChannels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id name displayName service isQueuePaused
      }
    }`, { organizationId: organization.id });

    const channel = (channelData?.channels || []).find(
      (entry) => String(entry.service || '').toLowerCase().includes('linkedin') &&
        normalizedName(entry) === LINKEDIN_CHANNEL_NAME
    );
    if (!channel) return res.status(409).json({ ok: false, error: 'creditunionai_linkedin_channel_not_found' });
    if (channel.isQueuePaused) return res.status(409).json({ ok: false, error: 'linkedin_channel_queue_paused' });

    const existingData = await bufferRequest(apiKey, `query ExistingPosts($organizationId: OrganizationId!, $channelId: ChannelId!) {
      posts(first: 100, input: {
        organizationId: $organizationId,
        filter: { status: [scheduled, sending, sent], channelIds: [$channelId] }
      }) {
        edges { node { id text status channelId createdAt dueAt sentAt } }
      }
    }`, { organizationId: organization.id, channelId: channel.id });

    const existingPosts = (existingData?.posts?.edges || []).map((edge) => edge.node);
    const duplicate = existingPosts.find((post) => post.text === item.copy);
    if (duplicate) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        itemId: item.id,
        postId: duplicate.id,
        status: duplicate.status,
        dueAt: duplicate.dueAt || null,
        sentAt: duplicate.sentAt || null,
        channelId: channel.id,
        channelName: channel.displayName || channel.name
      });
    }

    const sameDayPost = existingPosts.find((post) => {
      const timestamp = post.dueAt || post.sentAt;
      if (!timestamp) return false;
      const date = new Date(timestamp);
      return !Number.isNaN(date.getTime()) && easternDateKey(date) === schedule.easternDate;
    });
    if (sameDayPost) {
      return res.status(409).json({
        ok: false,
        error: 'linkedin_daily_cap_conflict',
        existingPostId: sameDayPost.id,
        existingStatus: sameDayPost.status,
        existingDueAt: sameDayPost.dueAt || null,
        easternDate: schedule.easternDate
      });
    }

    const createdData = await bufferRequest(apiKey, `mutation ScheduleLinkedInPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id text status channelId createdAt dueAt sentAt
            metadata {
              ... on LinkedInPostMetadata {
                linkAttachment { url expandedUrl title text thumbnail thumbnails }
              }
            }
          }
        }
        ... on MutationError { message }
      }
    }`, {
      input: {
        text: item.copy,
        channelId: channel.id,
        schedulingType: 'automatic',
        mode: 'customScheduled',
        dueAt: schedule.dueAtIso,
        saveToDraft: false,
        aiAssisted: true,
        source: 'creditunionainews',
        assets: [],
        metadata: {
          linkedin: {
            linkAttachment: { url: previewUrl }
          }
        }
      }
    });

    const result = createdData?.createPost;
    if (!result?.post) {
      return res.status(502).json({
        ok: false,
        error: 'buffer_schedule_creation_failed',
        message: result?.message || 'Buffer did not return a scheduled post.'
      });
    }

    const linkAttachment = result.post.metadata?.linkAttachment || null;
    if (!linkAttachment?.url) {
      return res.status(502).json({
        ok: false,
        error: 'buffer_link_preview_missing',
        message: 'Buffer scheduled the post without returning a LinkedIn link preview.'
      });
    }

    return res.status(201).json({
      ok: true,
      duplicate: false,
      itemId: item.id,
      postId: result.post.id,
      status: result.post.status,
      dueAt: result.post.dueAt || schedule.dueAtIso,
      sentAt: result.post.sentAt || null,
      easternDate: schedule.easternDate,
      channelId: channel.id,
      channelName: channel.displayName || channel.name,
      linkPreview: {
        url: linkAttachment.url,
        title: linkAttachment.title || null,
        thumbnail: linkAttachment.thumbnail || linkAttachment.thumbnails?.[0] || null
      }
    });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 502).json({
      ok: false,
      error: error.status === 401 ? 'buffer_authentication_failed' : 'buffer_api_error',
      message: error.message
    });
  }
};
