"""Durable roadmap state on an exact GitHub branch via connected Contents actions.

The owner host supplies authorized fetch_file and update_file callables. This module
never obtains credentials or writes by itself. GitHub's required blob SHA is the
compare-and-swap revision; the host must not replace that SHA after a conflict.
"""
import json
from engine import BUS, digest
from persistence import Conflict, StateStore

PATH = {'cuai': 'automation/product-roadmap/state.json',
        'cai': 'operations/product-roadmap/state.json'}

class GithubContentsStateStore(StateStore):
    def __init__(self, branch, fetch_file, update_file):
        if not branch or not callable(fetch_file) or not callable(update_file):
            raise ValueError('exact branch and connected actions required')
        self.branch = branch
        self.fetch_file = fetch_file
        self.update_file = update_file

    def _address(self, brand):
        repo, _ = BUS[brand].split('#')
        return repo, PATH[brand]

    def read(self, brand):
        repo, path = self._address(brand)
        result = self.fetch_file(repository_full_name=repo, path=path, ref=self.branch)
        if result.get('isError') or not result.get('sha') or result.get('encoding') != 'utf-8':
            raise Conflict('complete connected state read required')
        state = json.loads(result['content'])
        if state.get('brand') != brand or state.get('schema') != 1:
            raise Conflict('state identity or schema mismatch')
        return state, result['sha']

    def compare_and_swap(self, brand, revision, state, proposal_hash):
        repo, path = self._address(brand)
        if state.get('brand') != brand or digest(state) != proposal_hash:
            raise Conflict('proposal identity mismatch')
        payload = json.dumps(state, indent=2, sort_keys=True) + '\n'
        result = self.update_file(repository_full_name=repo, path=path,
            branch=self.branch, sha=revision, content=payload,
            message=f'Advance {brand.upper()} roadmap state at guarded checkpoint')
        if result.get('isError'):
            raise Conflict('connected state write failed or uncertain')
        new_sha = result.get('content_sha') or result.get('content',{}).get('sha')
        if not new_sha:
            # The write may have succeeded; persistence.commit will re-read.
            raise Conflict('connected state write lacks new revision')
        return new_sha
