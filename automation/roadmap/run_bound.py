"""One guarded owner pass using a connected read provider and durable CAS store."""
from engine import digest, next_item
from orchestrate import run_once
from persistence import commit


def run_bound(store, provider, brand, events):
    state, revision = store.read(brand)
    original_hash = digest(state)
    proposed, result = run_once(state, events, provider)
    new_revision, write_status = commit(store, brand, revision, original_hash, proposed)
    chosen = next_item(proposed)
    return {'brand': brand, 'revision': new_revision, 'writeStatus': write_status,
            'proposalHash': digest(proposed), 'next': chosen['id'] if chosen else None,
            'applied': result['applied'], 'blocked': result['blocked'],
            'reconciled': result['reconciled'],
            'outbox': {k:v['status'] for k,v in proposed['outbox'].items()}}
