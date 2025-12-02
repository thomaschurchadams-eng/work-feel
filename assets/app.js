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
  if (newsletterForm) {
    const newsletterEmail = 'subscribe@creditunionai.news';

    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector('#email')?.value?.trim() || '';
      const firstName = newsletterForm.querySelector('#firstName')?.value?.trim() || '';
      const status = newsletterForm.querySelector('.status');

      const subject = encodeURIComponent('Subscribe to the Weekly AI Briefing');
      const bodyLines = [
        'Please subscribe me to the Weekly AI Briefing.',
        `Email: ${email || 'N/A'}`,
        firstName ? `First name: ${firstName}` : 'First name: (not provided)'
      ];
      const mailtoLink = `mailto:${newsletterEmail}?subject=${subject}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      if (status) {
        status.textContent = 'Opening your email client to finish your subscription…';
        status.style.display = 'block';
      }

      window.location.href = mailtoLink;
      newsletterForm.reset();
    });
  }
})();
