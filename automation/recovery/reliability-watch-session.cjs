'use strict';

const { recover } = require('./checkpointed-recovery.cjs');
const { gitRefCheckpointStore } = require('./git-ref-checkpoint-store.cjs');
const { githubConnectorBinding } = require('./github-connector-binding.cjs');
const { issueBusClosure } = require('./issue-bus-closure.cjs');

// One bounded invocation by the existing Reliability Watch owner. This is a
// callable integration, not a scheduler or an operations workflow.
async function reliabilityWatchSession({ tools, repository, issueNumber = 160,
  checkpointBranch, checkpointPath, executionId, executionStatus,
  operation, steps, closeBusKey, casVerified = false }) {
  if (!tools || !repository || !checkpointBranch || !checkpointPath ||
      typeof executionId !== 'string' || executionId.length < 8 ||
      typeof executionStatus !== 'function' || typeof closeBusKey !== 'function' ||
      !operation?.runId || !operation?.deploymentSha || !Array.isArray(steps) || !steps.length)
    throw Error('invalid_reliability_watch_session');
  if (typeof tools.mcp__codex_apps__github_fetch_issue_comments !== 'function')
    throw Error('issue_read_unavailable');
  if (typeof tools.mcp__codex_apps__github_create_blob !== 'function')
    throw Error('checkpoint_id_source_unavailable');

  const bus = issueBusClosure({ repository, issueNumber,
    runId: String(operation.runId), deploymentSha: operation.deploymentSha,
    readComments: async () => {
      const response = await tools.mcp__codex_apps__github_fetch_issue_comments({
        repo_full_name: repository, issue_number: issueNumber });
      if (response?.isError || !Array.isArray(response?.structuredContent?.comments))
        throw Object.assign(Error('issue_read_unconfirmed'), { code: 'AMBIGUOUS_OUTCOME' });
      return response.structuredContent.comments;
    }
  });
  const mapped = await bus.inspect(); // Missing or conflicting evidence blocks before lease/write.
  if (mapped.closed) return { key: mapped.key, status: 'completed', alreadyClosed: true,
    blockerCommentId: mapped.blockerCommentId, completionCommentId: mapped.completionCommentId };

  const binding = githubConnectorBinding({ tools, repository,
    branch: checkpointBranch, path: checkpointPath });
  let idCounter=0;
  const newId=async()=>{
    // An unreferenced Git blob supplies an opaque unique token in the task
    // tool runtime, where Node's crypto API is not directly exposed.
    const result=await tools.mcp__codex_apps__github_create_blob({
      repository_full_name:repository,encoding:'utf-8',
      content:`recovery-token:${executionId}:${Date.now()}:${++idCounter}:${Math.random()}`
    });
    const sha=result?.structuredContent?.sha;
    if(result?.isError || !/^[0-9a-f]{40}$/.test(sha||'')) throw Error('checkpoint_id_unconfirmed');
    return sha;
  };
  const store = gitRefCheckpointStore({ ...binding, executionId,
    ownerLive: executionStatus, newId, casVerified });
  const state = await recover({ key: mapped.key, steps, ...store,
    isClosed: bus.isClosed,
    close: async key => {
      if (key !== mapped.key) throw Object.assign(Error('bus_key_mismatch'), { code: 'AMBIGUOUS_OUTCOME' });
      // The caller's existing owner writer must be idempotent for this key.
      return closeBusKey({ key, blockerCommentId: mapped.blockerCommentId,
        operation });
    }
  });
  return { ...state, blockerCommentId: mapped.blockerCommentId };
}

module.exports = { reliabilityWatchSession };
