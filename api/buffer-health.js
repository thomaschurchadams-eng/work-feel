module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      configured: false,
      authenticated: false,
      error: 'buffer_api_key_missing'
    });
  }

  try {
    const response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'query BufferHealth { account { id organizations { id } } }'
      })
    });

    const payload = await response.json().catch(() => null);
    const graphQLErrors = Array.isArray(payload?.errors) && payload.errors.length > 0;
    const authenticated = response.ok && !graphQLErrors && Boolean(payload?.data?.account?.id);

    if (!authenticated) {
      return res.status(response.status === 401 ? 401 : 502).json({
        ok: false,
        configured: true,
        authenticated: false,
        upstreamStatus: response.status,
        error: response.status === 401 ? 'buffer_authentication_failed' : 'buffer_api_check_failed'
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      authenticated: true,
      organizationCount: Array.isArray(payload.data.account.organizations)
        ? payload.data.account.organizations.length
        : 0
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      configured: true,
      authenticated: false,
      error: 'buffer_api_unreachable'
    });
  }
};
