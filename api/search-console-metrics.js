const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SEARCH_CONSOLE_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const CUAI_HOST = 'creditunionainews.com';

function requestValue(req, key) {
  const queryValue = req.query?.[key];
  if (typeof queryValue === 'string') return queryValue;
  const bodyValue = req.body?.[key];
  return typeof bodyValue === 'string' ? bodyValue : '';
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function parseServiceAccount() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      clientEmail: parsed.client_email || '',
      privateKey: normalizePrivateKey(parsed.private_key || '')
    };
  }
  return {
    clientEmail: process.env.GA4_CLIENT_EMAIL || '',
    privateKey: normalizePrivateKey(process.env.GA4_PRIVATE_KEY || '')
  };
}

function loadConfig() {
  try {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
      return { ok: false, error: 'search_console_service_account_missing' };
    }
    return { ok: true, ...serviceAccount };
  } catch {
    return { ok: false, error: 'search_console_service_account_invalid' };
  }
}

async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: config.clientEmail,
    scope: SEARCH_CONSOLE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const payloadJson = await response.json().catch(() => null);
  if (!response.ok || !payloadJson?.access_token) {
    const error = new Error('Search Console OAuth token request failed.');
    error.code = 'search_console_authentication_failed';
    error.status = response.status;
    throw error;
  }
  return payloadJson.access_token;
}

async function googleRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Search Console API request failed (${response.status})`);
    error.status = response.status;
    error.code = response.status === 403
      ? 'search_console_access_denied_or_api_disabled'
      : 'search_console_api_error';
    throw error;
  }
  return payload || {};
}

function selectCuaiSite(siteEntries) {
  const configured = String(process.env.SEARCH_CONSOLE_SITE_URL || '').trim();
  if (configured) {
    return siteEntries.find((entry) => entry.siteUrl === configured) || null;
  }
  const preferred = [
    `sc-domain:${CUAI_HOST}`,
    `https://${CUAI_HOST}/`,
    `https://www.${CUAI_HOST}/`,
    `http://${CUAI_HOST}/`,
    `http://www.${CUAI_HOST}/`
  ];
  for (const siteUrl of preferred) {
    const match = siteEntries.find((entry) => entry.siteUrl === siteUrl);
    if (match) return match;
  }
  return siteEntries.find((entry) => String(entry.siteUrl || '').includes(CUAI_HOST)) || null;
}

function pacificDate(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function queryWindow(token, siteUrl, days) {
  const endDate = pacificDate(1);
  const startDate = pacificDate(days);
  const baseBody = { startDate, endDate };
  const endpoint = `${SEARCH_CONSOLE_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const [aggregate, pages] = await Promise.all([
    googleRequest(token, endpoint, {
      method: 'POST',
      body: JSON.stringify(baseBody)
    }),
    googleRequest(token, endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...baseBody, dimensions: ['page'], rowLimit: 25 })
    })
  ]);
  const aggregateRow = aggregate.rows?.[0] || null;
  return {
    days,
    startDate,
    endDate,
    aggregate: aggregateRow ? {
      clicks: aggregateRow.clicks ?? 0,
      impressions: aggregateRow.impressions ?? 0,
      ctr: aggregateRow.ctr ?? 0,
      position: aggregateRow.position ?? null
    } : { clicks: 0, impressions: 0, ctr: 0, position: null },
    topPages: (pages.rows || []).map((row) => ({
      page: row.keys?.[0] || null,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? null
    }))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const suppliedCommit = requestValue(req, 'commitSha');
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!deploymentCommit || suppliedCommit !== deploymentCommit) {
    return res.status(403).json({ ok: false, error: 'deployment_commit_mismatch' });
  }

  const config = loadConfig();
  if (!config.ok) {
    return res.status(503).json({ ok: false, error: config.error });
  }

  try {
    const token = await getAccessToken(config);
    const sitesPayload = await googleRequest(token, `${SEARCH_CONSOLE_API_BASE}/sites`);
    const siteEntries = Array.isArray(sitesPayload.siteEntry) ? sitesPayload.siteEntry : [];
    const selected = selectCuaiSite(siteEntries);
    if (!selected) {
      return res.status(403).json({
        ok: false,
        error: 'search_console_property_not_accessible',
        accessibleSiteCount: siteEntries.length
      });
    }

    const [sevenDay, twentyEightDay] = await Promise.all([
      queryWindow(token, selected.siteUrl, 7),
      queryWindow(token, selected.siteUrl, 28)
    ]);

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: 'google-search-console-api',
      siteUrl: selected.siteUrl,
      permissionLevel: selected.permissionLevel || null,
      privacy: 'Aggregate Search Console reporting only; no reader identities or credentials are returned.',
      windows: { sevenDay, twentyEightDay }
    });
  } catch (error) {
    const status = error.code === 'search_console_access_denied_or_api_disabled' ? 403 : 502;
    return res.status(status).json({
      ok: false,
      error: error.code || 'search_console_reporting_failed',
      message: error.message
    });
  }
};
