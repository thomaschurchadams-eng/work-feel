(function(root){
'use strict';
function number(value,name,max=1e12){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error(`Enter ${name} between 0 and ${max}.`);return value;}
function estimate(a){
 const seats=number(a.seats,'number of paid users',1000000);
 if(!Number.isInteger(seats))throw Error('Number of paid users must be a whole number.');
 const seatPrice=number(a.seatPrice,'price per paid user');
 if(!['monthly','annual'].includes(a.billing))throw Error('Choose monthly or annual subscription billing.');
 if(!['incremental','full'].includes(a.basis))throw Error('Choose the cost basis.');
 const includeSubscription=!(a.existing&&a.basis==='incremental');
 let input,output,cached;
 if(a.usageMode==='requests'){
  const requests=number(a.requests,'requests per month',1e9);
  input=requests*number(a.averageInput,'average input tokens per request',1e8);
  output=requests*number(a.averageOutput,'average output tokens per request',1e8);
  cached=input*number(a.cachedPercent,'cached input percentage',100)/100;
 }else if(a.usageMode==='tokens'){
  input=number(a.inputTokens,'monthly total input tokens');
  output=number(a.outputTokens,'monthly output tokens');
  cached=number(a.cachedTokens,'monthly cached input tokens');
 }else throw Error('Choose requests or monthly token totals.');
 if(cached>input)throw Error('Cached input is part of total input; it cannot exceed total input tokens.');
 const inputRate=number(a.inputRate,'input price per million tokens');
 const outputRate=number(a.outputRate,'output price per million tokens');
 const cachedRate=a.cachedRate===null?null:number(a.cachedRate,'cached-input price per million tokens');
 if(cached>0&&cachedRate===null)throw Error('This preset has no cached-input price. Set cached input to zero or enter a documented custom cached-input rate.');
 const inputCost=(input-cached)/1e6*inputRate;
 const outputCost=output/1e6*outputRate;
 const cachedCost=cached?cached/1e6*cachedRate:0;
 const apiExtrasMonthly=number(a.apiExtrasMonthly===undefined?0:a.apiExtrasMonthly,'additional API fees');
 const apiMonthly=inputCost+outputCost+cachedCost+apiExtrasMonthly;
 const subscriptionMonthly=includeSubscription&&a.billing==='monthly'?seats*seatPrice:0;
 const annualPrepaid=includeSubscription&&a.billing==='annual'?seats*seatPrice:0;
 const otherMonthly=number(a.otherMonthly,'other recurring cash costs');
 const monthlyRecurring=subscriptionMonthly+apiMonthly+otherMonthly;
 if(!Number.isFinite(monthlyRecurring)||monthlyRecurring>10000000||annualPrepaid>100000000)throw Error('AI costs exceed this calculator’s supported range.');
 return {input,output,cached,inputCost,outputCost,cachedCost,apiExtrasMonthly,apiMonthly,subscriptionMonthly,annualPrepaid,otherMonthly,monthlyRecurring,monthlyEquivalent:monthlyRecurring+annualPrepaid/12,excludedExisting:a.existing&&!includeSubscription,basis:a.basis};
}
const api={estimate};if(typeof module!=='undefined')module.exports=api;else root.AICosts=api;
})(typeof window!=='undefined'?window:globalThis);
