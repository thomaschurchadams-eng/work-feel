"""Turn reviewed, dated candidate records into deterministic planning events."""
from engine import KINDS, digest, slug


def planning_events(state, candidates):
    grouped = {}
    for candidate in candidates:
        key = slug(candidate['key'])
        source = candidate['source']
        observed = candidate['observedAt']
        finding = candidate['finding']
        if not key or candidate['kind'] not in KINDS or not candidate['title'] or not source or not observed or not finding:
            raise ValueError('candidate needs stable key, kind, title, dated source and finding')
        existing = state['items'].get(key)
        if existing and existing['kind'] != candidate['kind']:
            raise ValueError('semantic key conflict')
        prior = grouped.get(key)
        if prior and (prior[0]['kind'] != candidate['kind'] or prior[0]['title'] != candidate['title']):
            raise ValueError('conflicting candidate identity in batch')
        grouped.setdefault(key, []).append(candidate)
    events = []
    for key, records in sorted(grouped.items()):
        records.sort(key=lambda x: (x['observedAt'], x['source'], x['finding']))
        existing = state['items'].get(key)
        latest = records[-1]
        if not existing:
            events.append({'eventId':f'intake:{state["brand"]}:{key}', 'action':'intake','key':key,
                           'kind':latest['kind'],'title':latest['title'],
                           'sources':sorted({r['source'] for r in records}),
                           'goalId':latest.get('goalId'),'signals':latest.get('signals',{})})
        for record in records:
            identity = digest({'brand':state['brand'],'key':key,'source':record['source'],
                               'observedAt':record['observedAt'],'finding':record['finding']})[:20]
            events.append({'eventId':f'evidence:{identity}','action':'evidence','key':key,
                           'evidence':{'source':record['source'],'observedAt':record['observedAt'],'finding':record['finding']},
                           'signals':record.get('signals', existing['signals'] if existing else {})})
        if not existing or existing['stage'] == 'idea':
            cycle = next((d['eventId'] for d in reversed(state['decisions'])
                          if d['key'] == key and d['choice'] == 'clear'), 'initial')
            identity = digest({'brand':state['brand'],'key':key,'source':latest['source'],
                               'observedAt':latest['observedAt'],'finding':latest['finding'],
                               'cycle':cycle})[:20]
            events.append({'eventId':f'rank:{identity}', 'action':'transition','key':key,
                           'stage':'ranked','evidence':{'source':latest['source'],'observedAt':latest['observedAt'],'finding':latest['finding']}})
    return events
