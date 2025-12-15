(function () {
  const alertsData = [
    {
      label: 'AI Governance',
      headline: 'NCUA publishes AI resource center for credit unions',
      summary: 'NCUA launched examiner guidance covering model validation, vendor oversight, and documentation expectations.',
      impact: 'Clarifies the governance and evidence examiners expect for AI deployments.',
      sourceName: 'NCUA',
      sourceUrl: 'https://ncua.gov/newsroom',
      date: 'Jan 9, 2025',
      slug: 'ncua-ai-resource-center',
      link: '/news/ncua-ai-resource-center.html'
    },
    {
      label: 'Fraud',
      headline: 'Visa and Mastercard sync AI fraud defenses across issuers',
      summary: 'Network providers are coordinating AI-driven risk signals to cut false positives and stop coordinated card fraud faster.',
      impact: 'Expect higher fraud-blocking accuracy without adding friction for members.',
      sourceName: 'PaymentsDive',
      sourceUrl: 'https://www.paymentsdive.com/',
      date: 'Jan 7, 2025',
      slug: 'visa-mastercard-ai-fraud-network',
      link: '/news/visa-mastercard-ai-fraud.html'
    },
    {
      label: 'Operations',
      headline: 'Jack Henry adds AI agent handoffs to digital banking suite',
      summary: 'The core provider is rolling out AI copilots for frontline staff and member chat with automated CRM summaries.',
      impact: 'Smoother support workflows with less manual note-taking and shorter handle times.',
      sourceName: 'Jack Henry',
      sourceUrl: 'https://jackhenry.com/',
      date: 'Jan 6, 2025',
      slug: 'jack-henry-ai-agent-suite',
      link: '/news/jack-henry-ai-features.html'
    },
    {
      label: 'Member Experience',
      headline: 'Fintechs raise expectations for AI-first service journeys',
      summary: 'New entrants are marketing AI-led onboarding, proactive nudges, and multilingual support as default experiences.',
      impact: 'Raises the bar for self-service speed and personalization to retain digital-first members.',
      sourceName: 'Finextra',
      sourceUrl: 'https://www.finextra.com/',
      date: 'Jan 3, 2025',
      slug: 'fintechs-raise-ai-support',
      link: '/news/fintechs-raise-expectations.html'
    },
    {
      label: 'Payments',
      headline: 'FedNow real-time growth pressures staffing and alerts',
      summary: 'Rising instant-payment volume is driving demand for automated fraud holds and 24/7 exception handling.',
      impact: 'Teams need AI-assisted monitoring and member notifications to meet round-the-clock expectations.',
      sourceName: 'Federal Reserve',
      sourceUrl: 'https://www.frbservices.org/',
      date: 'Dec 20, 2024',
      slug: 'fednow-instant-payments-growth',
      link: '/news/fednow-instant-payments-growth.html'
    },
    {
      label: 'OpenAI',
      headline: 'OpenAI board withdraws lawsuit; no GPT-5 release timeline yet',
      summary: 'The board signaled a reset by dropping litigation while safety reviews continue.',
      impact: 'Signals a pause on major model releases while oversight questions are resolved.',
      sourceName: 'OpenAI',
      sourceUrl: 'https://openai.com/',
      date: 'Dec 19, 2024',
      slug: 'openai-board-withdraws-lawsuit',
      link: '/news/ai-governance-board-expectations.html'
    },
    {
      label: 'Member Insights',
      headline: 'Search data shows members want AI for tailored support and budgeting',
      summary: 'Members increasingly search for AI-driven financial coaching, budgeting help, and tailored advice.',
      impact: 'Credit unions need personalized nudges and guidance to stay competitive with AI-native experiences.',
      sourceName: 'Google Trends',
      sourceUrl: 'https://trends.google.com/',
      date: 'Dec 18, 2024',
      slug: 'ai-member-tailored-support',
      link: '/news/ai-personalization-digital-banking.html'
    },
    {
      label: 'Fraud',
      headline: 'Members say AI fraud protection is a must-have benefit',
      summary: 'Heightened scams are raising expectations for real-time anomaly detection, proactive alerts, and frictionless remediation.',
      impact: 'Strong AI fraud controls are becoming table stakes for member trust.',
      sourceName: 'CU Today',
      sourceUrl: 'https://www.cutoday.info/',
      date: 'Dec 12, 2024',
      slug: 'ai-fraud-protection-necessity',
      link: '/news/ai-powered-fraud-tools.html'
    }
  ];

  const parseAlertDate = (entry) => new Date(entry?.date || entry?.published || entry?.timestamp || 0);

  // Prepare alerts once for all consumers: newest-first and deduped by source URL or headline
  const preparedAlerts = (() => {
    const seenUrls = new Set();
    const seenHeadlines = new Set();

    return [...alertsData]
      .sort((a, b) => parseAlertDate(b) - parseAlertDate(a))
      .filter((alert) => {
        const urlKey = alert.sourceUrl?.trim().toLowerCase();
        const headlineKey = alert.headline?.trim().toLowerCase();
        const isDuplicate = (urlKey && seenUrls.has(urlKey)) || (headlineKey && seenHeadlines.has(headlineKey));

        if (isDuplicate) return false;

        if (urlKey) seenUrls.add(urlKey);
        if (headlineKey) seenHeadlines.add(headlineKey);
        return true;
      });
  })();

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

  document.querySelectorAll('.footer .footer-links').forEach((links) => {
    if (!links) return;

    const existingFooterLink = links.querySelector('a[href$="/alerts/"]');
    if (existingFooterLink) {
      existingFooterLink.textContent = 'AI Newsroom Alerts';
      existingFooterLink.href = '/alerts/';
      return;
    }

    const alertsFooterLink = document.createElement('a');
    alertsFooterLink.href = '/alerts/';
    alertsFooterLink.textContent = 'AI Newsroom Alerts';

    const firstFooterLink = links.querySelector('a');
    if (firstFooterLink) {
      firstFooterLink.insertAdjacentElement('beforebegin', alertsFooterLink);
    } else {
      links.appendChild(alertsFooterLink);
    }
  });

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
    if (!header || !preparedAlerts.length) return;

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
      preparedAlerts
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
    if (!alertsList || !preparedAlerts.length) return;

    alertsList.innerHTML = preparedAlerts
      .map(
        (item) => `
          <article class="card alert-card" id="${item.slug}">
            <div class="meta"><span class="tag">${item.label}</span><span class="tag tag-secondary">Alert</span></div>
            <div class="alert-content">
              <h3>${item.headline}</h3>
              <p class="alert-summary">${item.summary}</p>
              <p class="alert-impact"><span class="muted-label">Credit union impact:</span> ${item.impact || ''}</p>
              <p class="alert-source"><span class="muted-label">Source:</span> <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${item.sourceName}</a></p>
            </div>
            <p class="alert-date">${item.date || ''}</p>
          </article>
        `
      )
      .join('');
  };

  renderAlerts();
})();
