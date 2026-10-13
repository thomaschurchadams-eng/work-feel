import sys
import unittest
import subprocess
import tempfile
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'automation' / 'roadmap'))
from engine import apply, blank, next_item, reconcile, digest
from receipts import approval as verified_approval_comment
from integrations import issue_read, approval_from_issue, deployment_read, qa_run, QA_COMMANDS, vercel_list_result
from orchestrate import run_once
from host_bridge import SnapshotProvider, require_planning_events

NOW = '2026-10-13'
QA = dict(testCommand='python -m unittest', testResult='passed', artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A')
RELEASE = dict(approvalId='approval-1', deploymentId='deployment-X', artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A', actionClass='public-release', observedAt=NOW, rollbackOwner='owner', rollbackSteps='revert')
COMPLETE = dict(verification='observed exact production', observedAt=NOW, artifactHash='artifact-A', commitSha='commit-A', deploymentId='deployment-X', environment='production')

def approved_receipt(**changes):
    return {**dict(approvalId='approval-1', source='https://github.com/example/issue/1#comment', sourceVerified=True,
                   authority='Tom', scope='dataset-release', actionClass='public-release', itemKey='dataset',
                   artifactHash='artifact-A', commitSha='commit-A', sourceVersion='source-A', status='active',
                   expiresAt='2026-11-01'), **changes}

def decision_receipt(item, choice):
    return dict(itemKey=item,choice=choice,authority='Tom',status='approved',source='verified owner decision',sourceVerified=True)

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
        deployment_verifier = (lambda _: {**evidence, 'source':'production deployment receipt', 'sourceVerified':True}) if stage in ('released','verified-complete') else None
        fresh_approval = (lambda _: approved_receipt()) if stage == 'released' else None
        self.s = apply(self.s, e, handoff_verifier=verifier, qa_verifier=qa_verifier, deployment_verifier=deployment_verifier, approval_verifier=fresh_approval)
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
        with self.assertRaisesRegex(ValueError,'safe checkpoint'): apply(self.s,e,decision_verifier=lambda _:decision_receipt('dataset','defer'))
        s=apply(self.s,e,decision_verifier=lambda _:decision_receipt('dataset','defer'),checkpoint_verifier=lambda _: dict(itemKey='dataset',owner=self.s['items']['dataset']['owner'],status='accepted',source='owner checkpoint',sourceVerified=True,recoveryOwner='reliability-watch',artifactHash='artifact-A'))
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
        with self.assertRaisesRegex(ValueError,'invalid authoritative recovery receipt'):
            reconcile(conflict,'b',[],recovery_receipt=dict(eventId='b',status='resolved',source='owner check',posted=False))
        key='roadmap:cuai:dataset'
        recovery=dict(eventId='b',dedupeKey=key,owner=self.s['items']['dataset']['owner'],bodyHash=digest(body),priorStatus='conflict',status='resolved',source='owner check',sourceVerified=True,observedAt=NOW,posted=False)
        self.assertEqual(reconcile(conflict,'b',[],recovery_receipt=recovery,recovery_verifier=lambda _: recovery)['outbox']['b']['status'],'pending')
    def test_stale_evidence_unknown_source_and_user_next(self):
        choice=dict(eventId='choice',action='override',key='other',choice='next',authority='Tom',reason='October PRODUCT direction')
        with self.assertRaisesRegex(ValueError,'authoritative Tom decision'):
            apply(self.s,choice)
        s=apply(self.s,choice,decision_verifier=lambda _:decision_receipt('other','next'))
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
        with self.assertRaisesRegex(ValueError,'authoritative deployment receipt'):
            apply(self.s,dict(eventId='unverified-release',action='transition',key='dataset',stage='released',scope='dataset-release',evidence=RELEASE),approval_verifier=lambda _:approved_receipt())
        with self.assertRaisesRegex(ValueError,'tested artifact'):
            self.event('wrong','released',{**RELEASE,'commitSha':'commit-B'},scope='dataset-release')
        self.event('rel','released',RELEASE,scope='dataset-release')
        for evidence,error in [({**COMPLETE,'artifactHash':'old'},'tested QA'),({**COMPLETE,'environment':'preview'},'preview'),({**COMPLETE,'deploymentId':'deployment-Y'},'released deployment')]:
            with self.assertRaisesRegex(ValueError,error): self.event('bad-'+error,'verified-complete',evidence)
    def test_rebuild_requires_new_version_bound_handoff(self):
        self.build_to_gate()
        e=dict(eventId='rebuild',action='transition',key='dataset',stage='building',
               evidence=dict(acceptedHandoff='handoff-2',acceptedBy=self.s['items']['dataset']['owner'],scope='changed',sourceVersion='source-B'))
        with self.assertRaisesRegex(ValueError,'authoritative receiving-owner receipt'):
            apply(self.s,e,handoff_verifier=lambda _:accepted_receipt('dataset',self.s['items']['dataset']['owner']))
        new={**accepted_receipt('dataset',self.s['items']['dataset']['owner']),'receiptId':'handoff-2','sourceVersion':'source-B'}
        s=apply(self.s,e,handoff_verifier=lambda _:new)
        self.assertEqual(s['items']['dataset']['stage'],'building')
        self.assertEqual(s['items']['dataset']['history'][-1]['evidence']['sourceVersion'],'source-B')

    def test_revocation_between_registration_and_release(self):
        self.build_to_gate()
        self.approval()
        e=dict(eventId='rel',action='transition',key='dataset',stage='released',scope='dataset-release',evidence=RELEASE)
        with self.assertRaisesRegex(ValueError,'fresh authoritative approval'):
            apply(self.s,e,approval_verifier=lambda _:approved_receipt(status='revoked'),
                  deployment_verifier=lambda _:{**RELEASE,'source':'production','sourceVerified':True})

    def test_unverified_revoked_expired_or_changed_approval_fails(self):
        self.build_to_gate()
        e=dict(eventId='a',action='approval',key='dataset',scope='dataset-release',actionClass='public-release',observedAt=NOW,evidence={'approvalId':'approval-1'})
        with self.assertRaisesRegex(ValueError,'source verification'): apply(self.s,e)
        for changed,error in [({'sourceVerified':False},'unverified approval source'),({'scope':'marketing'},'requested item'),({'actionClass':'training'},'requested item'),({'sourceVersion':'source-B'},'tested artifact'),({'status':'revoked'},'not active'),({'expiresAt':'2026-10-01'},'expired')]:
            with self.assertRaisesRegex(ValueError,error): apply(self.s,e,approval_verifier=lambda _,changed=changed: approved_receipt(**changed))
        self.approval()
        revoked=apply(self.s,dict(eventId='revoke',action='revoke-approval',key='dataset'),approval_verifier=lambda _:dict(approvalId='approval-1',status='revoked',source='authoritative revocation',sourceVerified=True))
        with self.assertRaisesRegex(ValueError,'fresh authoritative approval'):
            apply(revoked,dict(eventId='rel',action='transition',key='dataset',stage='released',scope='dataset-release',evidence=RELEASE),approval_verifier=lambda _:approved_receipt(status='revoked'))
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
        good=dict(url='https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-123',user={'login':'thomaschurchadams-eng'},body=body)
        self.assertEqual(verified_approval_comment(good,'cuai')['artifactHash'],'artifact-A')
        with self.assertRaisesRegex(ValueError,'authoritative issue'):
            verified_approval_comment({**good,'user':{'login':'someone-else'}},'cuai')
        with self.assertRaisesRegex(ValueError,'authoritative issue'):
            verified_approval_comment({**good,'url':'https://github.com/thomaschurchadams-eng/work-feel/issues/161#issuecomment-123'},'cuai')

    def test_snapshot_bridge_rejects_protected_events(self):
        require_planning_events([dict(action='intake'),dict(action='transition',stage='ranked')])
        for action in (dict(action='approval'),dict(action='override'),dict(action='transition',stage='building'),dict(action='transition',stage='released')):
            with self.assertRaisesRegex(ValueError,'planning events only'):
                require_planning_events([action])

    def test_host_bridge_requires_fresh_exact_connected_snapshot(self):
        now=datetime.now(timezone.utc)
        payload=dict(sourceTool='github_fetch_issue_comments',repository='thomaschurchadams-eng/work-feel',
                     issueNumber=160,isError=False,complete=True,fetchedAt=now.isoformat(),comments=[])
        self.assertEqual(SnapshotProvider(payload,'cuai').fetch_issue_comments('cuai')[1],True)
        for bad in ({'complete':False},{'issueNumber':161},{'repository':'other/repo'},
                    {'fetchedAt':(now-timedelta(hours=1)).isoformat()},{'isError':True}):
            with self.assertRaises(ValueError): SnapshotProvider({**payload,**bad},'cuai')

    def test_qa_rejects_dirty_inputs_and_mutation(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            subprocess.run(('git','init','-q'),cwd=root,check=True)
            for name in ('artifact.json','src.py','tests_case.py','package.json'):
                (root/name).write_text('baseline')
            (root/'.gitignore').write_text('.env\ndist/\n')
            subprocess.run(('git','add','.'),cwd=root,check=True)
            subprocess.run(('git','-c','user.name=Test','-c','user.email=test@example.invalid',
                            'commit','-qm','baseline'),cwd=root,check=True)
            head=subprocess.run(('git','rev-parse','HEAD'),cwd=root,capture_output=True,text=True,check=True).stdout.strip()
            with patch.dict(QA_COMMANDS,{'cuai':(('python3','-c','print("pass")'),)}):
                self.assertEqual(qa_run(root,'cuai','artifact.json',head)['commitSha'],head)
                for name in ('src.py','tests_case.py','package.json'):
                    (root/name).write_text('dirty')
                    with self.assertRaisesRegex(ValueError,'dirty input'):
                        qa_run(root,'cuai','artifact.json',head)
                    (root/name).write_text('baseline')
            with patch.dict(QA_COMMANDS,{'cuai':(('python3','-c',"from pathlib import Path; Path('src.py').write_text('mutated')"),)}):
                with self.assertRaisesRegex(ValueError,'dirty input'):
                    qa_run(root,'cuai','artifact.json',head)
            (root/'src.py').write_text('baseline')
            with patch.dict(QA_COMMANDS,{'cuai':(('python3','-c',"from pathlib import Path; p=Path('__pycache__/generated.pyc'); p.parent.mkdir(exist_ok=True); p.write_bytes(b'generated')"),)}):
                self.assertEqual(qa_run(root,'cuai','artifact.json',head)['testResult'],'passed')
            generated=root/'dist'/'generated.json'
            generated.parent.mkdir()
            generated.write_text('generated')
            with patch.dict(QA_COMMANDS,{'cuai':(('python3','-c','print(1)'),)}):
                with self.assertRaisesRegex(ValueError,'Git tracked'):
                    qa_run(root,'cuai','dist/generated.json',head)
            (root/'.env').write_text('unexpected ignored file')
            with patch.dict(QA_COMMANDS,{'cuai':(('python3','-c','print(1)'),)}):
                with self.assertRaisesRegex(ValueError,'unexpected ignored input'):
                    qa_run(root,'cuai','artifact.json',head)

    def test_qa_command_contracts(self):
        for brand, commands in QA_COMMANDS.items():
            self.assertTrue(commands)
            self.assertTrue(all(isinstance(cmd,tuple) and cmd[0] in ('python3','npm','node','./node_modules/.bin/vinext','./node_modules/.bin/eslint') for cmd in commands),brand)

    def test_connected_read_contracts_fail_closed(self):
        body='\n'.join(f'{k}: {v}' for k,v in approved_receipt().items() if k in ('approvalId','itemKey','actionClass','scope','artifactHash','commitSha','sourceVersion','status'))
        comment=dict(id=123,url='https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-123',user={'login':'thomaschurchadams-eng'},body=body)
        comments=issue_read({'comments':[comment]},'cuai',fresh_complete=True)
        self.assertEqual(approval_from_issue(comments,'cuai',123)['approvalId'],'approval-1')
        with self.assertRaisesRegex(ValueError,'fresh complete'): issue_read({'comments':[comment]},'cuai',fresh_complete=False)
        with self.assertRaisesRegex(ValueError,'outside authoritative issue'):
            issue_read({'comments':[{**comment,'url':comment['url'].replace('/160#','/161#')}]},'cuai',fresh_complete=True)
        with self.assertRaisesRegex(ValueError,'missing or ambiguous'): approval_from_issue(comments,'cuai',999)
        expected=dict(deploymentId='deployment-X',commitSha='commit-A',artifactHash='artifact-A')
        actual={**expected,'environment':'production','state':'READY','source':'trusted Vercel read'}
        self.assertEqual(deployment_read(actual,expected)['sourceVerified'],True)
        with self.assertRaisesRegex(ValueError,'differs'): deployment_read({**actual,'commitSha':'wrong'},expected)
        with self.assertRaisesRegex(ValueError,'not READY'): deployment_read({**actual,'environment':'preview'},expected)
        with self.assertRaisesRegex(ValueError,'exact identity'): deployment_read({'state':'READY'},expected)
        preview={'result':{'deployments':{'deployments':[dict(id='deployment-X',state='READY',target=None,meta={'githubCommitSha':'commit-A'})]}}}
        with self.assertRaisesRegex(ValueError,'READY production'):
            vercel_list_result(preview,expected)
        production={'result':{'deployments':{'deployments':[dict(id='deployment-X',state='READY',target='production',meta={'githubCommitSha':'commit-A'})]}}}
        with self.assertRaisesRegex(ValueError,'artifact proof unavailable'):
            vercel_list_result(production,expected)
        proof=dict(deploymentId='deployment-X',artifactHash='artifact-A',sourceVerified=True)
        self.assertEqual(vercel_list_result(production,expected,proof)['sourceVerified'],True)
        with self.assertRaisesRegex(ValueError,'checkout HEAD changed'):
            qa_run(Path(__file__).resolve().parents[2],'cuai','automation/publishing-rules.json','stale-commit')

    def test_orchestrator_uses_fresh_owner_receipt_and_blocks_missing_one(self):
        s=apply(self.s,dict(eventId='r',action='transition',key='dataset',stage='ranked',evidence=dict(source='report',observedAt=NOW,finding='qualified')))
        body='\n'.join((f'itemKey: dataset',f'owner: {s["items"]["dataset"]["owner"]}',
                         'receiptId: handoff-1','actionClass: build','sourceVersion: source-A','status: accepted'))
        comment=dict(id=123,url='https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-123',
                     user={'login':'thomaschurchadams-eng'},body=body)
        class Provider:
            def __init__(self, comments): self.comments=comments
            def fetch_issue_comments(self, brand): return {'comments':self.comments},True
            def fetch_deployment(self, brand, deployment_id): raise AssertionError('no deployment read')
            def checkout_root(self, brand): raise AssertionError('no QA checkout')
        event=dict(eventId='build',action='transition',key='dataset',stage='building',
                   evidence=dict(acceptedHandoff='handoff-1',acceptedBy=s['items']['dataset']['owner'],
                                 scope='bounded',sourceVersion='source-A',commentId=123))
        advanced,result=run_once(s,[event],Provider([comment]))
        self.assertEqual(result['applied'],['build'])
        self.assertEqual(advanced['items']['dataset']['stage'],'building')
        unchanged,blocked=run_once(s,[event],Provider([]))
        self.assertEqual(unchanged['items']['dataset']['stage'],'ranked')
        self.assertIn('missing or ambiguous',blocked['blocked'][0][1])
        class Partial(Provider):
            def fetch_issue_comments(self, brand): return {'comments':[comment]},False
        unchanged,blocked=run_once(s,[event],Partial([comment]))
        self.assertEqual(unchanged['items']['dataset']['stage'],'ranked')

    def test_evidence_required(self):
        with self.assertRaisesRegex(ValueError,'stage evidence'): self.event('r','ranked',{})

if __name__=='__main__': unittest.main()

class IntegrationBoundaryTest(unittest.TestCase):
    def test_guarded_commit_conflict_uncertain_write_and_idempotence(self):
        from persistence import commit, Conflict
        class Store:
            def __init__(self, state): self.state=state; self.rev=1; self.uncertain=False
            def read(self, brand): return self.state,self.rev
            def compare_and_swap(self, brand, revision, state, proposal_hash):
                if revision != self.rev: raise Conflict('revision changed')
                self.state=state; self.rev+=1
                if self.uncertain: raise TimeoutError('response lost')
                return self.rev
        base=blank('cuai'); proposal=apply(base,dict(eventId='i',action='intake',key='one',kind='enhancement',title='One'))
        store=Store(base)
        self.assertEqual(commit(store,'cuai',1,digest(base),proposal)[1],'committed')
        self.assertEqual(commit(store,'cuai',1,digest(base),proposal)[1],'already-committed')
        with self.assertRaises(Conflict): commit(store,'cuai',1,digest(base),base)
        second=apply(proposal,dict(eventId='j',action='intake',key='two',kind='enhancement',title='Two'))
        store.uncertain=True
        self.assertEqual(commit(store,'cuai',2,digest(proposal),second)[1],'already-committed')

    def test_candidate_intake_deduplicates_and_preserves_stale_signals(self):
        from intake import planning_events
        record=dict(key='Pilot Data',kind='data-asset',title='Pilot',source='report',observedAt='2026-10-13',finding='qualified',signals={'goal':3})
        s=blank('cuai')
        events=planning_events(s,[record]); self.assertEqual(len(events),3)
        for event in events: s=apply(s,event)
        for event in planning_events(s,[record]): s=apply(s,event)
        self.assertEqual(len(s['items']),1)
        old={**record,'source':'older','observedAt':'2026-09-01','signals':{'goal':99}}
        for event in planning_events(s,[old]): s=apply(s,event)
        self.assertEqual(s['items']['pilot-data']['signals']['goal'],3)
        self.assertEqual(s['items']['pilot-data']['stage'],'ranked')

    def test_live_provider_rereads_revoked_approval_at_release(self):
        class ChangingProvider:
            def __init__(self): self.calls=0
            def fetch_issue_comments(self, brand):
                self.calls+=1
                return {'comments':[]},True
            def fetch_deployment(self, brand, deployment_id): raise AssertionError('deployment should not be read')
            def checkout_root(self, brand): raise AssertionError('checkout should not be read')
        provider=ChangingProvider()
        state=blank('cuai')
        state=apply(state,dict(eventId='intake',action='intake',key='pilot',kind='data-asset',title='Pilot'))
        event=dict(eventId='approval',action='approval',key='pilot',scope='release',actionClass='public-release',evidence={'approvalId':'a','commentId':1})
        result,report=run_once(state,[event],provider)
        self.assertGreaterEqual(provider.calls,2)
        self.assertEqual(result,state)
        self.assertEqual(report['applied'],[])
        self.assertEqual(report['blocked'][0][0],'approval')
