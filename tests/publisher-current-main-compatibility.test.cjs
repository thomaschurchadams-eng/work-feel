'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const {validateCurrentContinuity,validatePublisherCheckpointAdmission}=require('../lib/daily-cycle-guards.cjs');
const repo=path.resolve(__dirname,'..'),file='automation/daily-cycle-state.json';
const cli=path.join(repo,'scripts/validate-daily-cycle-preservation.mjs');
const refs={prior:'b3dd92178903ea5003a39e3718667c868082be45',article:'0fc2e5b1254f79e9b8044474122ceeab34ddea8d',closeout:'ad01aaf1f00959665840e82318d1477940b6b107',main:'259d6a5c50f0dd97d90c8e052af9b5bd48920326'};
const bytes=ref=>execFileSync('git',['show',`${ref}:${file}`],{cwd:repo});
const state=ref=>JSON.parse(bytes(ref)),copy=x=>structuredClone(x);
const current=state(refs.main),actual=current.current.regularPublicationSlots[0];
const check=(a,b)=>{validateCurrentContinuity(a,b);validatePublisherCheckpointAdmission(a,b);};
const command=(cwd,base,candidate)=>spawnSync(process.execPath,[cli,file,base,...(candidate?[candidate]:[])],{cwd,encoding:'utf8'});
function fixture(t,base){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-current-main-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('config','commit.gpgsign','false');git('config','core.hooksPath',path.join(dir,'empty-hooks'));
  fs.mkdirSync(path.join(dir,'automation'));fs.writeFileSync(path.join(dir,file),bytes(base));git('add','.');git('commit','-qm','isolated prior state');
  return {dir,base:git('rev-parse','HEAD'),write:s=>fs.writeFileSync(path.join(dir,file),JSON.stringify(s))};
}
test('today actual state and failed/replacement identities remain intact on a no-op',()=>{
  assert.equal(current.history.length,79);assert.equal(current.current.fullArticleCount,1);
  assert.equal(actual.evidence.pending.prNumber,309);assert.equal(actual.evidence.pending.head,'ee51b53a587fc313b3c46205450bbef79136b13c');
  assert.equal(actual.evidence.pending.run,42614631185);assert.equal(actual.evidence.pending.job,129151327417);
  const prior=actual.evidence.validationHistory[0];assert.equal(prior.head,'1c6a5cadbd36f94e6836334faa784dd5ba1e7a3c');assert.equal(prior.terminalValidation.conclusion,'failure');
  assert.equal(current.current.regularPublicationSlots[1].status,'editorial-hold');
  check(current.current,copy(current.current));const r=command(repo,refs.main,refs.main);assert.equal(r.status,0,r.stderr);
});
for(const [base,candidate]of [[refs.prior,refs.article],[refs.article,refs.closeout]])test(`exact accepted edge ${base.slice(0,7)} -> ${candidate.slice(0,7)} passes; copied new proposal fails`,t=>{
  const accepted=command(repo,base,candidate);assert.equal(accepted.status,0,accepted.stderr);
  const f=fixture(t,base);f.write(state(candidate));const proposal=command(f.dir,f.base);assert.equal(proposal.status,1);assert.match(proposal.stderr,/structured slot transition|hold reason|validation prose is read-only/);
});
test('wrong Nov9 predecessor cannot obtain a format exception',()=>{const r=command(repo,refs.prior,refs.closeout);assert.equal(r.status,1);assert.match(r.stderr,/hold reason|validation prose is read-only/);});
test('actual309 failure -> replacement -> verified outcome retains exact evidence (isolated reconstruction)',()=>{
  const old=actual.evidence.validationHistory[0],before=copy(state(refs.article).current);
  const p={prNumber:old.prNumber,head:old.head,run:old.run,job:old.job,runAttempt:old.runAttempt};
  const pending=copy(before);pending.regularPublicationSlots=[{slot:1,status:'pending-validation',accountableOwner:'daily-publisher',nextReviewAt:old.nextReviewAt,evidence:{pending:p}}];check(before,pending);
  const failed=copy(pending);failed.regularPublicationSlots[0].status='technical-failure';failed.regularPublicationSlots[0].evidence.terminalValidation=copy(old.terminalValidation);check(pending,failed);
  const replacement=copy(failed),slot=replacement.regularPublicationSlots[0];slot.status='pending-validation';slot.nextReviewAt=actual.evidence.pending.nextReviewAt;slot.evidence={pending:copy(actual.evidence.pending),validationHistory:[copy(old)]};check(failed,replacement);
  const live=copy(replacement);live.regularPublicationSlots[0]=copy(actual);check(replacement,live);check(live,copy(live));
  const lost=copy(live);lost.regularPublicationSlots[0].evidence.validationHistory=[];assert.throws(()=>check(live,lost),/lost or changed its evidence/);
  const stale=copy(replacement);stale.regularPublicationSlots[0]=copy(actual);stale.regularPublicationSlots[0].evidence.terminalValidation=copy(old.terminalValidation);assert.throws(()=>check(replacement,stale),/matching terminal evidence/);
});
test('today legitimate hold stays unchanged; a new hold update uses explicit real reason',()=>{
  const before=current.current,updated=copy(before);updated.regularPublicationSlots[1].nextAction='Fixture review only; no publication';
  assert.throws(()=>check(before,updated),/hold reason/);updated.regularPublicationSlots[1].holdReason=before.secondSlot;check(before,updated);
});
test('future ordinary/prepared rollover preserves actual Nov9 live, failed and held receipts',t=>{
  const f=fixture(t,refs.main),next=copy(current);next.history.push(copy(next.current));next.current={date:'2026-11-10',status:'in-progress',fullArticleCount:0,alertCount:0,publications:[],outcomeSlot:1,regularPublicationSlots:[{slot:1,status:'prepared',candidateTitle:'Isolated future candidate',url:'/news/isolated-future.html',accountableOwner:'daily-publisher',nextReviewAt:'2026-11-10T12:15:00Z'}]};
  f.write(next);const good=command(f.dir,f.base);assert.equal(good.status,0,good.stderr);
  const lost=copy(next);lost.history.at(-1).regularPublicationSlots[0].evidence.validationHistory=[];f.write(lost);const bad=command(f.dir,f.base);assert.equal(bad.status,1);assert.match(bad.stderr,/complete prior current/);
});
test('untouched original Nov6 technical closeout is still rejected by actual CLI',()=>{
  const r=command(repo,'c3724bc99da14b9ef8d6d4fe3de3d4ab90779e37','8f00ca6e2741a099f979e256d700f4f72a95d36b');assert.equal(r.status,1);assert.match(r.stderr,/structured slot transition/);
});
