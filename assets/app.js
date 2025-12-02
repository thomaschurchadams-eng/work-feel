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

  const loadNewsletterSignups = () => {
    try {
      return JSON.parse(localStorage.getItem('newsletterSignups')) || [];
    } catch (err) {
      console.error('Unable to read newsletter signups', err);
      return [];
    }
  };

  const saveNewsletterSignups = (entries) => {
    try {
      localStorage.setItem('newsletterSignups', JSON.stringify(entries));
    } catch (err) {
      console.error('Unable to save newsletter signups', err);
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

  const renderSignupEntries = () => {
    if (!signupEntriesContainer) return;
    const entries = loadNewsletterSignups();

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

    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      const entries = loadNewsletterSignups();
      const now = new Date();
      entries.unshift({
        email,
        firstName,
        timestamp: formatTimestamp(now)
      });
      saveNewsletterSignups(entries);
      renderSignupEntries();

      if (status) {
        status.textContent = 'Saved to your signup log. We will follow up soon.';
        status.style.display = 'block';
      }

      newsletterForm.reset();
    });
  }
})();
