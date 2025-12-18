(function () {
  const alertsData = [
    {
      label: 'Agentic AI',
      headline: 'Major banks prepare customer-facing agentic AI trials amid regulatory scrutiny',
      summary:
        'Reuters reports that British banks such as NatWest, Lloyds and Starling are working with the Financial Conduct Authority (FCA) to pilot agentic AI systems capable of planning and acting autonomously — a shift from back-office use that raises new governance and stability concerns.',
      impact:
        'As autonomous AI moves closer to consumer finance applications, credit unions should monitor evolving governance expectations and risk frameworks emerging from regulator-bank dialogues.',
      sourceName: 'Reuters',
      sourceUrl: 'https://www.reuters.com/markets/funds/agentic-ai-race-by-british-banks-raises-new-risks-regulator-2025-12-17/',
      date: 'Dec 17, 2025',
      slug: 'agentic-ai-customer-facing-trials-fca',
      link: 'https://www.reuters.com/markets/funds/agentic-ai-race-by-british-banks-raises-new-risks-regulator-2025-12-17/'
    },
    {
      label: 'Fraud',
      headline: 'AI fraud detection firm Informed.IQ secures $63M investment to expand services',
      summary:
        'Invictus Growth Partners has invested $63 million in Informed.IQ, a provider of AI-powered fraud detection and loan verification services used by major lenders; the funding will support expansion into mortgage and consumer lending fraud markets.',
      impact:
        'Advanced AI for fraud prevention affects risk models and vendor decisions for credit unions evaluating next-gen detection tools in lending and compliance workflows.',
      sourceName: 'AInvest/Reuters',
      sourceUrl:
        'https://www.tradingview.com/news/reuters.com%2C2025%3Anewsml_FWN3XM0BP%3A0-informed-iq-secures-63-million-from-invictus-growth-partners/',
      date: 'Dec 16, 2025',
      slug: 'informed-iq-63m-funding-fraud-expansion',
      link:
        'https://www.tradingview.com/news/reuters.com%2C2025%3Anewsml_FWN3XM0BP%3A0-informed-iq-secures-63-million-from-invictus-growth-partners/'
    },
    {
      label: 'Infrastructure',
      headline: 'AI infrastructure services become foundational for financial services computing',
      summary:
        'Recent industry analysis highlights that AI infrastructure services — spanning data orchestration, accelerators and lifecycle management platforms — are evolving from niche add-ons to central components of enterprise computing stacks in banking and financial services.',
      impact:
        'As financial institutions deepen AI use, infrastructure choices increasingly influence cost, scalability and governance decisions for all AI initiatives credit unions may consider.',
      sourceName: 'RTInsights',
      sourceUrl: 'https://www.rtinsights.com/ai-infrastructure-services-banking-and-financial-services-new-foundation-for-computing/',
      date: 'Dec 16, 2025',
      slug: 'ai-infrastructure-foundational-financial-services',
      link: 'https://www.rtinsights.com/ai-infrastructure-services-banking-and-financial-services-new-foundation-for-computing/'
    },
    {
      label: 'AI Governance',
      headline: 'Trump signs executive order aiming to limit state AI regulations',
      summary:
        'President Donald Trump signed an executive order directing federal agencies to challenge certain state AI laws and reduce a patchwork of state regulation.',
      impact:
        'Credit unions operating across multiple states may need to adjust AI governance and vendor oversight as the federal and state regulatory environment shifts.',
      sourceName: 'AP News',
      sourceUrl: 'https://apnews.com/article/9cb4dd1bc249e404260b3dc233217388',
      date: 'Dec 16, 2025',
      slug: 'trump-executive-order-ai-regulation',
      link: 'https://apnews.com/article/9cb4dd1bc249e404260b3dc233217388'
    },
    {
      label: 'Lending',
      headline: 'Banks face pressure from fintechs and agentic AI as credit products evolve',
      summary:
        'PYMNTS reports growing pressure on banks from fintechs and new agentic AI capabilities as consumers expect flexible credit delivered in real time.',
      impact:
        'Credit unions should watch how agentic AI changes underwriting, repayment flexibility, and servicing expectations, and stress test risk controls before adopting similar models.',
      sourceName: 'PYMNTS',
      sourceUrl: 'https://www.pymnts.com/news/payment-methods/2025/credit-is-being-rewritten-and-banks-are-running-out-of-time-says-thredd-ceo/',
      date: 'Dec 17, 2025',
      slug: 'agentic-ai-credit-product-pressure',
      link: 'https://www.pymnts.com/news/payment-methods/2025/credit-is-being-rewritten-and-banks-are-running-out-of-time-says-thredd-ceo/'
    },
    {
      label: 'Member Experience',
      headline: 'Member Loyalty Group launches AI tool to help credit unions respond to member feedback faster',
      summary:
        'Member Loyalty Group announced an AI powered feature that helps credit unions generate faster, more consistent replies to member feedback.',
      impact:
        'This is a practical near term automation use case for member experience teams, but it should be paired with clear tone guidelines, approvals, and auditability.',
      sourceName: 'Business Wire',
      sourceUrl:
        'https://www.businesswire.com/news/home/20251216488272/en/Member-Loyalty-Group-Introduces-AI-Powered-Solution-to-Help-Credit-Unions-Close-the-Feedback-Loop-Faster-More-Effectively',
      date: 'Dec 16, 2025',
      slug: 'member-loyalty-group-ai-feedback-tool',
      link:
        'https://www.businesswire.com/news/home/20251216488272/en/Member-Loyalty-Group-Introduces-AI-Powered-Solution-to-Help-Credit-Unions-Close-the-Feedback-Loop-Faster-More-Effectively'
    },
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

  const parseAlertDate = (entry) => {
    const raw = entry?.date || entry?.published || entry?.timestamp || '';
    if (!raw) return null;

    const normalized = typeof raw === 'string' ? raw.trim() : raw;
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) return parsed;

    if (typeof normalized === 'string') {
      const fallback = new Date(normalized.replace(/-/g, '/'));
      if (!Number.isNaN(fallback.getTime())) return fallback;
    }

    return null;
  };

  const getRecentAlerts = (alerts, days = 14) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const seenUrls = new Set();
    const seenHeadlines = new Set();

    return alerts
      .map((alert) => ({ ...alert, parsedDate: parseAlertDate(alert) }))
      .filter(({ parsedDate }) => parsedDate && parsedDate.getTime() >= cutoff.getTime())
      .sort((a, b) => b.parsedDate - a.parsedDate)
      .filter((alert) => {
        const urlKey = alert.sourceUrl?.trim().toLowerCase();
        const headlineKey = alert.headline?.trim().toLowerCase();
        const isDuplicate = (urlKey && seenUrls.has(urlKey)) || (headlineKey && seenHeadlines.has(headlineKey));

        if (isDuplicate) return false;

        if (urlKey) seenUrls.add(urlKey);
        if (headlineKey) seenHeadlines.add(headlineKey);
        return true;
      })
      .map(({ parsedDate, ...rest }) => rest);
  };

  // Prepare alerts once for all consumers: freshest-first, deduped, and within a 14-day window
  const preparedAlerts = getRecentAlerts(alertsData);

  const normalizePath = (path) => path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';

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
      alertsLink.addEventListener('click', () => navLinks.classList.remove('open'));
      const firstNav = navLinks.querySelector('a');
      if (firstNav) {
        firstNav.insertAdjacentElement('afterend', alertsLink);
      } else {
        navLinks.appendChild(alertsLink);
      }
    }

    const sponsorshipAnchors = Array.from(navLinks.querySelectorAll('a')).filter((link) => {
      const href = link.getAttribute('href') || '';
      const normalizedHref = normalizePath(new URL(href, window.location.href).pathname);
      return normalizedHref === '/sponsorships';
    });

    if (!sponsorshipAnchors.length) {
      const sponsorAnchor = document.createElement('a');
      sponsorAnchor.href = '/sponsorships/';
      sponsorAnchor.textContent = 'Sponsorships';
      sponsorAnchor.addEventListener('click', () => navLinks.classList.remove('open'));
      const aboutLink = navLinks.querySelector('a[href*="about"]');
      if (aboutLink) {
        aboutLink.insertAdjacentElement('beforebegin', sponsorAnchor);
      } else {
        navLinks.appendChild(sponsorAnchor);
      }
    } else if (sponsorshipAnchors.length > 1) {
      sponsorshipAnchors.slice(1).forEach((duplicate) => duplicate.remove());
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

  document.querySelectorAll('.footer .footer-links').forEach((links) => {
    if (!links) return;

    const sponsorshipLink = links.querySelector(
      'a[href$="/sponsorships/"], a[href$="sponsorships.html"], a[href$="/sponsorships"]'
    );

    if (sponsorshipLink) return;

    const sponsorAnchor = document.createElement('a');
    sponsorAnchor.href = '/sponsorships/';
    sponsorAnchor.textContent = 'Sponsorships';

    const aboutLink = links.querySelector('a[href*="about"]');
    if (aboutLink) {
      aboutLink.insertAdjacentElement('beforebegin', sponsorAnchor);
    } else {
      links.appendChild(sponsorAnchor);
    }
  });

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

      const subject = 'Subscribe to Weekly AI Briefing';
      const bodyLines = ['Please add me to the CreditUnionAI News Weekly AI Briefing list.'];

      const mailtoHref = `mailto:info@creditunionainews.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        bodyLines.join('\n')
      )}`;

      window.location.href = mailtoHref;

      newsletterForm.reset();
    });
  }

  const sponsorshipForm = document.querySelector('#sponsorship-form');

  if (sponsorshipForm) {
    sponsorshipForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(sponsorshipForm);
      const name = (formData.get('name') || '').toString().trim();
      const organization = (formData.get('organization') || '').toString().trim();
      const role = (formData.get('role') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const interest = (formData.get('interest') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();

      const bodyLines = [
        'Sponsorship inquiry for CreditUnionAI News',
        name ? `Name: ${name}` : '',
        organization ? `Organization: ${organization}` : '',
        role ? `Role: ${role}` : '',
        email ? `Email: ${email}` : '',
        interest ? `Partnership interest: ${interest}` : '',
        message ? `Message / goals: ${message}` : ''
      ].filter(Boolean);

      const mailtoHref = `mailto:info@creditunionainews.com?subject=${encodeURIComponent(
        'Sponsorship inquiry'
      )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      window.location.href = mailtoHref;
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
    if (!alertsList) return;

    if (!preparedAlerts.length) {
      alertsList.innerHTML = `
        <article class="card alert-card" aria-live="polite">
          <div class="alert-content">
            <h3>No alerts in the last 14 days. Check back soon.</h3>
          </div>
        </article>
      `;
      return;
    }

    alertsList.innerHTML = preparedAlerts
      .map(
        (item) => `
          <article class="card alert-card" id="${item.slug}">
            <div class="meta"><span class="tag">${item.label}</span><span class="tag tag-secondary">Alert</span></div>
            <div class="alert-content">
              <h3>${item.headline}</h3>
              <p class="alert-summary">${item.summary}</p>
              <p class="alert-impact"><span class="muted-label">Credit union impact:</span> ${item.impact || ''}</p>
              <p class="alert-meta"><span class="alert-date">${item.date || ''}</span> · <span class="alert-source"><span class="muted-label">Source:</span> <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${item.sourceName}</a></span></p>
            </div>
          </article>
        `
      )
      .join('');
  };

  renderAlerts();
})();
