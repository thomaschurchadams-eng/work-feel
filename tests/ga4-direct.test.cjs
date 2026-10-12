const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateDates, ranges, compatible, safeRows, queryDirect } = require('../lib/ga4-direct');
const { run } = require('../scripts/run-ga4-report-only.cjs');
const shapeEvidence = shape => ({ dimensionCompatibilities: shape.dimensions.map(d => ({ dimensionMetadata: { apiName: d.name }, compatibility: 'COMPATIBLE' })), metricCompatibilities: shape.metrics.map(m => ({ metricMetadata: { apiName: m.name }, compatibility: 'COMPATIBLE' })) });
const fixture = { rows: [], rowCount: 0, metadata: { timeZone: 'America/New_York', subjectToThresholding: true, dataLossFromOtherRow: false, samplingMetadatas: [] } };
test('strict inclusive dates bound comparison and exclude today in property timezone', () => {
  for (const input of [{ startDate:'2026-02-30',endDate:'2026-03-01' },{ startDate:'2026-10-02' },{ startDate:'today',endDate:'2026-10-01' },{ startDate:'2026-09-01',endDate:'2026-10-01' },{ startDate:'2026-10-02',endDate:'2026-10-01' },{ startDate:'2026-10-12',endDate:'2026-10-12' }]) assert.throws(() => validateDates(input,'2026-10-12'));
  assert.deepEqual(ranges({},'2026-10-12'),[{ name:'current',startDate:'2026-10-03',endDate:'2026-10-09' },{ name:'previous',startDate:'2026-09-26',endDate:'2026-10-02' }]);
  assert.equal(validateDates({ startDate:'2024-02-01',endDate:'2024-02-28' }).days,28);
});
test('each exact query is compatibility checked; incompatible returning is unavailable without zero data', async () => {
  const bodies=[],checks=[];
  const data=await queryDirect({}, { report: async body => { bodies.push(body); return fixture; }, compatibility: async shape => { checks.push(shape); const result=shapeEvidence(shape); if(shape.dimensions[0]?.name==='newVsReturning') result.metricCompatibilities[0].compatibility='INCOMPATIBLE'; return result; } },new Date('2026-10-12T01:00:00Z'));
  assert.equal(data.timeZone,'America/New_York');assert.equal(data.freshness.propertyToday,'2026-10-11');assert.equal(data.status,'partial');assert.equal(data.reports.newReturning.status,'unavailable');assert.equal(data.reports.newReturning.rows,undefined);
  assert.equal(checks.length,7);assert.equal(bodies.length,7);
  for (const body of bodies.slice(1)) {assert.equal(body.dimensionFilter.filter.stringFilter.value,'Direct');assert.equal(body.dateRanges.length,2);assert.ok(Number(body.limit)<=56);assert.equal(body.metrics.length,6);assert.ok(!JSON.stringify(body).includes('QueryString'));}
  assert.equal(data.reports.daily.metadata.subjectToThresholding,true);
  assert.match(data.caveats.join(' '),/Internal traffic/);assert.match(data.caveats.join(' '),/Hostname does not identify internal/);assert.match(data.caveats.join(' '),/cannot be recovered/);
});
test('compatibility evidence fails closed on omissions; partial failures preserve other reports',async()=>{
  assert.equal(compatible({}, {dimensions:[],metrics:[{name:'sessions'}]}),false);
  const data=await queryDirect({}, {report:async body=>{if(body.dimensions?.[0]?.name==='country')throw Error('private provider details');return {...fixture,rowCount:100,rows:[{date:'20261001',dateRange:'current',sessions:2}]};},compatibility:async s=>shapeEvidence(s)},new Date('2026-10-12T12:00:00Z'));
  assert.equal(data.status,'partial');assert.equal(data.reports.countries.status,'error');assert.equal(data.reports.daily.truncated,true);assert.ok(!JSON.stringify(data).includes('private provider details'));
  await assert.rejects(queryDirect({}, { report:async()=>({...fixture,metadata:{}}),compatibility:async s=>shapeEvidence(s)}),/timezone_unavailable/);
  await assert.rejects(queryDirect({}, {report:async()=>fixture,compatibility:async()=>{const e=Error('denied');e.code='ga4_property_access_denied';throw e;}}),/denied/);
});
test('unknown landing paths and hosts never reach persisted aggregates',()=>{
  assert.deepEqual(safeRows([{landingPage:'/reader@example.com',hostName:'private-host',sessions:2},{landingPage:'/',hostName:'creditunionainews.com'}]),[{landingPage:'(unrecognized path withheld)',hostName:'(other hostname withheld)',sessions:2},{landingPage:'/',hostName:'creditunionainews.com'}]);
});
async function runnerFixture({health={},failure='',invalidDates=false}={}) {
  const calls=[],saved=[];const sha='a'.repeat(40);
  const data=await run({env:{DEPLOYED_SHA:sha,ACTIONS_ID_TOKEN_REQUEST_URL:'https://identity.example/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'fixture',...(invalidDates?{REPORT_START_DATE:'today'}:{})},save: x=>saved.push(x),fetcher:async(url,options)=>{
    calls.push({url:String(url),options});const route=String(url).split('/').pop();
    const body=String(url).startsWith('https://identity.example')?{value:'secret-fixture'}:route==='operations-health'?{ok:true,commit:sha,environment:'production',...health}:{ok:true,status:'complete'};
    return {ok:route!==failure,status:route===failure?403:200,json:async()=>body};
  }});return {calls,saved,data};
}
test('metrics-only runner is completely isolated from publishing, queue reconciliation and GitHub writes',async()=>{
  const result=await runnerFixture();assert.equal(result.calls.length,3);assert.equal(result.saved.length,1);
  assert.deepEqual(result.calls.slice(1).map(c=>c.url),['https://creditunionainews.com/api/operations-health','https://creditunionainews.com/api/ga4-metrics']);
  for(const c of result.calls.slice(1)){assert.equal(c.options.method,'POST');assert.equal(c.options.redirect,'error');assert.equal(JSON.parse(c.options.body).commitSha,'a'.repeat(40));}
  assert.equal(JSON.parse(result.calls[2].options.body).diagnostic,'direct');assert.ok(!JSON.stringify(result.saved).includes('secret-fixture'));
  const source=fs.readFileSync(require.resolve('../scripts/run-ga4-report-only.cjs'),'utf8');assert.ok(!source.includes("require('./run-secure-operations"));assert.ok(!source.includes('GITHUB_TOKEN'));assert.ok(!source.includes('social-queue.json'));
});
test('runner stops on identity/deployment/access errors and invalid dates',async()=>{
  await assert.rejects(runnerFixture({health:{commit:'b'.repeat(40)}}),/deployment_commit_mismatch/);
  await assert.rejects(runnerFixture({failure:'ga4-metrics'}),/report_request_failed_403/);
  await assert.rejects(runnerFixture({invalidDates:true}),/invalid_dates/);
});
test('manual metrics-only job excludes operate and grants no content write permission',()=>{
  const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/cuai-operations.yml'),'utf8');
  assert.match(workflow,/operate:\n    if: >-\n      inputs.metrics_only != true &&/);
  const job=workflow.split('  metrics-only:\n')[1];assert.match(job,/github.event_name == 'workflow_dispatch' && inputs.metrics_only == true/);assert.match(job,/contents: read/);assert.ok(!job.includes('contents: write'));assert.ok(!job.includes('run-secure-operations'));assert.ok(!job.includes('GITHUB_TOKEN'));
});
test('reporting endpoint checks trusted identity, exact deployment, dates and property before querying',async()=>{
  const vm=require('node:vm');const source=fs.readFileSync(require.resolve('../api/ga4-metrics'),'utf8');
  for(const scenario of ['identity','sha','dates','property','direct']){
    let queries=0,auth=0,status,data;const module={exports:{}};
    const context={module,exports:module.exports,require:name=>name==='../lib/operations-auth'?{authorize:async(req,res)=>{auth++;if(scenario==='identity'){res.status(401).json({ok:false});return false;}return true;}}:name==='node:crypto'?{sign:()=>Buffer.from('signature')}:require(name==='../lib/ga4-direct'?'../lib/ga4-direct':name),Buffer,URLSearchParams,AbortSignal,Date,process:{env:{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),GA4_PROPERTY_ID:scenario==='property'?'999':'520110560',GA4_CLIENT_EMAIL:'fixture',GA4_PRIVATE_KEY:'fixture'}},fetch:async()=>{queries++;return {ok:true,json:async()=>({access_token:'fixture'})};}};
    if(scenario==='direct')context.require=name=>name==='../lib/ga4-direct'?{validateDates,queryDirect:async()=>({ok:true,status:'complete'})}:name==='../lib/operations-auth'?{authorize:async()=>true}:require(name);
    // Token signing uses a fixture key through the crypto stub in every scenario.
    const original=context.require;context.require=name=>name==='node:crypto'?{sign:()=>Buffer.from('signature')}:original(name);
    vm.runInNewContext(source,context);
    await module.exports({method:'POST',headers:{},body:{commitSha:scenario==='sha'?'b'.repeat(40):'a'.repeat(40),diagnostic:'direct',...(scenario==='dates'?{startDate:'2026-02-30',endDate:'2026-03-01'}:{})}},{setHeader(){},status:s=>{status=s;return {json:x=>{data=x;}};}});
    assert.equal(status,{identity:401,sha:403,dates:400,property:503,direct:200}[scenario]);assert.equal(queries,scenario==='direct'?1:0);assert.equal(data.ok,scenario==='direct');
  }
});
