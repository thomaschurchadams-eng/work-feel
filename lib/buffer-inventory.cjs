// Read-only enumeration. No provider mutation, queue writer or scheduler dependency.
const { distribution } = require('../automation/media-policy.json');
const PAGE_SIZE = 100, MAX_PAGES = 10, TIMEOUT_MS = 10000;
const STATUSES = new Set(['draft', 'error', 'needs_approval', 'scheduled', 'sending', 'sent']);
const QUERY = `query BufferReservationInventory($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) {
  posts(first: 100, after: $after, input: {
    organizationId: $organizationId
    filter: { channelIds: [$channelId] }
    sort: [{ field: createdAt, direction: asc }]
  }) {
    edges { node {
      id text status channelId dueAt sentAt
      metadata {
        __typename
        ... on LinkedInPostMetadata {
          firstComment
          linkAttachment { url expandedUrl }
        }
      }
    } }
    pageInfo { hasNextPage endCursor }
  }
}`;

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10);
}
function linkEvidence(raw) {
  // Structured attachment fields must be one absolute web URL, not prose.
  if (typeof raw !== 'string' || raw.length > 10000 || !/^https?:\/\//i.test(raw) || /[\s\\]/.test(raw)) return { valid: false, canonical: null };
  try {
    const u = new URL(raw);
    if (u.username || u.password || u.port) return { valid: false, canonical: null };
    const publicPath = /^\/(?:[a-z0-9][a-z0-9._-]*\/)*(?:[a-z0-9][a-z0-9._-]*\.html)?$/.test(u.pathname);
    return { valid: true, canonical: u.protocol === 'https:' && u.hostname === 'creditunionainews.com' && publicPath ? u.origin + u.pathname : null };
  } catch { return { valid: false, canonical: null }; }
}
function destinations(text) {
  const urls = new Set();
  let unresolved = false;
  for (const raw of text.match(/(?:https?:\/\/|www\.)[^\s<>"']*/gi) || []) {
    const { canonical } = linkEvidence(raw.replace(/[),.;!?]+$/, ''));
    if (canonical) urls.add(canonical);
    else unresolved = true;
  }
  // Retain the review requirement even when another link is recognized. Never
  // persist or expand unresolved links, draft copy, queries or credentials.
  return { urls: [...urls].sort(), unresolved };
}
function postDestinations(post) {
  const body = destinations(post.text), urls = new Set(body.urls);
  let unresolved = body.unresolved;
  const result = () => ({ urls: [...urls].sort(), unresolved });
  const metadata = post.metadata;
  if (metadata === null) return result(); // Nullable in the provider schema.
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || metadata.__typename !== 'LinkedInPostMetadata') {
    unresolved = true; return result();
  }
  if (metadata.firstComment !== null) {
    if (typeof metadata.firstComment !== 'string' || metadata.firstComment.length > 100000) unresolved = true;
    else {
      const comment = destinations(metadata.firstComment);
      comment.urls.forEach(url => urls.add(url)); unresolved ||= comment.unresolved;
    }
  }
  const attachment = metadata.linkAttachment;
  if (attachment === null) return result();
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
    unresolved = true; return result();
  }
  const original = linkEvidence(attachment.url);
  const expanded = attachment.expandedUrl === null ? null : linkEvidence(attachment.expandedUrl);
  if (original.canonical) urls.add(original.canonical);
  if (expanded?.canonical) urls.add(expanded.canonical);
  // The provider's paired expansion can resolve this attachment only. It never
  // clears unresolved body/comment links, even when their text is identical.
  const resolved = original.valid && (expanded === null ? !!original.canonical
    : expanded.valid && !!expanded.canonical && (!original.canonical || original.canonical === expanded.canonical));
  unresolved ||= !resolved;
  return result();
}

async function readInventory(request, { organizationId, channel, commitSha }, now = Date.now) {
  const started = now(), records = [], seenIds = new Set(), cursors = new Set();
  let pagesRead = 0;
  const result = (complete, error = null) => ({
    complete, error, startedAt: new Date(started).toISOString(), observedAt: new Date(now()).toISOString(),
    commitSha, channelId: channel?.id || null,
    scope: 'all provider-retained posts for this channel; no status or date filter',
    consistency: 'paginated observation, not an atomic reservation or slot guarantee',
    pagesRead, pageSize: PAGE_SIZE, maximumPages: MAX_PAGES, timeoutMs: TIMEOUT_MS,
    recordCount: records.length, records,
    requiresReview: !complete || records.some(p => p.requiresReview) || channel?.isQueuePaused !== false,
    channelQueuePaused: typeof channel?.isQueuePaused === 'boolean' ? channel.isQueuePaused : null
  });
  if (channel?.id !== distribution.channelId || channel?.service !== 'linkedin' ||
      String(channel?.displayName || channel?.name || '').trim().toLowerCase() !== distribution.channelName.toLowerCase() ||
      typeof organizationId !== 'string' || !organizationId || !/^[a-f0-9]{40}$/.test(commitSha || '')) return result(false, 'inventory_identity_invalid');
  let after = null;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      if (signal.aborted || now() - started >= TIMEOUT_MS) return result(false, 'inventory_timeout');
      const data = await request(QUERY, { organizationId, channelId: channel.id, after }, signal);
      if (signal.aborted || now() - started >= TIMEOUT_MS) return result(false, 'inventory_timeout');
      const connection = data?.posts;
      if (!Array.isArray(connection?.edges) || connection.edges.length > PAGE_SIZE || typeof connection.pageInfo?.hasNextPage !== 'boolean') return result(false, 'inventory_page_invalid');
      pagesRead++;
      for (const edge of connection.edges) {
        const p = edge?.node;
        if (!p || typeof p.id !== 'string' || !p.id.trim() || p.id.length > 200 || p.channelId !== channel.id ||
            !STATUSES.has(p.status) || typeof p.text !== 'string' || p.text.length > 100000 ||
            !Object.hasOwn(p, 'dueAt') || !Object.hasOwn(p, 'sentAt') ||
            (p.dueAt !== null && !instant(p.dueAt)) || (p.sentAt !== null && !instant(p.sentAt)) ||
            (['scheduled', 'sending'].includes(p.status) && p.dueAt === null) ||
            (p.status === 'sent' && (p.sentAt === null || Date.parse(p.sentAt) > now()))) return result(false, 'inventory_record_invalid');
        if (seenIds.has(p.id)) return result(false, 'inventory_duplicate_post');
        seenIds.add(p.id);
        const { urls, unresolved } = postDestinations(p);
        records.push({ id: p.id, status: p.status, channelId: p.channelId, dueAt: p.dueAt, sentAt: p.sentAt, canonicalUrls: urls,
          requiresReview: unresolved || urls.length === 0 || ['draft', 'error', 'needs_approval', 'sending'].includes(p.status) || (p.status === 'scheduled' && Date.parse(p.dueAt) <= now()) });
      }
      if (!connection.pageInfo.hasNextPage) return result(true);
      const cursor = connection.pageInfo.endCursor;
      if (!connection.edges.length || typeof cursor !== 'string' || !cursor || cursor.length > 4000 || cursors.has(cursor)) return result(false, 'inventory_cursor_invalid');
      cursors.add(cursor); after = cursor;
    }
    return result(false, 'inventory_page_limit');
  } catch (error) {
    const code = signal.aborted || ['TimeoutError', 'AbortError'].includes(error?.name) ? 'inventory_timeout'
      : error?.status === 401 ? 'inventory_authentication_failed'
      : error?.status === 429 ? 'inventory_rate_limited' : 'inventory_provider_error';
    return result(false, code); // Never turn a partial/error response into an empty success.
  }
}

module.exports = { readInventory };
