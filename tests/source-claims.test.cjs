const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {verifyClaim}=require('../scripts/verify-source-claims.cjs');
const base={kind:'number',sourceEvidence:'More than 54% of recommendation answers cite an affiliate page',expectedDraftEvidence:'more than 54% of recommendation answers cited an affiliate page',forbiddenDraftEvidence:['54% of citations']};
test('Fintel denominator inversion fails',()=>assert.equal(verifyClaim({sourceText:base.sourceEvidence,draftText:'Affiliate pages accounted for more than 54% of citations.',claim:{...base,draftEvidence:'54% of citations'}}).ok,false));
test('Fintel sourced wording passes',()=>assert.equal(verifyClaim({sourceText:base.sourceEvidence,draftText:base.expectedDraftEvidence,claim:{...base,draftEvidence:base.expectedDraftEvidence}}).ok,true));
test('Raiz application is not funding',()=>{
  const claim={kind:'scope',sourceEvidence:'online application duration: three to five minutes; funding can take two days',draftEvidence:'three to five minutes',expectedDraftEvidence:'application',forbiddenDraftEvidence:['funded in three to five minutes']};
  assert.equal(verifyClaim({sourceText:claim.sourceEvidence,draftText:'Accounts funded in three to five minutes',claim}).ok,false);
  assert.equal(verifyClaim({sourceText:claim.sourceEvidence,draftText:'Online application takes three to five minutes',claim}).ok,true);
});
test('date and attribution clean claims pass; missing source fails',()=>{
  const claim={kind:'date',sourceEvidence:'released October 7, 2026',draftEvidence:'October 7',expectedDraftEvidence:'October 7'};
  assert.equal(verifyClaim({sourceText:claim.sourceEvidence,draftText:'Fintel said October 7',claim}).ok,true);
  assert.equal(verifyClaim({sourceText:'undated',draftText:'Fintel said October 7',claim}).ok,false);
  const attribution={kind:'attribution',sourceEvidence:'Alkami reports',draftEvidence:'Alkami reports',expectedDraftEvidence:'Alkami reports'};
  assert.equal(verifyClaim({sourceText:'Alkami reports',draftText:'Alkami reports',claim:attribution}).ok,true);
});

test('every committed source-claim fixture checks its actual draft',()=>{
  const root=path.join(__dirname,'..');
  const directory=path.join(__dirname,'fixtures/source-claims');
  for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))){
    const fixture=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
    const sourceText=fs.readFileSync(path.join(root,fixture.sourceFile),'utf8');
    const draftText=fs.readFileSync(path.join(root,fixture.draftFile),'utf8');
    for(const claim of fixture.claims) assert.deepEqual(verifyClaim({sourceText,draftText,claim}),{ok:true},`${name}: ${claim.id}`);
  }
});
