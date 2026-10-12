'use strict';
const fs = require('node:fs');
// A small editorial gate for explicitly supplied claims. No crawling or broad scan.
function verifyClaim({ sourceText, draftText, claim }) {
  if (!['number','date','attribution','scope'].includes(claim.kind)) throw Error('unsupported_claim_kind');
  if (!sourceText.includes(claim.sourceEvidence)) return { ok:false, reason:'source_evidence_missing' };
  if (!draftText.includes(claim.draftEvidence)) return { ok:false, reason:'draft_evidence_missing' };
  if (claim.expectedDraftEvidence && !draftText.includes(claim.expectedDraftEvidence)) return { ok:false, reason:'claim_mismatch' };
  if (claim.forbiddenDraftEvidence?.some(s => draftText.includes(s))) return { ok:false, reason:'claim_mismatch' };
  return { ok:true };
}
if (require.main === module) {
  const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const sourceText = fs.readFileSync(fixture.sourceFile, 'utf8');
  const draftText = fs.readFileSync(fixture.draftFile, 'utf8');
  const failures = fixture.claims.map(claim => ({ id:claim.id, ...verifyClaim({sourceText,draftText,claim}) })).filter(r => !r.ok);
  if (failures.length) { console.error(failures); process.exitCode=1; }
  else console.log(`${fixture.claims.length} source-to-claim checks passed`);
}
module.exports = { verifyClaim };
