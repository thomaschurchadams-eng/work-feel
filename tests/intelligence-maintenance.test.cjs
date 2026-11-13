const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const vendors = json('automation/vendor-registry.json');
const regulatory = json('automation/regulatory-watch.json');
function run(script, cwd = root, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {cwd, encoding:'utf8'});
  return { status: result.status, text: result.stdout+result.stderr };
}
function fixture(change) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-intelligence-'));
  try {
    fs.mkdirSync(path.join(dir,'automation')); fs.mkdirSync(path.join(dir,'intelligence'));
    for (const name of ['index.html','vendors.html','regulatory-watch.html']) fs.writeFileSync(path.join(dir,'intelligence',name),'fixture');
    const data = { vendors:structuredClone(vendors), regulatory:structuredClone(regulatory) };
    for (const item of [...data.vendors.vendors.flatMap(v=>v.signals), ...data.regulatory.records.flatMap(r=>r.developments)]) {
      if (item.relatedCoverage) {const file=path.join(dir,item.relatedCoverage);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
    }
    change(data);
    fs.writeFileSync(path.join(dir,'automation/vendor-registry.json'),JSON.stringify(data.vendors));
    fs.writeFileSync(path.join(dir,'automation/regulatory-watch.json'),JSON.stringify(data.regulatory));
    fs.copyFileSync(path.join(root,'automation/intelligence-schema.json'),path.join(dir,'automation/intelligence-schema.json'));
    return run('scripts/validate-intelligence.mjs',dir);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('actual registries, monitoring ledger and generated public pages agree',()=>{
  for (const [script,args] of [['scripts/validate-intelligence.mjs',[]],['scripts/validate-intelligence-monitoring.mjs',[]],['scripts/generate-intelligence-pages.mjs',['--check']]]) {
    const result=run(script,root,args);assert.equal(result.status,0,result.text);
  }
});
test('source-backed tracker-only addition needs no article; retained optional links must be real',()=>{
  assert.equal(fixture(()=>{}).status,0);
  assert.notEqual(fixture(d=>{d.vendors.vendors.at(-1).signals[0].relatedCoverage='news/does-not-exist.html';}).status,0);
  for(const value of ['',null,'../outside.html','https://example.org/news.html']) assert.notEqual(fixture(d=>{d.vendors.vendors.at(-1).signals[0].relatedCoverage=value;}).status,0);
});
test('missing coverage requires explicit tracker-only disposition, never a missing primary source',()=>{
  assert.notEqual(fixture(d=>{delete d.vendors.vendors.at(-1).signals[0].coverageStatus;}).status,0);
  assert.notEqual(fixture(d=>{delete d.vendors.vendors.at(-1).signals[0].sourceUrl;}).status,0);
  assert.notEqual(fixture(d=>{d.vendors.vendors.at(-1).signals[0].sourceUrl='javascript:alert(1)';}).status,0);
});
test('regulatory tracker-only records obey the same independent coverage rule',()=>{
  assert.equal(fixture(d=>{const s=d.regulatory.records.at(-1).developments[0];delete s.relatedCoverage;s.coverageStatus='tracker-only-no-article';}).status,0);
  assert.notEqual(fixture(d=>{delete d.regulatory.records.at(-1).developments[0].relatedCoverage;}).status,0);
});
test('invalid dates and empty signal records fail closed',()=>{
  for (const value of ['2026-02-30','2026-99-99','not-a-date']) assert.notEqual(fixture(d=>{d.vendors.vendors[0].lastReviewed=value;}).status,0);
  assert.notEqual(fixture(d=>{d.vendors.vendors[0].signals=[];}).status,0);
  assert.notEqual(fixture(d=>{d.regulatory.records[0].developments=[];}).status,0);
});
test('legacy public summaries keep process history private without admitting empty replacements or visible process narration',()=>{
  for(const value of ['', '  ', null, 42, {}])assert.notEqual(fixture(d=>{d.vendors.vendors[0].signals[0].publicSummary=value;}).status,0);
  assert.notEqual(fixture(d=>{delete d.vendors.vendors.find(v=>v.id==='jack-henry').signals[0].publicSummary;}).status,0);
  assert.notEqual(fixture(d=>{delete d.regulatory.records.find(r=>r.id==='ncua-ai-risk').developments[0].publicSummary;}).status,0);
  assert.notEqual(fixture(d=>{d.vendors.vendors.at(-1).signals[0].summary='Tracker initialized from existing coverage of an isolated vendor.';}).status,0);
  assert.notEqual(fixture(d=>{d.regulatory.records.at(-1).developments.at(-1).publicSummary='Existing newsroom coverage tracks an isolated signal.';}).status,0);
  assert.equal(fixture(()=>{}).status,0,'retained historical and held summaries stay valid');
});
test('public records retain dates, attribution and sources without process narration; held vendor stays withheld',()=>{
  for(const [file,records] of [['vendors.html',vendors.vendors.filter(v=>!v.promotionStatus?.startsWith('withheld'))],['regulatory-watch.html',regulatory.records]]){
    const html=fs.readFileSync(path.join(root,'intelligence',file),'utf8');
    const cards=[...html.matchAll(/<article class="card intelligence-record"[\s\S]*?<\/article>/g)].map(m=>m[0]);
    assert.equal(cards.length,records.length);
    assert.doesNotMatch(html, /public vendor records|regulatory watch records|Review dates apply|Partial catch-up reviewed|complete market scan|Review scope and history|Evidence labels|Tracker inclusion is not a recommendation|Earlier developments remain|Tracker-only update|This editorial tracker is not legal advice/);
    assert.doesNotMatch(html, /tracker initialized|existing (?:newsroom )?(?:coverage|reporting|analysis) (?:tracks|of|on)/i);
    assert.doesNotMatch(html, /type="search"|(?:vendor|reg)-(?:search|reset|empty|status)|data-search=|filterRecords/);
    for (const card of cards) assert.doesNotMatch(card, /\bhidden\b|display:\s*none/);
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    for(const record of records){
      const card=cards.find(c=>c.includes(`data-record-id="${record.id}"`));assert.ok(card);
      const signal=file==='vendors.html'?record.signals[0]:record.developments.at(-1);
      assert.ok(card.includes(escape(signal.publicSummary ?? signal.summary)),record.id+' preserves qualified summary');
      assert.ok(card.includes(`href="${escape(signal.sourceUrl)}"`));
      assert.equal([...card.matchAll(/<time\b/g)].length,1,record.id+' has one useful date');
      assert.ok(card.includes(`Reviewed <time datetime="${record.lastReviewed}">`));
      if(signal.evidenceLevel)assert.ok(card.includes(escape(signal.evidenceLevel.replaceAll('-',' '))));
      if(record.jurisdiction)assert.ok(card.includes(escape(record.jurisdiction)));
    }
    assert.ok(!html.includes('data-record-id="ncr-voyix"'));
  }
  const html=fs.readFileSync(path.join(root,'intelligence/regulatory-watch.html'),'utf8');
  assert.ok(regulatory.records.find(r=>r.id==='ncua-ai-resources').developments.length >= 2);
  assert.ok(!html.includes('href="https://ncua.gov/regulation-supervision/regulatory-compliance-resources/credit-union-artificial-intelligence-ai-resources"'));
  assert.ok(html.includes('the source publication date was not established'));
});
test('page regeneration never advances review timestamps, run success or ledger history',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-intelligence-render-'));
  try {
    const inputs=['automation/vendor-registry.json','automation/regulatory-watch.json','automation/intelligence-monitoring-state.json','automation/intelligence-signal-ledger.json'];
    for(const file of [...inputs,'intelligence/vendors.html','intelligence/regulatory-watch.html']) {const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
    // An actual new record forces a page change, without interpreting review time as a run.
    const file=path.join(dir,inputs[0]), data=JSON.parse(fs.readFileSync(file));
    data.vendors.push({...structuredClone(data.vendors.at(-1)),id:'isolated-new-record',name:'<Isolated & untrusted>'});
    data.vendors.at(-1).signals[0].publicSummary='<Qualified & untrusted>';
    fs.writeFileSync(file,JSON.stringify(data));
    const before=inputs.map(f=>fs.readFileSync(path.join(dir,f),'utf8'));
    const result=run('scripts/generate-intelligence-pages.mjs',dir);assert.equal(result.status,0,result.text);
    inputs.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(dir,f),'utf8'),before[i]));
    const page=fs.readFileSync(path.join(dir,'intelligence/vendors.html'),'utf8');
    assert.ok(page.includes('&lt;Isolated &amp; untrusted&gt;'));assert.ok(!page.includes('<Isolated & untrusted>'));
    assert.ok(page.includes('&lt;Qualified &amp; untrusted&gt;'));assert.ok(!page.includes('<Qualified & untrusted>'));
    const count=data.vendors.filter(v=>!v.promotionStatus?.startsWith('withheld')).length;
    assert.equal([...page.matchAll(/<article class="card intelligence-record"/g)].length,count);
    assert.doesNotMatch(page,/public vendor records|Partial catch-up reviewed|Evidence labels/);
    assert.doesNotMatch(page, /type="search"|filterRecords/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
  const changes=fs.readFileSync(path.join(root,'intelligence/changes.html'),'utf8');
  assert.ok(!changes.includes('within the existing Alerts workflow'));
  assert.ok(changes.includes(`${json('automation/intelligence-sources.json').sources.length} registered discovery sources`));
});
