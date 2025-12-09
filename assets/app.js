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

  const newsletterForm = document.querySelector('#newsletter-form');
  const signupTableBody = document.querySelector('#signup-table-body');
  const signupEmptyState = document.querySelector('#signup-empty');
  const exportSignupsBtn = document.querySelector('#export-signups');
  const clearSignupsBtn = document.querySelector('#clear-signups');
  const adminKeyInput = document.querySelector('#admin-key');
  const loadSignupsBtn = document.querySelector('#load-signups');
  const logStatus = document.querySelector('#log-status');
  const SIGNUP_KEY = 'cuai_newsletter_signups';
  let remoteSignups = [];
  const API_ENDPOINT = '/api/newsletter';

  const loadSignups = () => {
    try {
      const raw = localStorage.getItem(SIGNUP_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Unable to read newsletter signups from localStorage', err);
      return [];
    }
  };

  const saveSignups = (entries) => {
    try {
      localStorage.setItem(SIGNUP_KEY, JSON.stringify(entries));
    } catch (err) {
      console.error('Unable to store newsletter signups', err);
    }
  };

  const addSignup = (entry) => {
    const current = loadSignups();
    current.push(entry);
    saveSignups(current);
  };

  const clearSignups = () => {
    localStorage.removeItem(SIGNUP_KEY);
  };

  const submitSignupToApi = async (entry) => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      return true;
    } catch (err) {
      console.error('Unable to send signup to API, falling back to local storage', err);
      return false;
    }
  };

  const formatTimestamp = (date) => {
    try {
      return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch (err) {
      return date.toISOString();
    }
  };

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

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const lastName = newsletterForm.querySelector('#lastName')?.value?.trim() || '';
      const employer = newsletterForm.querySelector('#employer')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      if (!email) {
        if (status) {
          status.textContent = 'Please provide an email to subscribe.';
          status.style.display = 'block';
        }
        return;
      }

      const now = new Date();
      const entry = {
        email,
        firstName,
        lastName,
        employer,
        timestamp: formatTimestamp(now),
        isoTimestamp: now.toISOString()
      };

      submitSignupToApi(entry).then((sentToApi) => {
        if (!sentToApi) {
          addSignup(entry);
        }

        if (status) {
          status.textContent = sentToApi
            ? 'Thanks for subscribing.'
            : 'Saved locally. We could not reach the server, but your entry is safe in this browser.';
          status.style.display = 'block';
        }

        newsletterForm.reset();
      });
    });
  }

  if (signupTableBody) {
    renderSignupTable();
  }

  if (loadSignupsBtn) {
    loadSignupsBtn.addEventListener('click', fetchRemoteSignups);
  }

  if (exportSignupsBtn) {
    exportSignupsBtn.addEventListener('click', () => {
      const entries = remoteSignups.length ? remoteSignups : loadSignups();
      if (!entries.length) return;
      const header = 'Email,First Name,Last Name,Employer,Subscribed At\n';
      const rows = entries
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

      clearSignups();
      renderSignupTable([]);
    });
  }
})();
