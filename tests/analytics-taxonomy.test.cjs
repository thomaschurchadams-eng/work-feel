const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('analytics technology allowlist matches the editorial taxonomy',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path.join(root,'automation/editorial-taxonomy.json')));
 const measurement=JSON.parse(fs.readFileSync(path.join(root,'automation/analytics-measurement.json')));
 assert.deepEqual([...measurement.editorialDimensions.technology].sort(),taxonomy.technologies.map(x=>x.id).sort());
});
for(const technology of ['industry-development','generative-ai','unknown-technology',null])test(`article validator checks technology ${technology}`,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-analytics-'));
 try{
  const fixture=path.join(dir,'article.html');
  fs.writeFileSync(fixture,`<body data-section="news" data-editorial-function="board-strategy" ${technology?`data-technology="${technology}"`:''} data-content-format="explainer" data-audience="executive" data-maturity="practical-now"><script src="/assets/app.js"></script></body>`);
  const result=spawnSync(process.execPath,['scripts/validate-analytics.mjs',fixture],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,['industry-development','generative-ai'].includes(technology)?0:1,result.stderr);
  if(technology==='unknown-technology')assert.match(result.stderr,/Invalid analytics values: data-technology=unknown-technology/);
  if(technology===null)assert.match(result.stderr,/Missing analytics attributes: data-technology/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
