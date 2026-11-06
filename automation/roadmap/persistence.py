"""Guarded state commit protocol for an authorized host; no connector writes here."""
from engine import digest

class Conflict(Exception):
    pass

class StateStore:
    def read(self, brand):
        """Return (state, opaque revision) from the authoritative store."""
        raise NotImplementedError

    def compare_and_swap(self, brand, revision, state, proposal_hash):
        """Atomically write iff revision matches; return new revision.

        An uncertain network result must raise Conflict, never invite a blind retry.
        """
        raise NotImplementedError


def commit(store, brand, expected_revision, expected_state_hash, proposed):
    """Commit a reduced pass exactly once, or require a fresh read and re-reduction."""
    current, revision = store.read(brand)
    if current['brand'] != brand or proposed['brand'] != brand:
        raise Conflict('brand mismatch')
    proposal_hash = digest(proposed)
    if digest(current) == proposal_hash:
        return revision, 'already-committed'
    if revision != expected_revision or digest(current) != expected_state_hash:
        raise Conflict('state changed; re-read and re-reduce events')
    try:
        return store.compare_and_swap(brand, revision, proposed, proposal_hash), 'committed'
    except Exception as exc:
        latest, latest_revision = store.read(brand)
        if digest(latest) == proposal_hash:
            return latest_revision, 'already-committed'
        raise Conflict('write uncertain or conflicted; reconcile before retry') from exc
