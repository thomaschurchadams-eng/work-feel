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

  const current = window.location.pathname.split('/').pop() || 'index.html';
  const activeTarget = current === '' ? 'index.html' : current;
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === activeTarget || (activeTarget === 'index.html' && href === './')) {
      link.classList.add('active');
    }
  });

  const alertsTicker = document.querySelector('#alerts-ticker');

  const alertsData = [
    {
      category: 'NCUA',
      text: 'Supervisory letter draft signals AI model transparency and third-party oversight expectations.',
      href: '/news.html#article-ncua-ai-opportunities-risks'
    },
    {
      category: 'Fraud',
      text: 'Credit unions widen pilots of ML-powered fraud defenses as card and account-takeover attacks rise.',
      href: '/news.html#article-ai-fraud-tools'
    },
    {
      category: 'Member Experience',
      text: 'Frontline teams trial AI chat to boost member self-service while preserving human handoffs.',
      href: '/news.html#article-ai-chat-virtual-assistants'
    }
  ];

  const createTickerItem = (alert) => {
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.setAttribute('role', 'listitem');

    const category = document.createElement('span');
    category.className = 'ticker-category';
    category.textContent = alert.category;

    const body = document.createElement('span');
    body.textContent = alert.text;

    item.appendChild(category);
    item.appendChild(body);

    if (alert.href) {
      const link = document.createElement('a');
      link.className = 'link';
      link.href = alert.href;
      link.textContent = 'View update →';
      item.appendChild(link);
    }

    return item;
  };

  const renderAlertsTicker = () => {
    if (!alertsTicker || !alertsData.length) return;
    const fragment = document.createDocumentFragment();
    alertsData.forEach((alert) => fragment.appendChild(createTickerItem(alert)));
    alertsTicker.innerHTML = '';
    alertsTicker.appendChild(fragment);
  };

  const startAlertsAutoScroll = () => {
    if (!alertsTicker) return;
    const items = Array.from(alertsTicker.querySelectorAll('.ticker-item'));
    if (items.length <= 1) return;

    const scrollToItem = (index) => {
      const target = items[index];
      if (!target) return;
      alertsTicker.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    };

    let activeIndex = 0;
    let tickerTimer = setInterval(() => {
      activeIndex = (activeIndex + 1) % items.length;
      scrollToItem(activeIndex);
    }, 4500);

    const pauseTicker = () => {
      if (tickerTimer) {
        clearInterval(tickerTimer);
        tickerTimer = null;
      }
    };

    const resumeTicker = () => {
      if (tickerTimer) return;
      tickerTimer = setInterval(() => {
        activeIndex = (activeIndex + 1) % items.length;
        scrollToItem(activeIndex);
      }, 4500);
    };

    alertsTicker.addEventListener('mouseenter', pauseTicker);
    alertsTicker.addEventListener('mouseleave', resumeTicker);
    alertsTicker.addEventListener('focusin', pauseTicker);
    alertsTicker.addEventListener('focusout', resumeTicker);
  };

  renderAlertsTicker();
  startAlertsAutoScroll();

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
})();
