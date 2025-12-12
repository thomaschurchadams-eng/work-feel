const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SIGNUPS_PATH = path.join(DATA_DIR, 'newsletter-signups.json');
const ADMIN_KEY = process.env.NEWSLETTER_ADMIN_KEY;
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ensureStore = () => {
  if (!fs.existsSync(SIGNUPS_PATH)) {
    fs.writeFileSync(SIGNUPS_PATH, '[]', 'utf8');
  }
};

const readSignups = () => {
  ensureStore();
  try {
    const raw = fs.readFileSync(SIGNUPS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read signups store', err);
    return [];
  }
};

const writeSignups = (entries) => {
  ensureStore();
  fs.writeFileSync(SIGNUPS_PATH, JSON.stringify(entries, null, 2), 'utf8');
};

const respondJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const serveStatic = (req, res, pathname) => {
  const safePath = path.normalize(path.join(__dirname, pathname)).replace(/\\/g, '/');
  if (!safePath.startsWith(__dirname.replace(/\\/g, '/'))) {
    return respondJson(res, 403, { message: 'Forbidden' });
  }

  let filePath = safePath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/newsletter' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch (err) {
        return respondJson(res, 400, { message: 'Invalid JSON payload.' });
      }

      const { email, firstName = '', lastName = '', employer = '' } = parsed;
      if (!email || typeof email !== 'string') {
        return respondJson(res, 400, { message: 'Email is required.' });
      }

      const now = new Date();
      const entry = {
        id: crypto.randomUUID(),
        email: email.trim(),
        firstName: typeof firstName === 'string' ? firstName.trim() : '',
        lastName: typeof lastName === 'string' ? lastName.trim() : '',
        employer: typeof employer === 'string' ? employer.trim() : '',
        timestamp: now.toISOString(),
        displayTimestamp: now.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      };

      const entries = readSignups();
      entries.push(entry);
      writeSignups(entries);
      return respondJson(res, 201, { success: true, entry });
    });
    return;
  }

  if (url.pathname === '/api/newsletter' && req.method === 'GET') {
    if (!ADMIN_KEY) {
      return respondJson(res, 500, { message: 'Admin key not configured.' });
    }
    const providedKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (providedKey !== ADMIN_KEY) {
      return respondJson(res, 401, { message: 'Unauthorized' });
    }
    const entries = readSignups().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return respondJson(res, 200, entries);
  }

  if (url.pathname === '/api/newsletter' && req.method === 'DELETE') {
    if (!ADMIN_KEY) {
      return respondJson(res, 500, { message: 'Admin key not configured.' });
    }
    const providedKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (providedKey !== ADMIN_KEY) {
      return respondJson(res, 401, { message: 'Unauthorized' });
    }
    writeSignups([]);
    return respondJson(res, 200, { success: true });
  }

  return serveStatic(req, res, url.pathname === '/' ? '/index.html' : url.pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
