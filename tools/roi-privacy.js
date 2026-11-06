(function (root) {
  'use strict';
  const canonical = 'https://creditunionainews.com/tools/roi.html';
  const measurement = 'G-RF6EFK06G5';
  const denied = Object.freeze({analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  const metadata = Object.freeze({page_location:canonical,page_referrer:'',page_title:'Free AI Pilot ROI Calculator',send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  function cleanLocation(value) {
    const url=new URL(value);if(url.pathname!=='/tools/roi.html')return null;
    const hash=['','#main-content','#roi-panel','#roi-title','#ai-cost-title'].includes(url.hash)?url.hash:'';
    return url.pathname+hash; // No incoming search, campaign, email or arbitrary fragment.
  }
  // Reviewable basic-consent integration contract. The caller supplies the
  // already-approved tag; this module never loads a third-party script.
  function createBoundary(tag) {
    let state='unknown',defaults=false;
    return Object.freeze({
      update(choice) {
        if(!['granted','denied','unknown'].includes(choice))throw Error('Unknown analytics choice.');
        if(typeof tag!=='function')return false;
        if(!defaults){tag('consent','default',{...denied});defaults=true;}
        if(choice==='granted'){
          tag('set',{...metadata});
          tag('consent','update',{...denied,analytics_storage:'granted'});
          tag('config',measurement,{...metadata});
        }else tag('consent','update',{...denied});
        state=choice;return true;
      },
      granted:()=>state==='granted'
    });
  }
  const api={cleanLocation,createBoundary,metadata};
  if(typeof module!=='undefined')module.exports=api;
  root.CUAIROIPrivacy=api;
  if(typeof document==='undefined'||root.location.pathname!=='/tools/roi.html')return;
  const clean=cleanLocation(root.location.href);
  if(root.location.pathname+root.location.search+root.location.hash!==clean)root.history.replaceState(null,'',clean);
})(typeof window!=='undefined'?window:globalThis);
