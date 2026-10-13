"""Turn reviewed, dated candidate records into deterministic planning events."""
from engine import KINDS, digest, slug


def planning_events(state, candidates):
    events = []
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
        identity = digest({'brand':state['brand'],'key':key,'source':source,'observedAt':observed,'finding':finding})[:20]
        if not existing:
            events.append({'eventId':f'intake:{state["brand"]}:{key}', 'action':'intake','key':key,
                           'kind':candidate['kind'],'title':candidate['title'],'sources':[source],
                           'goalId':candidate.get('goalId'),'signals':candidate.get('signals',{})})
        events.append({'eventId':f'evidence:{identity}','action':'evidence','key':key,
                       'evidence':{'source':source,'observedAt':observed,'finding':finding},
                       'signals':candidate.get('signals', existing['signals'] if existing else {})})
        if not existing or existing['stage'] == 'idea':
            events.append({'eventId':f'rank:{state["brand"]}:{key}', 'action':'transition','key':key,
                           'stage':'ranked','evidence':{'source':source,'observedAt':observed,'finding':finding}})
    return events
