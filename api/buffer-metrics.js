const fs = require('node:fs');
const path = require('node:path');

const BUFFER_API_URL = 'https://api.buffer.com';
const LINKEDIN_CHANNEL_NAME = 'creditunionai news';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function loadLedger() {
  const queuePath = path.join(process.cwd(), 'automation', 'social-queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  return Array.isArray(queue.items) ? queue.items : [];
}

function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) return [];
  return metrics.map((metric) => {
    const numericValue = Number(metric.value);
    return {
      type: String(metric.type || ''),
      name: String(metric.name || metric.type || ''),
      value: Number.isFinite(numericValue) ? numericValue : null,
      unit: String(metric.unit || '')
    };
  }).filter((metric) => metric.type && metric.value !== null);
}

function latestTimestamp(values) {
  const valid = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((value) => value.getTime()))).toISOString();
}

function summarize(posts, days, now) {
  const cutoff = now.getTime() - (days * DAY_MS);
  const selected = posts.filter((post) => {
    const sent = new Date(post.sentAt || post.dueAt || 0);
    return !Number.isNaN(sent.getTime()) && sent.getTime() >= cutoff;
  });

  const buckets = new Map();
  for (const post of selected) {
    for (const metric of post.metrics) {
      const key = `${metric.type}|${metric.unit}`;
      const existing = buckets.get(key) || {
        type: metric.type,
        name: metric.name,
        unit: metric.unit,
        total: 0,
        observations: 0
      };
      existing.total += metric.value;
      existing.observations += 1;
      buckets.set(key, existing);
    }
  }

  const metrics = Array.from(buckets.values())
    .map((metric) => ({
      type: metric.type,
      name: metric.name,
      unit: metric.unit,
      value: metric.unit === 'percentage'
        ? Number((metric.total / metric.observations).toFixed(2))
        : metric.total,
      observations: metric.observations,
      aggregation: metric.unit === 'percentage' ? 'mean' : 'sum'
    }))
    .sort((a, b) => a.type.localeCompare(b.type));

  return {
    days,
    postCount: selected.length,
    metricsReadyCount: selected.filter((post) => post.metrics.length > 0).length,
    metricsPendingCount: selected.filter((post) => post.metrics.length === 0).length,
    latestMetricsUpdatedAt: latestTimestamp(selected.map((post) => post.metricsUpdatedAt)),
    metrics
  };
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

  try {
    const accountData = await bufferRequest(
      apiKey,
      `query BufferAccount {
        account { organizations { id name } }
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
        }
      }`,
      { organizationId: organization.id }
    );

    const channel = (channelData?.channels || []).find(
      (entry) =>
        String(entry.service || '').toLowerCase().includes('linkedin') &&
        normalizedName(entry) === LINKEDIN_CHANNEL_NAME
    );

    if (!channel) {
      return res.status(409).json({ ok: false, error: 'creditunionai_linkedin_channel_not_found' });
    }

    const postsData = await bufferRequest(
      apiKey,
      `query BufferPostsWithMetrics($organizationId: OrganizationId!, $channelId: ChannelId!) {
        posts(
          first: 100
          input: {
            organizationId: $organizationId
            filter: { status: [sent], channelIds: [$channelId] }
            sort: [{ field: dueAt, direction: desc }]
          }
        ) {
          edges {
            node {
              id
              text
              status
              channelId
              dueAt
              sentAt
              externalLink
              metrics {
                type
                name
                value
                unit
              }
              metricsUpdatedAt
            }
          }
        }
      }`,
      { organizationId: organization.id, channelId: channel.id }
    );

    const ledger = loadLedger();
    const cutoff = Date.now() - (28 * DAY_MS);
    const posts = (postsData?.posts?.edges || [])
      .map((edge) => edge.node)
      .filter((post) => {
        const sent = new Date(post.sentAt || post.dueAt || 0);
        return !Number.isNaN(sent.getTime()) && sent.getTime() >= cutoff;
      })
      .map((post) => {
        const item = ledger.find((entry) =>
          entry.bufferPostId === post.id ||
          (entry.distributionUrl && post.text.includes(entry.distributionUrl)) ||
          (entry.articleUrl && post.text.includes(entry.articleUrl))
        );
        const metrics = normalizeMetrics(post.metrics);
        return {
          postId: post.id,
          itemId: item?.id || null,
          articleUrl: item?.articleUrl || null,
          distributionUrl: item?.distributionUrl || null,
          format: item?.format || null,
          scheduledFor: item?.scheduledFor || null,
          dueAt: post.dueAt || null,
          sentAt: post.sentAt || null,
          externalLink: post.externalLink || null,
          utmTracked: Boolean(item?.distributionUrl && post.text.includes(item.distributionUrl)),
          metrics,
          metricsUpdatedAt: post.metricsUpdatedAt || null
        };
      });

    const now = new Date();
    return res.status(200).json({
      ok: true,
      generatedAt: now.toISOString(),
      source: 'buffer',
      channel: {
        id: channel.id,
        name: channel.displayName || channel.name,
        service: channel.service
      },
      privacy: 'No names, email addresses, form values, or free-form reader data are returned.',
      freshness: 'Buffer refreshes post metrics approximately daily; recent sent posts may have pending metrics.',
      windows: {
        sevenDay: summarize(posts, 7, now),
        twentyEightDay: summarize(posts, 28, now)
      },
      posts
    });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 502).json({
      ok: false,
      error: error.status === 401 ? 'buffer_authentication_failed' : 'buffer_api_error',
      message: error.message
    });
  }
};
