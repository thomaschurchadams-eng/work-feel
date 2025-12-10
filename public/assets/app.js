(function () {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  const normalizePath = (path) => {
    if (!path) return 'index';
    const url = new URL(path, window.location.origin);
    const trimmed = url.pathname.endsWith('/') && url.pathname !== '/' ? url.pathname.slice(0, -1) : url.pathname;
    const segment = trimmed.split('/').pop() || 'index';
    const withoutExt = segment.replace('.html', '') || 'index';
    return withoutExt === '' ? 'index' : withoutExt;
  };

  const activeTarget = normalizePath(window.location.pathname);
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (normalizePath(href) === activeTarget) {
      link.classList.add('active');
    }
  });

  const footerTemplate = `
    <div class="container footer-container">
      <div class="footer-brand">CreditUnionAI News</div>
      <div class="footer-links">
        <a href="/news.html">News</a>
        <a href="/alerts/">AI Newsroom Alerts</a>
        <a href="/episodes.html">Episodes</a>
        <a href="/insights.html">Insights</a>
        <a href="/newsletter.html">Newsletter</a>
        <a href="/about.html">About</a>
      </div>
      <div class="footer-connect">
        <strong>Connect:</strong>
        <a href="mailto:info@creditunionainews.com">Email</a>
        <span aria-hidden="true">·</span>
        <a href="https://www.linkedin.com/company/creditunionai-news/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <span aria-hidden="true">·</span>
        <a href="https://x.com/cuainews?s=21" target="_blank" rel="noopener noreferrer">X</a>
        <span aria-hidden="true">·</span>
        <a href="https://youtube.com/@creditunionainews?si=A22oeE1-K1fY0Gww" target="_blank" rel="noopener noreferrer">YouTube</a>
      </div>
    </div>
  `;

  const renderFooter = () => {
    document.querySelectorAll('.footer').forEach((footer) => {
      footer.innerHTML = footerTemplate;
    });
  };

  const renderAlerts = () => {
    const alertData = Array.isArray(window.CUAI_ALERTS) ? window.CUAI_ALERTS : [];
    if (!alertData.length) return;

    const sortedAlerts = [...alertData].sort((a, b) => new Date(b.date) - new Date(a.date));

    const createAlertCard = (alert) => {
      const href = alert.url || '#';
      const titleMarkup = alert.url
        ? `<a class="alert-title" href="${href}">${alert.title}</a>`
        : `<div class="alert-title">${alert.title}</div>`;

      const tagMarkup = alert.tag ? `<span class="tag">${alert.tag}</span>` : '';
      const summaryMarkup = alert.summary ? `<p class="alert-summary">${alert.summary}</p>` : '';

      return `
        <div class="card alert-card">
          <div class="alert-date">${alert.date}</div>
          ${titleMarkup}
          ${tagMarkup}
          ${summaryMarkup}
          ${alert.source ? `<div class="alert-source">Source: ${alert.source}</div>` : ''}
        </div>
      `;
    };

    document.querySelectorAll('.alerts-list[data-alerts]').forEach((container) => {
      const limitAttr = container.getAttribute('data-limit');
      const limit = limitAttr ? parseInt(limitAttr, 10) : undefined;
      const items = Number.isFinite(limit) ? sortedAlerts.slice(0, limit) : sortedAlerts;

      container.innerHTML = items.map(createAlertCard).join('');
    });
  };

  const signupTableBody = document.querySelector('#signup-table-body');
  const signupEmptyState = document.querySelector('#signup-empty');
  const exportSignupsBtn = document.querySelector('#export-signups');
  const clearSignupsBtn = document.querySelector('#clear-signups');
  const adminKeyInput = document.querySelector('#admin-key');
  const loadSignupsBtn = document.querySelector('#load-signups');
  const logStatus = document.querySelector('#log-status');
  let remoteSignups = [];
  const API_ENDPOINT = '/api/newsletter';

  const renderSignupTable = (entries = []) => {
    if (!signupTableBody) return;
    const rows = entries.length
      ? entries
          .map(
            (entry) => `
          <tr>
            <td>${entry.email}</td>
            <td>${entry.firstName || ''}</td>
            <td>${entry.lastName || ''}</td>
            <td>${entry.employer || ''}</td>
            <td>${entry.displayTimestamp || entry.timestamp || ''}</td>
          </tr>
        `
          )
          .join('')
      : '';

    signupTableBody.innerHTML = rows;

    if (signupEmptyState) {
      signupEmptyState.style.display = entries.length ? 'none' : 'block';
    }
  };

  const fetchRemoteSignups = async () => {
    if (!adminKeyInput) return [];
    const adminKey = adminKeyInput.value.trim();
    if (!adminKey) {
      if (logStatus) {
        logStatus.textContent = 'Enter your admin key to load signups.';
        logStatus.style.display = 'block';
      }
      return [];
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        headers: { 'x-admin-key': adminKey }
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const data = await response.json();
      remoteSignups = Array.isArray(data) ? data : [];
      renderSignupTable(remoteSignups);
      if (logStatus) {
        logStatus.textContent = `Loaded ${remoteSignups.length} signup${remoteSignups.length === 1 ? '' : 's'}.`;
        logStatus.style.display = 'block';
      }
      return remoteSignups;
    } catch (err) {
      console.error('Unable to fetch remote signups', err);
      if (logStatus) {
        logStatus.textContent = 'Could not load signups. Check your admin key or server status.';
        logStatus.style.display = 'block';
      }
      return [];
    }
  };

  if (signupTableBody) {
    renderSignupTable();
  }

  if (loadSignupsBtn) {
    loadSignupsBtn.addEventListener('click', fetchRemoteSignups);
  }

  if (exportSignupsBtn) {
    exportSignupsBtn.addEventListener('click', () => {
      if (!remoteSignups.length) return;
      const header = 'Email,First Name,Last Name,Employer,Subscribed At\n';
      const rows = remoteSignups
        .map(
          (entry) =>
            `${entry.email},${entry.firstName || ''},${entry.lastName || ''},${entry.employer || ''},${
              entry.displayTimestamp || entry.timestamp || ''
            }`
        )
        .join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'creditunionai-newsletter-signups.csv';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  if (clearSignupsBtn) {
    clearSignupsBtn.addEventListener('click', async () => {
      if (remoteSignups.length && adminKeyInput) {
        const adminKey = adminKeyInput.value.trim();
        if (!adminKey) return;
        try {
          const response = await fetch(API_ENDPOINT, {
            method: 'DELETE',
            headers: { 'x-admin-key': adminKey }
          });
          if (!response.ok) {
            throw new Error('Delete failed');
          }
          remoteSignups = [];
          renderSignupTable([]);
          if (logStatus) {
            logStatus.textContent = 'Remote signups cleared.';
            logStatus.style.display = 'block';
          }
          return;
        } catch (err) {
          console.error('Unable to clear remote signups', err);
        }
      }

      remoteSignups = [];
      renderSignupTable([]);
      if (logStatus) {
        logStatus.textContent = 'Log cleared locally.';
        logStatus.style.display = 'block';
      }
    });
  }

  renderFooter();
  renderAlerts();
})();
