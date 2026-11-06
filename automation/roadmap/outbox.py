"""One-shot issue-bus post under a durable claim and fresh reconciliation."""
from engine import digest, reconcile
from integrations import issue_read
from persistence import Conflict, commit


def _bodies(provider, brand):
    raw, complete = provider.fetch_issue_comments(brand)
    return [c['body'] for c in issue_read(raw, brand, fresh_complete=complete)]


def dispatch_one(store, provider, brand, event_id, post_comment):
    """Claim once before post; uncertain effects require reconciliation or recovery."""
    state, revision = store.read(brand)
    if event_id not in state['outbox']:
        raise ValueError('unknown outbox event')
    before = digest(state)
    state = reconcile(state, event_id, _bodies(provider, brand), fresh_complete=True)
    status = state['outbox'][event_id]['status']
    if status != 'pending':
        commit(store, brand, revision, before, state)
        return status
    claimed = reconcile(state, event_id, [], fresh_complete=False)
    commit(store, brand, revision, before, claimed)
    body = claimed['outbox'][event_id]['body']
    try:
        post_comment(brand, body)
    except Exception:
        # Write may have happened. The durable claim prevents another post.
        pass
    latest, latest_revision = store.read(brand)
    if latest['outbox'][event_id]['status'] != 'uncertain':
        raise Conflict('outbox claim changed after post')
    reconciled = reconcile(latest, event_id, _bodies(provider, brand), fresh_complete=True)
    commit(store, brand, latest_revision, digest(latest), reconciled)
    return reconciled['outbox'][event_id]['status']
