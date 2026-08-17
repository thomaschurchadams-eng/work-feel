(function () {
  const script = document.createElement('script');
  script.src = '/assets/app.js';
  script.async = false;
  script.dataset.cuaiCompatibilityLoader = 'site-js-to-app-js';
  document.head.appendChild(script);
})();
