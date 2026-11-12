'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const taxonomy = require('../automation/editorial-taxonomy.json');
const candidate = (name, fn, tech = 'industry-development') => ({title:name, sourceUrl:'https://example.invalid/source', sourceTier:1, confidence:1, functions:[fn], technologies:[tech], format:'explainer', newsworthiness:100, creditUnionRelevance:100, sourcePublishedAt:new Date().toISOString()});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-candidates-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  fs.mkdirSync(path.join(dir,'scripts')); fs.mkdirSync(path.join(dir,'automation'));
  for(const file of ['scripts/score-editorial-candidates.mjs','automation/editorial-taxonomy.json','automation/publishing-rules.json']) fs.copyFileSync(path.join(root,file),path.join(dir,file));
  return (rows, articles = []) => {
    fs.writeFileSync(path.join(dir,'automation/coverage-ledger.json'),JSON.stringify({articles}));
    fs.writeFileSync(path.join(dir,'candidates.json'),JSON.stringify(rows));
    const r=spawnSync(process.execPath,['scripts/score-editorial-candidates.mjs','candidates.json'],{cwd:dir,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr); return JSON.parse(r.stdout);
  };
}
test('industry marker permits five varied stories; actual technology and function caps remain', t => {
  const run=fixture(t), functions=taxonomy.functions.slice(0,5).map(x=>x.id);
  assert.equal(run(functions.map((fn,i)=>candidate(`Unique alpha ${i}`,fn))).selected.length,5);
  assert.equal(run(functions.map((fn,i)=>candidate(`Unique beta ${i}`,fn,'generative-ai'))).selected.length,2);
  assert.equal(run([0,1,2,3].map(i=>candidate(`Unique gamma ${i}`,functions[0]))).selected.length,3);
});
test('expanded function limit can select 25 and counts earlier weekly output across runs', t => {
  const run=fixture(t), rows=taxonomy.functions.flatMap(({id},n)=>[0,1,2].map(i=>candidate(`Distinct proposal ${n} ${i}`,id)));
  assert.equal(run(rows).selected.length,25);
  const prior=[0,1,2].map(i=>({...candidate(`Recorded earlier outcome ${i}`,taxonomy.functions[0].id),url:`/news/recorded-${i}.html`,publishedAt:new Date().toISOString()}));
  const result=run(rows,prior);
  assert.equal(result.alreadyPublishedThisWeek,3); assert.equal(result.selected.length,22);
  assert.ok(result.selected.every(x=>x.functions[0]!==taxonomy.functions[0].id));
});
test('current-week actual technology counts carry over; prior weeks and future entries do not consume capacity', t => {
  const run=fixture(t), fn=taxonomy.functions[0].id;
  const rows=taxonomy.functions.slice(0,5).map(({id},i)=>candidate(`Fresh reporting ${i}`,id,'generative-ai'));
  const prior=[0,1].map(i=>({...candidate(`Existing deployed item ${i}`,fn,'generative-ai'),publishedAt:new Date().toISOString()}));
  assert.equal(run(rows,prior).selected.length,0);
  const old=prior.map(x=>({...x,publishedAt:new Date(Date.now()-14*86400000).toISOString()}));
  assert.equal(run(rows,old).selected.length,2);
  const future=prior.map(x=>({...x,publishedAt:new Date(Date.now()+86400000).toISOString()}));
  assert.equal(run(rows,future).selected.length,2);
});
