"""Check asset lineage and evaluate predicates against actual record fields."""
import json
from pathlib import Path
p=Path(__file__).with_name('evidence.json')
data=json.loads(p.read_text())
records={r['id']:r for r in data['records']}
assert len(records)==len(data['records'])
def evaluate(r, predicate):
    if predicate=='hasVerifiedGoLive': return bool(r['dates']['goLive'] and r['stage']=='verified live')
    if predicate=='hasIndependentResult': return bool(r['independentlySupportedResult'])
    if predicate=='hasTrainingLicense': return any('training license granted' in s['rights'].lower() for s in r['sources'])
    raise ValueError('unknown predicate')
for r in records.values():
    assert r['claim']['status']=='claimed'
    assert r['dates']['originalAnnouncement'] and r['dates']['cuaiReporting']
    assert r['sources'] and r['uncertainty'] and isinstance(r['corrections'],list)
    assert all(s.get('rights') for s in r['sources'])
for case in data['evaluationCases']:
    assert evaluate(records[case['recordId']],case['predicate']) is case['expected'],case['id']
print(f"{len(records)} provenance record, {len(data['evaluationCases'])} evaluated cases passed")
