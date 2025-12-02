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

  const newsletterForm = document.querySelector('#newsletter-form');
  const signupEntriesContainer = document.querySelector('#signup-entries');
  const exportSignupsBtn = document.querySelector('#export-signups');
  const clearSignupsBtn = document.querySelector('#clear-signups');
  let signupDbPromise;

  const getSignupDb = () => {
    if (signupDbPromise) return signupDbPromise;

    signupDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('creditunionai-signups', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('signups')) {
          db.createObjectStore('signups', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return signupDbPromise;
  };

  const loadNewsletterSignups = async () => {
    try {
      const db = await getSignupDb();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('signups', 'readonly');
        const store = transaction.objectStore('signups');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Unable to read newsletter signups', err);
      return [];
    }
  };

  const saveNewsletterSignup = async (entry) => {
    try {
      const db = await getSignupDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('signups', 'readwrite');
        const store = transaction.objectStore('signups');
        const request = store.add(entry);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Unable to save newsletter signup', err);
    }
  };

  const clearNewsletterSignups = async () => {
    try {
      const db = await getSignupDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('signups', 'readwrite');
        const store = transaction.objectStore('signups');
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Unable to clear newsletter signups', err);
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

  const renderSignupEntries = async () => {
    if (!signupEntriesContainer) return;
    const entries = (await loadNewsletterSignups()).sort((a, b) => {
      const aDate = new Date(a.isoTimestamp || a.timestamp || 0);
      const bDate = new Date(b.isoTimestamp || b.timestamp || 0);
      return bDate - aDate;
    });

    if (!entries.length) {
      signupEntriesContainer.innerHTML = '<p class="muted-text">No signups captured on this device yet.</p>';
      return;
    }

    signupEntriesContainer.innerHTML = entries
      .map((entry) => {
        const namePart = entry.firstName ? ` · ${entry.firstName}` : '';
        return `
          <div class="signup-entry">
            <div><strong>${entry.email}</strong>${namePart}</div>
            <div class="signup-entry-date">${entry.timestamp}</div>
          </div>
        `;
      })
      .join('');
  };

  if (newsletterForm) {
    renderSignupEntries();

    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      const now = new Date();
      await saveNewsletterSignup({
        email,
        firstName,
        timestamp: formatTimestamp(now),
        isoTimestamp: now.toISOString()
      });
      await renderSignupEntries();

      if (status) {
        status.textContent = 'Saved to your signup log. We will follow up soon.';
        status.style.display = 'block';
      }

      newsletterForm.reset();
    });
  }

  if (exportSignupsBtn) {
    exportSignupsBtn.addEventListener('click', async () => {
      const entries = await loadNewsletterSignups();
      if (!entries.length) return;
      const header = 'Email,First Name,Timestamp\n';
      const rows = entries
        .map((entry) => `${entry.email},${entry.firstName || ''},${entry.timestamp}`)
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
      await clearNewsletterSignups();
      await renderSignupEntries();
    });
  }
})();
