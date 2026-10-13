import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'automation' / 'roadmap'))
from engine import apply, blank, next_item, reconcile

class RoadmapTest(unittest.TestCase):
    def setUp(self):
        self.s = blank('cuai')
        self.s = apply(self.s, dict(eventId='i1', action='intake', key='dataset', title='Deployment dataset', kind='data-asset', sources=['a'], signals={'goal': 2}))
        self.s = apply(self.s, dict(eventId='i2', action='intake', key='other', title='Other', kind='enhancement', signals={'goal': 1}))
    def event(self, eid, stage, evidence, **kw):
        if stage == 'building' and 'acceptedBy' not in evidence:
            evidence = {**evidence, 'acceptedBy': self.s['items']['dataset']['owner']}
        self.s = apply(self.s, dict(eventId=eid, action='transition', key='dataset', stage=stage, evidence=evidence, **kw))
    def test_full_dry_run_and_prior_approval_reuse(self):
        self.event('r','ranked',dict(source='report', observedAt='2026-10-13', finding='qualified'))
        self.event('b','building',dict(acceptedHandoff='owner receipt',scope='dataset only'))
        self.event('q','qa',dict(testCommand='python -m unittest',testResult='passed',artifactHash='abc'))
        self.event('g','blocked-release',dict(gate='approval',releaseOwner='Tom'))
        with self.assertRaisesRegex(ValueError,'missing release authority'):
            self.event('bad','released',dict(approvalId='approved',deploymentId='preview',commitSha='abc',rollbackOwner='owner',rollbackSteps='revert'),scope='marketing')
        self.s=apply(self.s,dict(eventId='a',action='approval',key='dataset',scope='dataset-release',authority='Tom',evidence={'approvalId':'approved'}))
        self.event('rel','released',dict(approvalId='approved',deploymentId='fixture',commitSha='abc',rollbackOwner='owner',rollbackSteps='revert'),scope='dataset-release')
        self.event('done','verified-complete',dict(verification='independent check',observedAt='2026-10-13',artifactHash='abc',environment='production',deploymentId='fixture'))
        self.assertEqual(self.s['items']['dataset']['stage'],'verified-complete')
        self.assertEqual(next_item(self.s)['id'],'other')
    def test_duplicate_and_conflict(self):
        e=dict(eventId='x',action='intake',key='dataset',title='Deployment dataset',kind='data-asset',sources=['b'])
        once=apply(self.s,e)
        self.assertEqual(apply(once,e),once)
        with self.assertRaisesRegex(ValueError,'collision'):
            apply(once,{**e,'title':'changed'})
    def test_one_active_and_safe_reprioritization(self):
        self.event('r','ranked',dict(source='report',observedAt='today',finding='good'))
        self.event('b','building',dict(acceptedHandoff='yes',scope='bounded'))
        new=apply(self.s,dict(eventId='strong',action='evidence',key='other',evidence=dict(source='report',observedAt='today'),signals={'goal':99}))
        self.assertIsNone(next_item(new))
        with self.assertRaisesRegex(ValueError,'one active'):
            newer=apply(new,dict(eventId='other-rank',action='transition',key='other',stage='ranked',evidence=dict(source='report',observedAt='today',finding='good')))
            apply(newer,dict(eventId='other-build',action='transition',key='other',stage='building',evidence=dict(acceptedHandoff='yes',acceptedBy=newer['items']['other']['owner'],scope='bounded')))
    def test_overrides_preserved(self):
        s=apply(self.s,dict(eventId='reject',action='override',key='other',choice='reject',authority='Tom',reason='no fit'))
        self.assertEqual(s['items']['other']['stage'],'rejected')
        self.assertEqual(len(s['decisions']),1)
        self.assertEqual(next_item(s)['id'],'dataset')
    def test_failure_reconciliation(self):
        self.event('r','ranked',dict(source='report',observedAt='today',finding='good'))
        self.event('b','building',dict(acceptedHandoff='owner',scope='bounded'))
        body=self.s['outbox']['b']['body']
        self.assertEqual(reconcile(self.s,'b',[])['outbox']['b']['status'],'pending')
        self.assertEqual(reconcile(self.s,'b',[body])['outbox']['b']['status'],'confirmed')
        self.assertEqual(reconcile(self.s,'b',[body,body])['outbox']['b']['status'],'conflict')
        self.assertEqual(self.s['outbox']['b']['destination'],'thomaschurchadams-eng/work-feel#160')
    def test_stale_evidence_unknown_source_and_user_next(self):
        s=apply(self.s,dict(eventId='choice',action='override',key='other',choice='next',authority='Tom',reason='October PRODUCT direction'))
        s=apply(s,dict(eventId='new',action='evidence',key='dataset',evidence=dict(source='report',observedAt='2026-10-13'),signals={'goal':5}))
        s=apply(s,dict(eventId='old',action='evidence',key='dataset',evidence=dict(source='stale report',observedAt='2026-09-30'),signals={'goal':99}))
        self.assertEqual(s['items']['dataset']['signals']['goal'],5)
        self.assertEqual(next_item(s)['id'],'other')
        unknown=apply(s,dict(eventId='unavailable',action='evidence',key='other',evidence=dict(source='analytics unavailable',observedAt='2026-10-14')))
        self.assertEqual(unknown['items']['other']['signals'],self.s['items']['other']['signals'])
    def test_wrong_version_preview_cannot_complete(self):
        self.event('r','ranked',dict(source='report',observedAt='today',finding='good'))
        self.event('b','building',dict(acceptedHandoff='owner',scope='bounded'))
        self.event('q','qa',dict(testCommand='tests',testResult='passed',artifactHash='final-hash'))
        self.event('g','blocked-release',dict(gate='approval',releaseOwner='Tom'))
        self.s=apply(self.s,dict(eventId='a',action='approval',key='dataset',scope='release',authority='Tom',evidence={'approvalId':'a1'}))
        self.event('rel','released',dict(approvalId='a1',deploymentId='fixture',commitSha='abc',rollbackOwner='owner',rollbackSteps='revert'),scope='release')
        with self.assertRaisesRegex(ValueError,'differs from tested QA version'):
            self.event('wrong','verified-complete',dict(verification='preview only',observedAt='today',artifactHash='old-hash',environment='preview',deploymentId='fixture'))
        with self.assertRaisesRegex(ValueError,'preview cannot verify production completion'):
            self.event('preview','verified-complete',dict(verification='preview only',observedAt='today',artifactHash='final-hash',environment='preview',deploymentId='fixture'))

    def test_cai_separate_brand_and_acceptance_evidence(self):
        s=blank('cai')
        s=apply(s,dict(eventId='c1',action='intake',key='product',title='PRODUCT prototype',kind='enhancement'))
        s=apply(s,dict(eventId='c2',action='transition',key='product',stage='ranked',evidence=dict(source='decision',observedAt='today',finding='selected')))
        with self.assertRaisesRegex(ValueError,'acceptedHandoff'):
            apply(s,dict(eventId='c3',action='transition',key='product',stage='building',evidence=dict(scope='private')))
        s=apply(s,dict(eventId='c3',action='transition',key='product',stage='building',evidence=dict(acceptedHandoff='existing owner receipt',acceptedBy=s['items']['product']['owner'],scope='private')))
        self.assertEqual(s['outbox']['c3']['destination'],'thomaschurchadams-eng/cooperative-ai-institute-rebuild#12')

    def test_evidence_and_scope_fail_closed(self):
        with self.assertRaisesRegex(ValueError,'stage evidence'):
            self.event('r','ranked',{})
        with self.assertRaisesRegex(ValueError,'exact scope'):
            apply(self.s,dict(eventId='a',action='approval',key='dataset',scope='',authority='Tom',evidence={'approvalId':'x'}))

if __name__=='__main__': unittest.main()
