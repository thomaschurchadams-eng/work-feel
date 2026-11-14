const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const policy=require('../automation/media-policy.json');
const {validateSchedule,checkCapacity}=require('../lib/media-slots.cjs');
const now=Date.parse('2026-11-13T00:00:00Z');
test('recovery does not activate two-slot/weekend cadence or alter current ceilings',()=>{
 const d=structuredClone(policy.distribution);delete d.reviewedEventExclusions;
 assert.deepEqual(d,{platform:'linkedin',channelId:'6a53df0880cc80cdcaa76fb8',channelName:'CreditUnionAI News',maximumPerDay:1,maximumPerWeek:5,weekStarts:'Monday',x:{status:'blocked',reason:'identity-and-authorized-routing-unverified'}});
 for(const at of ['2026-11-13T12:30:00-05:00','2026-11-16T12:30:00-05:00','2026-11-17T11:30:00-05:00','2026-11-18T11:30:00-05:00','2026-11-19T11:30:00-05:00'])assert.ok(validateSchedule(at,{},policy,now).dueAt);
 for(const date of ['2026-11-14','2026-11-15'])for(const time of ['10:00','12:30','14:30'])assert.equal(validateSchedule(date+'T'+time+':00-05:00',{},policy,now).error,'scheduled_for_weekend');
 for(const time of ['10:00','14:30'])assert.equal(validateSchedule('2026-11-16T'+time+':00-05:00',{},policy,now).error,'scheduled_for_outside_policy');
 const posts=Array.from({length:5},(_,i)=>({id:String(i),status:'sent',sentAt:'2026-11-16T17:30:00Z'}));
 assert.equal(checkCapacity('2026-11-17',[],posts).error,'linkedin_weekly_cap_conflict');
 assert.equal(checkCapacity('2026-11-16',[],posts.slice(0,1)).error,'linkedin_daily_cap_conflict');
});
test('existing operations schedule and inactive timing experiment are retained',()=>{
 const workflow=fs.readFileSync('.github/workflows/cuai-operations.yml','utf8');
 assert.equal((workflow.match(/cron:/g)||[]).length,1);assert.match(workflow,/cron: '45 17 \* \* 1-5'/);
 assert.equal(policy.timingTest.status,'planned');assert.equal(policy.timingTest.baselineValidatedObservations,0);
 assert.equal(require('../automation/publishing-rules.json').weeklyTargets.linkedinPosts,5);
 assert.equal(require('../automation/publishing-rules.json').weeklyTargets.siteStoriesMax,25);
});
