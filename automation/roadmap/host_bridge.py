"""No-write bridge for an existing scheduled owner's connected GitHub read.

The authorized host calls github_fetch_issue_comments, writes its complete response to
a temporary JSON file, invokes this process, then removes the temporary file. This
script never posts, saves state, deploys or grants receipt authority to a saved file.
"""
import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from engine import BUS, next_item, digest
from orchestrate import ReadProvider, run_once

class SnapshotProvider(ReadProvider):
    def __init__(self, payload, brand, checkout_root=None):
        repo, number = BUS[brand].split('#')
        if payload.get('sourceTool') != 'github_fetch_issue_comments' or payload.get('repository') != repo or payload.get('issueNumber') != int(number) or payload.get('isError') is not False or payload.get('complete') is not True:
            raise ValueError('snapshot lacks exact successful connected issue identity')
        stamp = datetime.fromisoformat(payload['fetchedAt'].replace('Z','+00:00'))
        now = datetime.now(timezone.utc)
        if stamp.tzinfo is None or stamp > now + timedelta(minutes=2) or stamp < now - timedelta(minutes=15):
            raise ValueError('issue snapshot is stale or lacks UTC time')
        self.snapshot = payload
        self.checkout = checkout_root
    def fetch_issue_comments(self, brand):
        return {'comments':self.snapshot['comments']},True
    def fetch_deployment(self, brand, deployment_id):
        raise ValueError('no connected production deployment read supplied to this dry-run bridge')
    def checkout_root(self, brand):
        if not self.checkout: raise ValueError('no committed checkout supplied to this dry-run bridge')
        return self.checkout


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--brand',choices=('cuai','cai'),required=True)
    parser.add_argument('--state',type=Path,required=True)
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--events',type=Path)
    parser.add_argument('--checkout-root',type=Path)
    args=parser.parse_args()
    state=json.loads(args.state.read_text())
    if state['brand'] != args.brand: raise ValueError('brand/state mismatch')
    payload=json.loads(args.snapshot.read_text())
    provider=SnapshotProvider(payload,args.brand,args.checkout_root)
    events=json.loads(args.events.read_text()) if args.events else []
    proposed,result=run_once(state,events,provider)
    nxt=next_item(proposed)
    print(json.dumps({'brand':args.brand,'next':nxt['id'] if nxt else None,
                      'outbox':{k:v['status'] for k,v in proposed['outbox'].items()},
                      'applied':result['applied'],'blocked':result['blocked'],
                      'reconciled':result['reconciled'],'proposalHash':digest(proposed),
                      'stateWritten':False},sort_keys=True))

if __name__=='__main__':main()
