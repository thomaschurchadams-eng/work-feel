const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const ANALYTICS_READ_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const CUAI_EVENTS = [
  'article_view',
  'engaged_reader',
  'scroll_depth',
  'source_click',
  'related_content_click',
  'newsletter_intent',
  'outbound_click'
];

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
    try {
      const parsed = JSON.parse(raw);
      return {
        clientEmail: parsed.client_email || '',
        privateKey: normalizePrivateKey(parsed.private_key || '')
      };
    } catch (error) {
      const configError = new Error('GA4 service-account JSON is not valid JSON.');
      configError.code = 'ga4_service_account_json_invalid';
      throw configError;
    }
  }

  return {
    clientEmail: process.env.GA4_CLIENT_EMAIL || '',
    privateKey: normalizePrivateKey(process.env.GA4_PRIVATE_KEY || '')
  };
}

function loadConfig() {
  const propertyRaw = String(process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '').trim();
  const propertyId = propertyRaw.replace(/^properties\//, '');
  const serviceAccount = parseServiceAccount();
  const missing = [];

  if (!propertyId) missing.push('property_id');
  if (!serviceAccount.clientEmail || !serviceAccount.privateKey) missing.push('service_account');

  if (missing.length > 0) {
    return { ok: false, missing };
  }
  if (!/^\d+$/.test(propertyId)) {
    return { ok: false, missing: [], invalid: ['property_id_must_be_numeric'] };
  }

  return {
    ok: true,
    propertyId,
    clientEmail: serviceAccount.clientEmail,
    privateKey: serviceAccount.privateKey
  };
}

async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: config.clientEmail,
    scope: ANALYTICS_READ_SCOPE,
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
    const error = new Error(payloadJson?.error_description || payloadJson?.error || `Google OAuth token request failed (${response.status})`);
    error.status = response.status;
    error.code = 'ga4_authentication_failed';
    throw error;
  }
  return payloadJson.access_token;
}

function exactFilter(fieldName, value) {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: 'EXACT',
        value,
        caseSensitive: false
      }
    }
  };
}

function mapReport(payload) {
  const dimensions = (payload.dimensionHeaders || []).map((header) => header.name);
  const metrics = (payload.metricHeaders || []).map((header) => header.name);
  const rows = (payload.rows || []).map((row) => {
    const result = {};
    dimensions.forEach((name, index) => {
      result[name] = row.dimensionValues?.[index]?.value ?? null;
    });
    metrics.forEach((name, index) => {
      const raw = row.metricValues?.[index]?.value;
      const numeric = Number(raw);
      result[name] = raw !== undefined && Number.isFinite(numeric) ? numeric : (raw ?? null);
    });
    return result;
  });

  return {
    rowCount: payload.rowCount ?? rows.length,
    rows,
    metadata: {
      currencyCode: payload.metadata?.currencyCode || null,
      timeZone: payload.metadata?.timeZone || null,
      dataLossFromOtherRow: Boolean(payload.metadata?.dataLossFromOtherRow)
    }
  };
}

async function runReport(config, token, body) {
  const response = await fetch(`${DATA_API_BASE}/properties/${config.propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const message = payload?.error?.message || `GA4 Data API runReport failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = response.status === 403 ? 'ga4_property_access_denied' : 'ga4_data_api_error';
    throw error;
  }
  return mapReport(payload);
}

function dateRange(days) {
  return [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
}

async function queryWindow(config, token, days) {
  const dates = dateRange(days);
  const [overview, acquisition, linkedin, events, pages] = await Promise.all([
    runReport(config, token, {
      dateRanges: dates,
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'screenPageViews' },
        { name: 'scrolledUsers' }
      ]
    }),
    runReport(config, token, {
      dateRanges: dates,
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' }
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '50'
    }),
    runReport(config, token, {
      dateRanges: dates,
      dimensions: [
        { name: 'sessionManualAdContent' },
        { name: 'landingPagePlusQueryString' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            exactFilter('sessionManualSource', 'linkedin'),
            exactFilter('sessionManualMedium', 'organic_social'),
            exactFilter('sessionManualCampaignName', 'cuai_news')
          ]
        }
      },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '100'
    }),
    runReport(config, token, {
      dateRanges: dates,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CUAI_EVENTS, caseSensitive: true }
        }
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: '50'
    }),
    runReport(config, token, {
      dateRanges: dates,
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'scrolledUsers' },
        { name: 'userEngagementDuration' }
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: '50'
    })
  ]);

  let searchConsole = null;
  let searchConsoleError = null;
  try {
    searchConsole = await runReport(config, token, {
      dateRanges: dates,
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'organicGoogleSearchClicks' },
        { name: 'organicGoogleSearchImpressions' },
        { name: 'organicGoogleSearchClickThroughRate' },
        { name: 'organicGoogleSearchAveragePosition' }
      ],
      orderBys: [{ metric: { metricName: 'organicGoogleSearchImpressions' }, desc: true }],
      limit: '50'
    });
  } catch (error) {
    searchConsoleError = {
      code: error.code || 'search_console_unavailable',
      message: error.message
    };
  }

  return {
    days,
    overview: overview.rows[0] || {},
    acquisition: acquisition.rows,
    linkedin: linkedin.rows,
    events: events.rows,
    pages: pages.rows,
    searchConsole: searchConsole?.rows || null,
    searchConsoleError,
    notes: {
      scroll90: '`scrolledUsers` is GA4\'s built-in 90% scroll metric.',
      scroll50: '50% scroll requires the CUAI scroll threshold event parameter to be registered as a GA4 custom dimension before the Data API can break it out reliably.'
    }
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

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.code || 'ga4_configuration_invalid', message: error.message });
  }
  if (!config.ok) {
    return res.status(503).json({
      ok: false,
      error: 'ga4_reporting_not_configured',
      missing: config.missing || [],
      invalid: config.invalid || [],
      requiredEnvironment: {
        property: 'GA4_PROPERTY_ID (numeric GA4 property ID)',
        credentials: 'GA4_SERVICE_ACCOUNT_JSON, or GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY'
      }
    });
  }

  try {
    const token = await getAccessToken(config);
    const [sevenDay, twentyEightDay] = await Promise.all([
      queryWindow(config, token, 7),
      queryWindow(config, token, 28)
    ]);

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: 'google-analytics-data-api',
      propertyId: config.propertyId,
      privacy: 'Aggregate reporting only. The endpoint does not return names, emails, form values, client IDs, user IDs or free-form reader input.',
      windows: { sevenDay, twentyEightDay }
    });
  } catch (error) {
    const status = error.code === 'ga4_property_access_denied' ? 403 : 502;
    return res.status(status).json({
      ok: false,
      error: error.code || 'ga4_reporting_failed',
      message: error.message
    });
  }
};
