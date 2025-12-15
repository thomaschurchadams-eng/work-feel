(function () {
  const alertsData = [
    {
      label: 'OpenAI',
      headline: 'OpenAI board withdraws lawsuit; no GPT-5 release timeline yet',
      summary:
        'The board signals a reset by dropping litigation and declining to set a GPT-5 schedule while safety reviews continue.',
      slug: 'openai-board-withdraws-lawsuit',
      link: '/news/ai-governance-board-expectations.html'
    },
    {
      label: 'Member Insights',
      headline: 'Search data shows members want AI for tailored support and budgeting',
      summary:
        'Members increasingly search for AI-driven financial coaching, pushing credit unions to personalize advice and savings nudges.',
      slug: 'ai-member-tailored-support',
      link: '/news/ai-personalization-digital-banking.html'
    },
    {
      label: 'Fraud',
      headline: 'Members say AI fraud protection is a must-have benefit',
      summary:
        'Heightened scams are raising expectations for real-time anomaly detection, proactive alerts, and frictionless remediation.',
      slug: 'ai-fraud-protection-necessity',
      link: '/news/ai-powered-fraud-tools.html'
    }
  ];

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    const existingAlertsLink = navLinks.querySelector('a[href$="/alerts/"]');
    if (existingAlertsLink) {
      existingAlertsLink.textContent = 'AI Newsroom Alerts';
    } else {
      const alertsLink = document.createElement('a');
      alertsLink.href = '/alerts/';
      alertsLink.textContent = 'AI Newsroom Alerts';
      const firstNav = navLinks.querySelector('a');
      if (firstNav) {
        firstNav.insertAdjacentElement('afterend', alertsLink);
      } else {
        navLinks.appendChild(alertsLink);
      }
    }
  }

  const normalizePath = (path) => path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll('.nav-links a').forEach((link) => {
    const linkPath = normalizePath(new URL(link.getAttribute('href'), window.location.origin).pathname);
    if (linkPath === currentPath || (currentPath === '/' && linkPath === '/index.html')) {
      link.classList.add('active');
    }
  });

  const newsletterForm = document.querySelector('#newsletter-form');
  const signupTableBody = document.querySelector('#signup-table-body');
  const signupEmptyState = document.querySelector('#signup-empty');
  const exportSignupsBtn = document.querySelector('#export-signups');
  const clearSignupsBtn = document.querySelector('#clear-signups');
  const SIGNUP_KEY = 'cuai_newsletter_signups';

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

  const renderSignupTable = () => {
    if (!signupTableBody) return;
    const entries = loadSignups().sort((a, b) => {
      const aDate = new Date(a.isoTimestamp || a.timestamp || 0);
      const bDate = new Date(b.isoTimestamp || b.timestamp || 0);
      return bDate - aDate;
    });

    if (signupEmptyState) {
      signupEmptyState.style.display = entries.length ? 'none' : 'block';
    }

    if (!entries.length) {
      signupTableBody.innerHTML = '';
      return;
    }

    signupTableBody.innerHTML = entries
      .map(
        (entry) => `
          <tr>
            <td>${entry.email}</td>
            <td>${entry.firstName || ''}</td>
            <td>${entry.timestamp || ''}</td>
          </tr>
        `
      )
      .join('');
  };

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      const now = new Date();
      addSignup({
        email,
        firstName,
        timestamp: formatTimestamp(now),
        isoTimestamp: now.toISOString()
      });

      if (status) {
        status.textContent = 'Thanks for subscribing.';
        status.style.display = 'block';
      }

      newsletterForm.reset();
    });
  }

  if (signupTableBody) {
    renderSignupTable();
  }

  if (exportSignupsBtn) {
    exportSignupsBtn.addEventListener('click', () => {
      const entries = loadSignups();
      if (!entries.length) return;
      const header = 'Email,First Name,Subscribed At\n';
      const rows = entries
        .map((entry) => `${entry.email},${entry.firstName || ''},${entry.timestamp || ''}`)
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
    clearSignupsBtn.addEventListener('click', () => {
      clearSignups();
      renderSignupTable();
    });
  }

  const header = document.querySelector('header');
  const buildTicker = () => {
    if (!header || !alertsData.length) return;

    const tickerBar = document.createElement('div');
    tickerBar.className = 'ticker-bar';
    tickerBar.innerHTML = `
      <div class="container ticker-track" aria-label="Latest updates">
        <a class="ticker-label" href="/alerts/">AI Newsroom Alerts</a>
        <div class="ticker-window">
          <div class="ticker-strip" role="list"></div>
        </div>
      </div>
    `;

    header.appendChild(tickerBar);

    const strip = tickerBar.querySelector('.ticker-strip');
    if (!strip) return;

    const renderItems = () =>
      alertsData
        .map(
          (item) => `
            <a class="ticker-item" href="/alerts/#${item.slug}" role="listitem">
              <span class="ticker-pill">${item.label}</span>
              <span class="ticker-text">${item.headline}</span>
            </a>
          `
        )
        .join('');

    strip.innerHTML = `${renderItems()}${renderItems()}`;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggleAnimation = () => {
      strip.style.animationPlayState = prefersReducedMotion.matches ? 'paused' : 'running';
    };

    toggleAnimation();
    prefersReducedMotion.addEventListener('change', toggleAnimation);
  };

  buildTicker();

  const alertsList = document.querySelector('#alerts-list');

  const renderAlerts = () => {
    if (!alertsList || !alertsData.length) return;

    alertsList.innerHTML = alertsData
      .map(
        (item) => `
          <article class="card" id="${item.slug}">
            <div class="meta"><span class="tag">${item.label}</span><span class="tag">Alert</span></div>
            <h3>${item.headline}</h3>
            <p>${item.summary}</p>
            <div class="actions">
              <a class="link" href="/alerts/#${item.slug}">Permalink →</a>
              <a class="link" href="${item.link}">Full coverage →</a>
            </div>
          </article>
        `
      )
      .join('');
  };

  renderAlerts();
})();
