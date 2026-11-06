(function(root){
'use strict';
const limits={volume:10000000,minutes:1440,wage:10000,software:10000000,implementation:100000000,review:1000000,months:120,conservative:100,base:100,upside:100,cash:100};
function calculate(a){
 for(const [k,max] of Object.entries(limits)) if(typeof a[k]!=='number'||!Number.isFinite(a[k])||a[k]<0||a[k]>max) throw Error(`Enter ${k} between 0 and ${max}.`);
 if(!Number.isInteger(a.months)||a.months<1) throw Error('Pilot duration must be a whole number from 1 to 120 months.');
 const annualPrepaid=a.annualPrepaid===undefined?0:a.annualPrepaid;
 if(typeof annualPrepaid!=='number'||!Number.isFinite(annualPrepaid)||annualPrepaid<0||annualPrepaid>100000000)throw Error('Annual prepaid subscription cost must be between 0 and 100000000.');
 if(a.conservative>a.base||a.base>a.upside) throw Error('Time reduction must increase from conservative to base to upside.');
 return ['conservative','base','upside'].map(name=>{
 const grossHours=a.volume*a.minutes/60*a[name]/100;
 const netHours=grossHours-a.review;
 const capacityValue=netHours*a.wage;
 const cashSavings=Math.max(0,netHours)*a.wage*a.cash/100;
 const recurring=a.software; // Review labor already deducted from capacity; never charge twice.
 const annualPayments=Math.ceil(a.months/12);
 const totalCost=recurring*a.months+a.implementation+annualPrepaid*annualPayments;
 const netCash=cashSavings*a.months-totalCost;
 const monthlyContribution=cashSavings-recurring;
 let payback=null;
 if(monthlyContribution>0){
  const firstOutlay=a.implementation+annualPrepaid;
  if(!annualPrepaid||firstOutlay/monthlyContribution<=12)payback=firstOutlay/monthlyContribution;
  else {
   const annualGain=monthlyContribution*12-annualPrepaid;
   if(annualGain>0){
    const years=Math.ceil((firstOutlay-monthlyContribution*12)/annualGain);
    payback=years*12+(firstOutlay-years*annualGain)/monthlyContribution;
   }
  }
 }
 return {name,grossHours,netHours,capacityValue,cashSavings,totalCost,netCash,annualPrepaid,annualPayments,roi:totalCost?netCash/totalCost*100:null,payback};
 });
}
const topics={
 service:['Member communications','How are incorrect answers caught and escalated before reaching a member?','De-identified accuracy tests, escalation logs and human approval criteria.','Incorrect member communications; unresolved until CU testing establishes acceptance thresholds.'],
 lending:['Lending decisions','How are decision explanations, disparate outcomes and adverse-action reasons evaluated?','Documented feature lineage, independent outcome testing and qualified fair-lending review.','Unexplained or inequitable lending outcomes; unresolved pending specialist review.'],
 operations:['Internal operations','How are incorrect summaries detected before they change an operating decision?','Representative test set, error taxonomy, human review workflow and baseline measurements.','Operational errors or misleading summaries; unresolved pending controlled pilot tests.']
};
function diligence({vendor,usecase,claims}){
 if(!vendor.trim()||!claims.trim()) throw Error('Add a vendor name and public vendor information, or load the fictional sample.');
 const t=topics[usecase]; if(!t) throw Error('Choose an intended use case.');
 return {vendor:vendor.trim(),scope:t[0],assertions:claims.trim(),items:[
 {area:t[0],question:t[1],evidence:t[2],risk:t[3]},
 {area:'Data and security',question:'Where are inputs stored, who can access them, and are they used for model training?',evidence:'Data-flow diagram, retention/deletion terms, subprocessor list and independent security assurance with scope/date.',risk:'Data exposure and unknown reuse; unresolved until terms and controls are reviewed.'},
 {area:'Oversight and change',question:'Who approves model changes, monitors errors and can pause the service?',evidence:'Named control owners, change notices, incident escalation times and monitoring reports.',risk:'Uncontrolled model or service changes; unresolved pending agreed controls.'},
 {area:'Resilience and exit',question:'How can the CU continue work during outage or terminate and export its records?',evidence:'Tested continuity plan, export/deletion demonstration, financial viability evidence and contract exit terms.',risk:'Service dependency and lock-in; unresolved pending continuity and contract review.'}
 ]};
}
const api={calculate,diligence,limits}; if(typeof module!=='undefined') module.exports=api; else root.DecisionCore=api;
})(typeof window!=='undefined'?window:globalThis);
