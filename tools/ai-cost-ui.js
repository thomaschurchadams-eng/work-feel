'use strict';
(function(){
const $=id=>document.getElementById(id),prices=window.AIPricePresets;
if(!$('ai-cost-form'))return;
const usd=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const n=id=>$(id).value.trim()===''?NaN:Number($(id).value);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function options(select,items,label){for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=label(item);select.append(option);}}
options($('ai-subscription'),prices.subscriptions,p=>p.provider==='None'?p.name:p.provider+' · '+p.name);
options($('ai-model'),prices.models,p=>p.name);
$('ai-subscription').value='chatgpt-plus';$('ai-model').value='gpt-6-luna';
function subscription(){return prices.subscriptions.find(p=>p.id===$('ai-subscription').value);}
function model(){return prices.models.find(p=>p.id===$('ai-model').value);}
function loadSubscription(){const p=subscription(),rate=p[$('ai-billing').value];$('ai-seat-price').value=rate===null?'':String(rate);sourceLabels();}
function loadModel(){const p=model();for(const [id,key]of [['ai-input-rate','input'],['ai-output-rate','output'],['ai-cached-rate','cached']])$(id).value=p[key]===null?'':String(p[key]);sourceLabels();}
function sourceLabels(){
 const p=subscription(),m=model(),billing=$('ai-billing').value;
 $('seat-price-label').textContent=billing==='annual'?'USD per paid user per year, paid upfront':'USD per paid user per month';
 const subOverride=p[billing]===null||n('ai-seat-price')!==p[billing];
 $('subscription-source').innerHTML=(p.source?`<a href="${p.source}" target="_blank" rel="noopener">Official ${esc(p.provider)} price source ↗</a> · Verified ${prices.verified}. `:'Manual quote; verify your source and terms. ')+(p[billing]===null?'No published '+billing+' price in this preset; enter your quote or change billing. ':'')+(subOverride?'Current rate is a manual override. ':'')+(p.minSeats?`Published minimum ${p.minSeats} paid users across the plan${p.maxSeats?`; maximum ${p.maxSeats}`:''}. This simple worksheet models one tier; use a custom quote for a mixed-tier or incremental add-on arrangement. `:'')+(billing==='annual'?'A full year is paid at the start and each 12-month renewal; no prorated refund is assumed.':'');
 const apiOverride=[['ai-input-rate','input'],['ai-output-rate','output'],['ai-cached-rate','cached']].some(([id,key])=>m[key]===null||n(id)!==m[key]);
 $('api-source').innerHTML=(m.source?`<a href="${m.source}" target="_blank" rel="noopener">Official API price source ↗</a> · Verified ${prices.verified}. `:'Manual rates; verify your source and billing units. ')+esc(m.condition||'')+(apiOverride?' Current rates include a manual override.':'');
}
function read(){
 const mode=$('ai-payment').value,hasSub=mode!=='api',hasApi=mode!=='subscription',p=subscription(),m=model();
 const seats=hasSub&&p.id!=='none'?n('ai-seats'):0;
 if(hasSub&&seats>0&&p.minSeats&&seats<p.minSeats)throw Error(`This ${p.provider} preset needs at least ${p.minSeats} paid users. Choose a custom quote for an existing mixed-tier plan or an incremental add-on.`);
 if(hasSub&&p.maxSeats&&seats>p.maxSeats)throw Error(`This ${p.provider} preset supports at most ${p.maxSeats} paid users; use a custom quote.`);
 const requestMode=$('ai-usage-mode').value;
 if(hasApi&&m.id==='claude-haiku-5-5-short'&&requestMode==='requests'&&n('ai-average-input')>100000)throw Error('Choose the long-input Haiku preset or custom rates for inputs above 100,000 tokens per request.');
 if(hasApi&&m.id==='claude-haiku-5-5-long'&&requestMode==='requests'&&n('ai-requests')>0&&n('ai-average-input')<=100000)throw Error('The long-input Haiku preset requires more than 100,000 input tokens per request; choose the short-input preset for smaller requests.');
 const estimate=AICosts.estimate({seats,seatPrice:hasSub?n('ai-seat-price'):0,billing:$('ai-billing').value,existing:hasSub&&$('ai-existing').checked,basis:$('ai-basis').value,usageMode:requestMode,requests:hasApi?n('ai-requests'):0,averageInput:hasApi?n('ai-average-input'):0,averageOutput:hasApi?n('ai-average-output'):0,cachedPercent:hasApi?n('ai-cache-percent'):0,inputTokens:hasApi?n('ai-input-tokens'):0,outputTokens:hasApi?n('ai-output-tokens'):0,cachedTokens:hasApi?n('ai-cached-tokens'):0,inputRate:hasApi?n('ai-input-rate'):0,outputRate:hasApi?n('ai-output-rate'):0,cachedRate:hasApi?($('ai-cached-rate').value.trim()===''?null:n('ai-cached-rate')):0,apiExtrasMonthly:hasApi?n('ai-extra-fees'):0,otherMonthly:n('ai-other-monthly')});
 return {...estimate,subscriptionName:hasSub&&p.id!=='none'?p.provider+' '+p.name:'No subscription',apiName:hasApi?m.name:'No API usage',seats};
}
function refresh(){
 $('subscription-section').hidden=$('ai-payment').value==='api';$('api-section').hidden=$('ai-payment').value==='subscription';
 $('request-fields').hidden=$('ai-usage-mode').value!=='requests';$('token-fields').hidden=$('ai-usage-mode').value!=='tokens';
 sourceLabels();$('ai-cost-error').textContent='';
 try{const c=read();$('ai-cost-summary').innerHTML=`<div><span>Monthly subscription</span><strong>${usd(c.subscriptionMonthly)}</strong></div><div><span>Annual subscription · paid upfront</span><strong>${usd(c.annualPrepaid)}</strong></div><div><span>API before credits / month · includes ${usd(c.apiExtrasMonthly)} extra fees</span><strong>${usd(c.apiMonthly)}</strong></div><div><span>Other cash costs / month</span><strong>${usd(c.otherMonthly)}</strong></div><div class="cost-total"><span>Recurring cash / month</span><strong>${usd(c.monthlyRecurring)}</strong></div><p class="help">${c.annualPrepaid?`Annual subscription adds ${usd(c.annualPrepaid)} upfront and at each 12-month renewal. Total monthly equivalent ${usd(c.monthlyEquivalent)} is for comparison only; it is not the payment schedule. `:''}${c.excludedExisting?'Existing paid subscriptions excluded from incremental costs. ':''}${c.basis==='full'?'Full-cost comparison includes existing paid users as if purchased for this pilot; it is not a forecast of new cash spending. ':''}Subscription and API amounts are counted once each. Cached reads replace the corresponding uncached input charge.</p>`;return c;}catch(error){$('ai-cost-summary').textContent='Complete the AI cost assumptions to see a valid estimate.';$('ai-cost-error').textContent=error.message;return null;}
}
$('ai-subscription').addEventListener('change',()=>{loadSubscription();refresh();});$('ai-billing').addEventListener('change',()=>{loadSubscription();refresh();});$('ai-model').addEventListener('change',()=>{loadModel();refresh();});
$('ai-size').addEventListener('change',()=>{const sizes={short:[250,150],document:[2000,500],long:[10000,1000]},v=sizes[$('ai-size').value];$('ai-average-input').value=v[0];$('ai-average-output').value=v[1];refresh();});
$('ai-cost-form').addEventListener('input',refresh);$('ai-cost-form').addEventListener('change',refresh);$('ai-cost-form').addEventListener('submit',e=>e.preventDefault());
loadSubscription();loadModel();refresh();window.AICostUI={read,refresh};
})();
