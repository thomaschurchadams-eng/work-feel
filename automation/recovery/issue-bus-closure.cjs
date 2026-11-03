'use strict';

// Read-only mapping from a failed operations run to the existing issue-bus
// dedupeKey. Run/SHA is a correlation identity, never the bus incident key.
function issueBusClosure({readComments,repository,issueNumber,runId,deploymentSha}) {
  if(typeof readComments!=='function' || !repository || !Number.isInteger(issueNumber) ||
     !/^\d+$/.test(String(runId||'')) || !/^[0-9a-f]{40}$/.test(deploymentSha||'')) throw Error('invalid_incident_evidence');
  const issueBase=`https://github.com/${repository}/issues/${issueNumber}`;
  const runUrl=`https://github.com/${repository}/actions/runs/${runId}`;
  function event(comment) {
    const body=comment?.body;
    if(typeof body!=='string' || !body.startsWith('<!-- CUAI_AGENT_EVENT -->')) return null;
    const yaml=body.match(/^```yaml\n([\s\S]*?)\n```/m)?.[1];
    if(!yaml) return null;
    const field=name=>yaml.match(new RegExp(`^${name}:\\s*(.+)$`,'m'))?.[1]?.trim();
    return {comment,body,eventType:field('eventType'),dedupeKey:field('dedupeKey'),status:field('status')};
  }
  function ambiguous(reason) { throw Object.assign(Error(reason),{code:'AMBIGUOUS_OUTCOME'}); }
  async function inspect() {
    const comments=await readComments();
    if(!Array.isArray(comments)) ambiguous('issue_comments_unavailable');
    const events=comments.map(event).filter(Boolean);
    const blockers=events.filter(x=>x.eventType==='handoff' && x.status==='blocked' &&
      x.body.includes(runUrl) && x.body.includes(deploymentSha));
    if(blockers.length!==1) ambiguous('operation_bus_mapping_missing_or_conflicting');
    const blocker=blockers[0], key=blocker.dedupeKey;
    const blockerId=String(blocker.comment.id);
    if(!key || !/^\d+$/.test(blockerId) || blocker.comment.url!==`${issueBase}#issuecomment-${blockerId}`)
      ambiguous('operation_bus_mapping_invalid');
    const terminal=events.filter(x=>x.dedupeKey===key && x.status==='completed');
    const completion=terminal.filter(x=>x.eventType==='recovery' &&
      x.body.includes(`comment${blockerId}`) && x.body.includes(runUrl) && x.body.includes(deploymentSha));
    if(terminal.length!==completion.length || completion.length>1) ambiguous('operation_bus_closure_conflicting');
    return {key,blockerCommentId:blockerId,completionCommentId:completion[0]?.comment.id||null,closed:completion.length===1};
  }
  return {
    inspect,
    async isClosed(key) {
      const observed=await inspect();
      if(observed.key!==key) ambiguous('operation_bus_key_mismatch');
      return observed.closed;
    }
  };
}
module.exports={issueBusClosure};
