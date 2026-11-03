// Offline aggregate reconciliation only. No fetch, credentials, reader IDs or scheduled job.
const SCHEMA=require('../automation/analytics-measurement.json');
function range(report,window){
 const w=report.windows?.[window],zone=w?.reportEvidence?.events?.metadata?.timeZone;
 if(!w||!zone)return null;
 if(w.startDate||w.endDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(w.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(w.endDate||'')||w.startDate>w.endDate)return null;return {start:w.startDate,end:w.endDate,timeZone:zone};}
 if(!Number.isFinite(Date.parse(report.generatedAt)))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(report.generatedAt)).map(p=>[p.type,p.value]));
 const day=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
 return {start:new Date(day-w.days*86400000).toISOString().slice(0,10),end:new Date(day-86400000).toISOString().slice(0,10),timeZone:zone};
}
function reconcile({cuai,cai=null,window='sevenDay',exclusionEvidence=null}){
 cuai=cuai?.data||cuai;cai=cai?.data||cai;
 if(cuai?.propertyId!=='520110560'||!cuai.ok)throw Error('CUAI source must be successful property520110560');
 if(cai&&(cai.propertyId!=='538586591'||!cai.ok))throw Error('CAI destination must be successful property538586591');
 const rows=cuai.windows?.[window]?.events;if(!Array.isArray(rows))throw Error('source window missing');
 const count=name=>{const matches=rows.filter(r=>r.eventName===name);if(matches.length>1)throw Error('duplicate aggregate event row');const n=matches[0]?.eventCount??0;if(!Number.isFinite(n)||n<0)throw Error('invalid event count');return n;};
 const impressions=count('cai_banner_impression'),clicks=count('cai_banner_click');
 const cells=rows.filter(r=>/^cai_bn_click_(hdr|ctx)_v1[ab]$/.test(r.eventName));
 const impressionCells=rows.filter(r=>/^cai_bn_imp_(hdr|ctx)_v1[ab]$/.test(r.eventName));
 const sourceRange=range(cuai,window),destinationRange=cai?range(cai,window):null;
 const rangesMatch=!!sourceRange&&JSON.stringify(sourceRange)===JSON.stringify(destinationRange);
 const acquisition=cai?.windows?.[window]?.acquisition;
 // Requires destination export grouped at source/medium/campaign. Do not sum generic and cell reports.
 const matches=Array.isArray(acquisition)?acquisition.filter(r=>r.sessionSource==='creditunionainews'&&r.sessionMedium==='site_banner'&&r.sessionCampaignName===SCHEMA.distributionTracking.cai.utm_campaign):null;
 const rawSessions=rangesMatch&&matches?matches.reduce((sum,r)=>{if(!Number.isFinite(r.sessions)||r.sessions<0)throw Error('invalid session count');return sum+r.sessions;},0):null;
 // A supplied exclusion record is auditable metadata, not proof; verify its provider report externally.
 const exclusionMatched=exclusionEvidence?.providerReportsVerified===true&&exclusionEvidence.sourceProperty==='520110560'&&exclusionEvidence.destinationProperty==='538586591'&&typeof exclusionEvidence.reportReference==='string'&&exclusionEvidence.reportReference.length>5&&JSON.stringify(exclusionEvidence.range)===JSON.stringify(sourceRange);
 return {window,sourceProperty:'520110560',destinationProperty:'538586591',sourceRange,destinationRange,rawObserved:{bannerImpressions:impressions,genericBannerClicks:clicks,cellClicks:cells.reduce((n,r)=>n+count(r.eventName),0),cellImpressions:impressionCells.reduce((n,r)=>n+count(r.eventName),0),attributedDestinationSessions:rawSessions},externalDemand:{verified:false,eligibleForReview:exclusionMatched&&rangesMatch&&rawSessions!==null,bannerClicks:exclusionMatched&&rangesMatch?clicks:null,destinationSessions:exclusionMatched&&rangesMatch?rawSessions:null},exclusionEvidence:exclusionEvidence||null,gaps:[...(!cai?['CAI destination aggregate unavailable']:[]),...(cai&&!rangesMatch?['report date ranges/timezones do not match']:[]),...(!exclusionMatched?['internal/developer exclusions not provider-verified for matched window']:[])],notes:['Raw observations and supplied exclusion records are not verified external demand; provider evidence still needs independent review.','Clicks and sessions use different units; this is not a user-level join or conversion-rate proof.','No calculator completion or subscription count is inferred from missing rows in older event allowlists.']};
}
module.exports={reconcile,range};
