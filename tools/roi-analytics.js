(function (root) {
  'use strict';
  const destination = Object.freeze({property: '520110560', stream: '13305759774', measurement: 'G-RF6EFK06G5'});
  const names = Object.freeze({view: 'roi_view', start: 'roi_start', complete: 'roi_calculation_complete', feedback: 'roi_feedback_click'});
  const canonical = 'https://creditunionainews.com/tools/roi.html';
  function create({mode = 'dry-run', hostname = '', pathname = '', internal = true, consent = () => false, send, property = destination.property, measurement = destination.measurement} = {}) {
    if (property !== destination.property || measurement !== destination.measurement) throw Error('CUAI ROI destination mismatch.');
    const allowed = ['creditunionainews.com', 'www.creditunionainews.com'].includes(hostname) && pathname === '/tools/roi.html';
    const dry = mode !== 'live' || !allowed || internal;
    const records = [], pending = [], seen = new Set();
    function flush() {
      if (dry || !consent() || typeof send !== 'function') return;
      while (pending.length) {
        const record = pending[0];
        if (record.state === 'tag-error') return; // Outcome may be unknown; do not duplicate.
        try { send('event', record.name, {...record.params}); record.state = 'handed-to-tag'; pending.shift(); }
        catch { record.state = 'tag-error'; return; }
      }
    }
    function record(kind) {
      if (!names[kind] || seen.has(kind)) return false;
      // Never accept an arbitrary parameter object or read any form value.
      seen.add(kind);
      const item = {name: names[kind], property: destination.property, state: dry ? 'dry-run' : 'consent-pending', params: {
        send_to: destination.measurement, tool: 'roi', measurement_version: 'roi-v1',
        page_location: canonical, page_referrer: '', page_title: 'Free AI Pilot ROI Calculator',
        ...(dry ? {debug_mode: true, traffic_type: 'internal'} : {})
      }};
      records.push(item); if (!dry) pending.push(item); flush(); return true;
    }
    return Object.freeze({record, flush, snapshot: () => JSON.parse(JSON.stringify(records)), destination, dryRun: dry});
  }
  const api = {create, destination, names};
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined' || !document.body.classList.contains('standalone-roi')) return;
  const body = document.body;
  let boundary=null,consentState='unknown';
  // Existing CUAI uses gtag; no consent manager/bridge was found in this checkout.
  // Keep production activation gated until the existing site's consent and
  // enhanced-measurement behavior have been reviewed. This file never loads a tag.
  const tracker = create({mode: body.dataset.roiAnalytics || 'dry-run', hostname: location.hostname, pathname: location.pathname,
    internal: body.dataset.roiInternal !== 'false' || navigator.webdriver === true,
    consent: () => body.dataset.roiConsentReviewed === 'true' && boundary?.granted() === true && typeof root.gtag === 'function',
    send: (...args) => { if (typeof root.gtag !== 'function') throw Error('Existing CUAI tag unavailable.'); root.gtag(...args); }
  });
  function synchronizeConsent() {
    if(tracker.dryRun||body.dataset.roiConsentReviewed!=='true'||typeof root.gtag!=='function'||!root.CUAIROIPrivacy)return;
    const choice=root.CUAIAnalyticsConsent?.analyticsStorage;
    const next=['granted','denied'].includes(choice)?choice:'unknown';
    // Basic consent: no tag interaction before a grant. Withdrawal updates an
    // already-active tag and prevents subsequent custom dispatches.
    if(next==='granted'||boundary?.granted()){
      if(!boundary)boundary=root.CUAIROIPrivacy.createBoundary((...args)=>root.gtag(...args));
      if(next!==consentState){boundary.update(next);consentState=next;}
    }
  }
  synchronizeConsent();
  root.CUAIROIAnalytics = Object.freeze({snapshot: tracker.snapshot, destination, dryRun: tracker.dryRun});
  const view = () => { if (document.visibilityState === 'visible') tracker.record('view'); };
  view(); document.addEventListener('visibilitychange', view);
  const start = event => { if (event.target.matches('#scenario, #roi-form input, #ai-cost-form input, #ai-cost-form select')) {tracker.record('view'); tracker.record('start');} };
  document.addEventListener('input', start); document.addEventListener('change', start);
  document.addEventListener('cuai:roi-calculated', () => { tracker.record('view'); tracker.record('start'); tracker.record('complete'); });
  document.querySelector('.roi-feedback')?.addEventListener('toggle', event => { if (event.target.open) tracker.record('feedback'); });
  document.addEventListener('cuai:analytics-consent', () => {synchronizeConsent();tracker.flush();});
})(typeof window !== 'undefined' ? window : globalThis);
