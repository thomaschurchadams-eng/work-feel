// Reuse the existing CUAI tag only on its production host. No private/test page views.
(function (root) {
  'use strict';
  const measurement = 'G-RF6EFK06G5';
  let internal = root.navigator.webdriver === true || root.CUAIInternalTraffic === true;
  try { internal ||= root.localStorage.getItem('cuai_internal_traffic') === 'true'; } catch { /* other guards remain */ }
  if (internal || !['creditunionainews.com', 'www.creditunionainews.com'].includes(root.location.hostname)) return;
  root.dataLayer = root.dataLayer || [];
  root.gtag = root.gtag || function () { root.dataLayer.push(arguments); };
  root.gtag('js', new Date());
  root.gtag('config', measurement);
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurement;
  document.head.appendChild(script);
})(window);
