const fs = require('node:fs');
const path = require('node:path');
const scheduleHandler = require('./buffer-schedule');

const ALLOWED_HOST = 'creditunionainews.com';
const REQUIRED_UTM = {
  utm_source: 'linkedin',
  utm_medium: 'organic_social',
  utm_campaign: 'cuai_news'
};

function requestValue(req, key) {
  const queryValue = req.query?.[key];
  if (typeof queryValue === 'string') return queryValue;
  const bodyValue = req.body?.[key];
  return typeof bodyValue === 'string' ? bodyValue : '';
}

function loadQueueItem(itemId) {
  const queuePath = path.join(process.cwd(), 'automation', 'social-queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  return Array.isArray(queue.items) ? queue.items.find((entry) => entry.id === itemId) : null;
}

function validateTracking(item) {
  if (!item) return { error: 'queue_item_not_found' };
  if (item.status !== 'queued') return { error: 'queue_item_not_queued' };
  if (typeof item.distributionUrl !== 'string') return { error: 'distribution_url_missing' };

  let canonical;
  let distribution;
  try {
    canonical = new URL(item.articleUrl);
    distribution = new URL(item.distributionUrl);
  } catch {
    return { error: 'distribution_url_invalid' };
  }

  if (
    canonical.protocol !== 'https:' ||
    canonical.hostname !== ALLOWED_HOST ||
    distribution.protocol !== 'https:' ||
    distribution.hostname !== ALLOWED_HOST
  ) {
    return { error: 'distribution_url_not_allowed' };
  }

  if (
    canonical.origin !== distribution.origin ||
    canonical.pathname !== distribution.pathname ||
    canonical.hash !== distribution.hash
  ) {
    return { error: 'distribution_url_canonical_mismatch' };
  }

  const allowedParameters = new Set([
    ...Object.keys(REQUIRED_UTM),
    'utm_content'
  ]);
  for (const key of distribution.searchParams.keys()) {
    if (!allowedParameters.has(key)) return { error: 'distribution_url_unapproved_parameter' };
  }

  for (const [key, value] of Object.entries(REQUIRED_UTM)) {
    if (distribution.searchParams.get(key) !== value) {
      return { error: `distribution_url_${key}_invalid` };
    }
  }

  if (distribution.searchParams.get('utm_content') !== item.id) {
    return { error: 'distribution_url_utm_content_invalid' };
  }

  if (!item.copy.includes(item.distributionUrl)) {
    return { error: 'distribution_url_not_in_copy' };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  const itemId = requestValue(req, 'itemId');
  const item = loadQueueItem(itemId);
  const validation = validateTracking(item);
  if (validation.error) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  return scheduleHandler(req, res);
};
