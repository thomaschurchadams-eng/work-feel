import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'automation' / 'roadmap'))
from engine import apply, blank, next_item, reconcile
from receipts import approval as verified_approval_comment

NOW = '2026-10-13'
QA = dict(testCommand='python -m unittest', testResult='passed', artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A')
RELEASE = dict(approvalId='approval-1', deploymentId='deployment-X', artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A', actionClass='public-release', observedAt=NOW, rollbackOwner='owner', rollbackSteps='revert')
COMPLETE = dict(verification='observed exact production', observedAt=NOW, artifactHash='artifact-A', commitSha='commit-A', deploymentId='deployment-X', environment='production')

def approved_receipt(**changes):
    return {**dict(approvalId='approval-1', source='https://github.com/example/issue/1#comment', sourceVerified=True,
                   authority='Tom', scope='dataset-release', actionClass='public-release', itemKey='dataset',
                   artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A', status='active',
                   expiresAt='2026-11-01'), **changes}

def accepted_receipt(item, owner):
    return dict(itemKey=item, owner=owner, receiptId='handoff-1', actionClass='build', sourceVersion='source-A', status='accepted',
                source='https://github.com/example/issue/2#comment', sourceVerified=True)

class RoadmapTest(unittest.TestCase):
    def setUp(self):
        self.s = blank('cuai')
        self.s = apply(self.s, dict(eventId='i1', action='intake', key='dataset', title='Deployment dataset', kind='data-asset', sources=['a'], signals={'goal': 2}))
        self.s = apply(self.s, dict(eventId='i2', action='intake', key='other', title='Other', kind='enhancement', signals={'goal': 1}))
    def event(self, eid, stage, evidence, key='dataset', **kw):
        e = dict(eventId=eid, action='transition', key=key, stage=stage, evidence=evidence, **kw)
        verifier = (lambda _: accepted_receipt(key, self.s['items'][key]['owner'])) if stage == 'building' else None
        qa_verifier = (lambda _: {**evidence, 'source':'local test runner receipt', 'sourceVerified':True}) if stage == 'qa' else None
        self.s = apply(self.s, e, handoff_verifier=verifier, qa_verifier=qa_verifier)
    def build_to_gate(self):
        self.event('r','ranked',dict(source='report', observedAt=NOW, finding='qualified'))
        self.event('b','building',dict(acceptedHandoff='handoff-1',acceptedBy=self.s['items']['dataset']['owner'],scope='bounded',sourceVersion='source-A'))
        self.event('q','qa',QA)
        self.event('g','blocked-release',dict(gate='approval',releaseOwner='Tom'))
    def approval(self, receipt=None):
        e=dict(eventId='a',action='approval',key='dataset',scope='dataset-release',actionClass='public-release',observedAt=NOW,evidence={'approvalId':'approval-1'})
        self.s=apply(self.s,e,approval_verifier=lambda _: receipt or approved_receipt())
    def test_full_dry_run_prior_approval_reuse_and_completion(self):
        self.build_to_gate()
        with self.assertRaisesRegex(ValueError,'missing release authority'):
            self.event('bad','released',RELEASE,scope='dataset-release')
        self.approval()
        self.event('rel','released',RELEASE,scope='dataset-release')
        self.event('done','verified-complete',COMPLETE)
        self.assertEqual(self.s['items']['dataset']['stage'],'verified-complete')
        self.assertEqual(next_item(self.s)['id'],'other')
    def test_duplicate_intake_and_identity_collision(self):
        e=dict(eventId='x',action='intake',key='dataset',title='Deployment dataset',kind='data-asset',sources=['b'])
        once=apply(self.s,e)
        self.assertEqual(apply(once,e),once)
        with self.assertRaisesRegex(ValueError,'collision'):
            apply(once,{**e,'title':'changed'})
    def test_one_active_and_safe_reprioritization(self):
        self.event('r','ranked',dict(source='report',observedAt=NOW,finding='good'))
        self.event('b','building',dict(acceptedHandoff='handoff-1',acceptedBy=self.s['items']['dataset']['owner'],scope='bounded',sourceVersion='source-A'))
        newer=apply(self.s,dict(eventId='strong',action='evidence',key='other',evidence=dict(source='report',observedAt=NOW),signals={'goal':99}))
        self.assertIsNone(next_item(newer))
        newer=apply(newer,dict(eventId='other-rank',action='transition',key='other',stage='ranked',evidence=dict(source='report',observedAt=NOW,finding='good')))
        with self.assertRaisesRegex(ValueError,'one active'):
            apply(newer,dict(eventId='other-build',action='transition',key='other',stage='building',evidence=dict(acceptedHandoff='handoff-1',acceptedBy=newer['items']['other']['owner'],scope='bounded',sourceVersion='source-A')),handoff_verifier=lambda _: accepted_receipt('other',newer['items']['other']['owner']))
    def test_active_safe_checkpoint_preserves_history_and_recovery(self):
        self.event('r','ranked',dict(source='report',observedAt=NOW,finding='good'))
        self.event('b','building',dict(acceptedHandoff='handoff-1',acceptedBy=self.s['items']['dataset']['owner'],scope='bounded',sourceVersion='source-A'))
        e=dict(eventId='defer',action='override',key='dataset',choice='defer',authority='Tom',reason='new priority')
        with self.assertRaisesRegex(ValueError,'safe checkpoint'): apply(self.s,e)
        s=apply(self.s,e,checkpoint_verifier=lambda _: dict(itemKey='dataset',owner=self.s['items']['dataset']['owner'],status='accepted',source='owner checkpoint',sourceVerified=True,recoveryOwner='reliability-watch',artifactHash='artifact-A'))
        self.assertEqual(s['items']['dataset']['stage'],'deferred')
        self.assertEqual(next_item(s)['id'],'other')
        self.assertEqual(s['items']['dataset']['history'][-2]['stage'],'safe-checkpoint')
        self.assertEqual(len(s['decisions']),1)
    def test_reconciliation_preserves_ambiguity_and_exact_identity(self):
        self.event('r','ranked',dict(source='report',observedAt=NOW,finding='good'))
        self.event('b','building',dict(acceptedHandoff='handoff-1',acceptedBy=self.s['items']['dataset']['owner'],scope='bounded',sourceVersion='source-A'))
        body=self.s['outbox']['b']['body']
        self.assertEqual(reconcile(self.s,'b',[])['outbox']['b']['status'],'uncertain')
        self.assertEqual(reconcile(self.s,'b',[body],fresh_complete=True)['outbox']['b']['status'],'confirmed')
        confirmed=reconcile(self.s,'b',[body],fresh_complete=True)
        self.assertEqual(reconcile(confirmed,'b',[],fresh_complete=False)['outbox']['b']['status'],'confirmed')
        self.assertEqual(reconcile(confirmed,'b',[],fresh_complete=True)['outbox']['b']['status'],'confirmed')
        conflict=reconcile(self.s,'b',[body,body],fresh_complete=True)
        self.assertEqual(reconcile(conflict,'b',[],fresh_complete=True)['outbox']['b']['status'],'conflict')
        misleading=body.replace('eventId: b','eventId: b2')
        self.assertEqual(reconcile(self.s,'b',[misleading],fresh_complete=True)['outbox']['b']['status'],'pending')
        self.assertEqual(reconcile(conflict,'b',[],recovery_receipt=dict(eventId='b',status='resolved',source='owner check',posted=False))['outbox']['b']['status'],'pending')
    def test_stale_evidence_unknown_source_and_user_next(self):
        s=apply(self.s,dict(eventId='choice',action='override',key='other',choice='next',authority='Tom',reason='October PRODUCT direction'))
        s=apply(s,dict(eventId='new',action='evidence',key='dataset',evidence=dict(source='report',observedAt=NOW),signals={'goal':5}))
        s=apply(s,dict(eventId='old',action='evidence',key='dataset',evidence=dict(source='stale report',observedAt='2026-09-30'),signals={'goal':99}))
        self.assertEqual(s['items']['dataset']['signals']['goal'],5)
        self.assertEqual(next_item(s)['id'],'other')
        unknown=apply(s,dict(eventId='unavailable',action='evidence',key='other',evidence=dict(source='analytics unavailable',observedAt='2026-10-14')))
        self.assertEqual(unknown['items']['other']['signals'],self.s['items']['other']['signals'])
    def test_failed_qa_and_wrong_version_or_deployment_fail(self):
        self.event('r','ranked',dict(source='report',observedAt=NOW,finding='good'))
        self.event('b','building',dict(acceptedHandoff='handoff-1',acceptedBy=self.s['items']['dataset']['owner'],scope='bounded',sourceVersion='source-A'))
        with self.assertRaisesRegex(ValueError,'failed QA'):
            self.event('failed','qa',{**QA,'testResult':'failed'})
        with self.assertRaisesRegex(ValueError,'QA source version'):
            self.event('wrong-source','qa',{**QA,'sourceVersion':'source-B'})
        with self.assertRaisesRegex(ValueError,'verified exact-version test receipt'):
            apply(self.s,dict(eventId='unverified-qa',action='transition',key='dataset',stage='qa',evidence=QA))
        self.event('q','qa',QA)
        self.event('g','blocked-release',dict(gate='approval',releaseOwner='Tom'))
        self.approval()
        with self.assertRaisesRegex(ValueError,'tested artifact'):
            self.event('wrong','released',{**RELEASE,'commitSha':'commit-B'},scope='dataset-release')
        self.event('rel','released',RELEASE,scope='dataset-release')
        for evidence,error in [({**COMPLETE,'artifactHash':'old'},'tested QA'),({**COMPLETE,'environment':'preview'},'preview'),({**COMPLETE,'deploymentId':'deployment-Y'},'released deployment')]:
            with self.assertRaisesRegex(ValueError,error): self.event('bad-'+error,'verified-complete',evidence)
    def test_unverified_revoked_expired_or_changed_approval_fails(self):
        self.build_to_gate()
        e=dict(eventId='a',action='approval',key='dataset',scope='dataset-release',actionClass='public-release',observedAt=NOW,evidence={'approvalId':'approval-1'})
        with self.assertRaisesRegex(ValueError,'source verification'): apply(self.s,e)
        for changed,error in [({'sourceVerified':False},'unverified approval source'),({'scope':'marketing'},'requested item'),({'actionClass':'training'},'requested item'),({'sourceVersion':'source-B'},'tested artifact'),({'status':'revoked'},'not active'),({'expiresAt':'2026-10-01'},'expired')]:
            with self.assertRaisesRegex(ValueError,error): apply(self.s,e,approval_verifier=lambda _,changed=changed: approved_receipt(**changed))
        self.approval()
        revoked=apply(self.s,dict(eventId='revoke',action='revoke-approval',key='dataset'),approval_verifier=lambda _:dict(approvalId='approval-1',status='revoked',source='authoritative revocation',sourceVerified=True))
        with self.assertRaisesRegex(ValueError,'missing release authority'):
            apply(revoked,dict(eventId='rel',action='transition',key='dataset',stage='released',scope='dataset-release',evidence=RELEASE))
        with self.assertRaisesRegex(ValueError,'missing release authority'):
            self.event('marketing','released',{**RELEASE,'actionClass':'training'},scope='dataset-release')
    def test_enabled_owner_and_authoritative_handoff(self):
        with self.assertRaisesRegex(ValueError,'enabled existing role'):
            apply(blank('cai'),dict(eventId='x',action='intake',key='product',title='PRODUCT',kind='enhancement',owner='disabled-pm'))
        s=blank('cai')
        s=apply(s,dict(eventId='c1',action='intake',key='product',title='PRODUCT',kind='enhancement'))
        s=apply(s,dict(eventId='c2',action='transition',key='product',stage='ranked',evidence=dict(source='decision',observedAt=NOW,finding='selected')))
        e=dict(eventId='c3',action='transition',key='product',stage='building',evidence=dict(acceptedHandoff='handoff-1',acceptedBy=s['items']['product']['owner'],scope='private',sourceVersion='source-A'))
        with self.assertRaisesRegex(ValueError,'authoritative receiving-owner receipt'): apply(s,e)
        with self.assertRaisesRegex(ValueError,'unverified handoff source'): apply(s,e,handoff_verifier=lambda _: {**accepted_receipt('product',s['items']['product']['owner']),'sourceVerified':False})
        with self.assertRaisesRegex(ValueError,'authoritative receiving-owner receipt'): apply(s,e,handoff_verifier=lambda _: {**accepted_receipt('product',s['items']['product']['owner']),'sourceVersion':'source-B'})
        with self.assertRaisesRegex(ValueError,'authoritative receiving-owner receipt'): apply(s,e,handoff_verifier=lambda _: {**accepted_receipt('product',s['items']['product']['owner']),'actionClass':'launch'})
        s=apply(s,e,handoff_verifier=lambda _:accepted_receipt('product',s['items']['product']['owner']))
        self.assertEqual(s['outbox']['c3']['destination'],'thomaschurchadams-eng/cooperative-ai-institute-rebuild#12')
    def test_approval_comment_adapter_rejects_wrong_issue_or_author(self):
        body='\n'.join(f'{k}: {v}' for k,v in approved_receipt().items() if k in ('approvalId','itemKey','actionClass','scope','artifactHash','commitSha','sourceVersion','status'))
        good=dict(html_url='https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-123',user={'login':'thomaschurchadams-eng'},body=body)
        self.assertEqual(verified_approval_comment(good,'cuai')['artifactHash'],'artifact-A')
        with self.assertRaisesRegex(ValueError,'authoritative issue'):
            verified_approval_comment({**good,'user':{'login':'someone-else'}},'cuai')
        with self.assertRaisesRegex(ValueError,'authoritative issue'):
            verified_approval_comment({**good,'html_url':'https://github.com/thomaschurchadams-eng/work-feel/issues/161#issuecomment-123'},'cuai')

    def test_evidence_required(self):
        with self.assertRaisesRegex(ValueError,'stage evidence'): self.event('r','ranked',{})

if __name__=='__main__': unittest.main()
