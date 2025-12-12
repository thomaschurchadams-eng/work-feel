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

  class AlertsStore {
    constructor(initialAlerts = [], limit = 8) {
      this.alerts = Array.isArray(initialAlerts) ? initialAlerts : [];
      this.limit = limit;
      this.listeners = [];
    }

    setAlerts(alerts) {
      this.alerts = Array.isArray(alerts) ? alerts : [];
      this.notify();
    }

    addAlert(alert) {
      this.alerts = [alert, ...this.alerts];
      this.notify();
    }

    getLatest() {
      return [...this.alerts]
        .filter((alert) => alert && alert.publishedAt)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, this.limit);
    }

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.push(listener);
      listener(this.getLatest());
      return () => {
        this.listeners = this.listeners.filter((fn) => fn !== listener);
      };
    }

    notify() {
      const snapshot = this.getLatest();
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }

  class AlertsTicker {
    constructor(container, store) {
      this.container = container;
      this.store = store;
      this.track = document.createElement('div');
      this.track.className = 'alerts-track';
      this.marquee = document.createElement('div');
      this.marquee.className = 'alerts-marquee';
      this.marquee.appendChild(this.track);
      this.container.innerHTML = '';
      this.container.appendChild(this.marquee);

      this.unsubscribe = this.store.subscribe((alerts) => this.render(alerts));
      this.bindPauseHandlers();
      this.handleResize = () => this.setAnimationDuration();
      window.addEventListener('resize', this.handleResize);
    }

    bindPauseHandlers() {
      const pause = () => this.track.classList.add('paused');
      const resume = () => this.track.classList.remove('paused');
      this.marquee.addEventListener('mouseenter', pause);
      this.marquee.addEventListener('mouseleave', resume);
      this.marquee.addEventListener('focusin', pause);
      this.marquee.addEventListener('focusout', resume);
    }

    formatPublished(dateValue) {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    buildItem(alert) {
      const link = document.createElement('a');
      link.className = 'ticker-item';
      link.href = alert.url || alert.slug || '#';
      link.setAttribute('role', 'listitem');
      link.setAttribute('tabindex', '0');

      const published = document.createElement('span');
      published.className = 'ticker-date';
      published.textContent = this.formatPublished(alert.publishedAt);

      const headline = document.createElement('span');
      headline.className = 'ticker-headline';
      headline.textContent = alert.headline || alert.text || '';

      const arrow = document.createElement('span');
      arrow.className = 'ticker-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      link.appendChild(published);
      link.appendChild(headline);
      link.appendChild(arrow);

      return link;
    }

    setAnimationDuration() {
      const baseWidth = this.track.scrollWidth / 24;
      const viewportFactor = window.innerWidth < 640 ? 1.4 : 1;
      const durationSeconds = Math.max(18, Math.min(42, baseWidth * viewportFactor));
      this.track.style.animationDuration = `${durationSeconds}s`;
    }

    render(alerts) {
      if (!this.track || !Array.isArray(alerts) || !alerts.length) {
        this.track.innerHTML = '';
        return;
      }

      const items = alerts.map((alert) => this.buildItem(alert));
      const clones = items.map((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        clone.classList.add('ticker-duplicate');
        return clone;
      });
      const loopItems = [...items, ...clones];

      this.track.innerHTML = '';
      loopItems.forEach((item) => this.track.appendChild(item));

      requestAnimationFrame(() => this.setAnimationDuration());
    }
  }

  const alertsTickerEl = document.querySelector('#alerts-ticker');
  const alertsStore = new AlertsStore(window.CUAI_ALERTS || [], 10);
  window.CUAIAlertsStore = alertsStore;
  window.refreshAlertsTicker = (alerts) => alertsStore.setAlerts(alerts);
  window.pushAlertToTicker = (alert) => alertsStore.addAlert(alert);

  if (alertsTickerEl) {
    new AlertsTicker(alertsTickerEl, alertsStore);
  }

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
