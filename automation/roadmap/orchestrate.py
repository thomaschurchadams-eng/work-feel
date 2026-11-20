"""One bounded roadmap pass under an existing owner run. No posting or deployment.

`provider` is supplied by a host that can call connected, read-only GitHub and
production tools. Standalone Python/gh has no authorized connector access here.
"""
from engine import apply, reconcile
from integrations import issue_read, approval_from_issue, handoff_from_issue, qa_run, deployment_read, receipt_from_issue

class ReadProvider:
    def fetch_issue_comments(self, brand):
        """Return (structuredContent, fresh_complete) from connected GitHub read."""
        raise NotImplementedError
    def fetch_deployment(self, brand, deployment_id):
        """Return exact environment, state, commit, artifact, id and source."""
        raise NotImplementedError
    def checkout_root(self, brand):
        """Return exact checked-out, committed repository root for local QA."""
        raise NotImplementedError


def run_once(state, events, provider):
    """Reduce one read-only pass; return candidate state and precise blocked events."""
    state = state.copy()
    brand = state['brand']
    result = {'applied': [], 'blocked': [], 'reconciled': []}
    try:
        raw, complete = provider.fetch_issue_comments(brand)
        comments = issue_read(raw, brand, fresh_complete=complete)
        bodies = [c['body'] for c in comments]
        for event_id in tuple(state['outbox']):
            state = reconcile(state,event_id,bodies,fresh_complete=True)
            result['reconciled'].append((event_id,state['outbox'][event_id]['status']))
    except Exception as exc:
        # Coordination degradation does not authorize new stage transitions.
        comments = None
        result['blocked'].append(('issue-read',str(exc)))
    for event in events:
        try:
            action = event['action']
            if action == 'recover-outbox':
                raw, complete = provider.fetch_issue_comments(brand)
                found = issue_read(raw,brand,fresh_complete=complete)
                def recovery_verifier(_):
                    raw_latest, complete_latest = provider.fetch_issue_comments(brand)
                    latest = issue_read(raw_latest,brand,fresh_complete=complete_latest)
                    return receipt_from_issue(latest,brand,event['commentId'],'recovery')
                state = reconcile(state,event['targetEventId'],[],recovery_receipt=event,recovery_verifier=recovery_verifier)
                result['applied'].append(event['eventId'])
                continue
            stage = event.get('stage')
            evidence = event.get('evidence',{})
            def fresh_approval(_):
                raw, complete = provider.fetch_issue_comments(brand)
                found = issue_read(raw,brand,fresh_complete=complete)
                return approval_from_issue(found,brand,evidence['commentId'])
            def fresh_handoff(_):
                raw, complete = provider.fetch_issue_comments(brand)
                found = issue_read(raw,brand,fresh_complete=complete)
                return handoff_from_issue(found,brand,evidence['commentId'],'thomaschurchadams-eng')
            def verified_decision(_):
                raw, complete = provider.fetch_issue_comments(brand)
                found = issue_read(raw,brand,fresh_complete=complete)
                return receipt_from_issue(found,brand,evidence.get('decisionCommentId') or evidence['commentId'],'decision')
            def verified_checkpoint(_):
                raw, complete = provider.fetch_issue_comments(brand)
                found = issue_read(raw,brand,fresh_complete=complete)
                return receipt_from_issue(found,brand,evidence['commentId'],'checkpoint')
            def verified_qa(_):
                return qa_run(provider.checkout_root(brand),brand,evidence['artifactPath'],evidence['sourceVersion'])
            def verified_deployment(_):
                return deployment_read(provider.fetch_deployment(brand,evidence['deploymentId']),evidence)
            if action in ('approval','revoke-approval') or stage == 'released':
                if comments is None: raise ValueError('issue read unavailable')
            if stage == 'building' and comments is None: raise ValueError('issue read unavailable')
            state = apply(state,event,
                approval_verifier=fresh_approval if action in ('approval','revoke-approval') or stage == 'released' else None,
                handoff_verifier=fresh_handoff if stage == 'building' else None,
                checkpoint_verifier=verified_checkpoint if action == 'override' and event.get('choice') in ('defer','reject') else None,
                decision_verifier=verified_decision if action == 'override' else None,
                qa_verifier=verified_qa if stage == 'qa' else None,
                deployment_verifier=verified_deployment if stage in ('released','verified-complete') else None)
            result['applied'].append(event['eventId'])
        except Exception as exc:
            result['blocked'].append((event.get('eventId','unknown'),str(exc)))
    return state,result
