"""Validate a freshly fetched GitHub issue comment before it enters the reducer.

The caller must obtain `comment` through the connected read-only GitHub tool. A local
JSON file or an event body is not an authoritative source. No remote writes occur.
"""
import re
from engine import BUS

TOM_LOGIN = 'thomaschurchadams-eng'
APPROVAL_FIELDS = ('approvalId', 'itemKey', 'actionClass', 'scope', 'artifactHash', 'commitSha', 'sourceVersion', 'status')
HANDOFF_FIELDS = ('itemKey', 'owner', 'receiptId', 'actionClass', 'sourceVersion', 'status')

def fields(body):
    found = {}
    for line in body.splitlines():
        match = re.fullmatch(r'([A-Za-z][A-Za-z0-9]*): ([^\r\n]+)', line.strip())
        if match:
            if match.group(1) in found:
                raise ValueError('duplicate receipt field')
            found[match.group(1)] = match.group(2)
    return found

def issue_comment(comment, brand, author, required):
    repo, issue = BUS[brand].split('#')
    url = comment.get('html_url') or comment.get('htmlUrl') or comment.get('url') or ''
    user = comment.get('user') or {}
    login = user.get('login') if isinstance(user, dict) else comment.get('authorLogin')
    if login != author or not re.fullmatch(r'https://github\.com/' + re.escape(repo) + r'/issues/' + issue + r'#issuecomment-\d+', url):
        raise ValueError('receipt is not from authoritative issue and author')
    parsed = fields(comment.get('body') or '')
    if any(not parsed.get(key) for key in required):
        raise ValueError('incomplete authoritative receipt')
    parsed['source'] = url
    parsed['sourceVerified'] = True
    return parsed

def approval(comment, brand):
    result = issue_comment(comment, brand, TOM_LOGIN, APPROVAL_FIELDS)
    result['authority'] = 'Tom'
    return result

def handoff(comment, brand, owner_login):
    return issue_comment(comment, brand, owner_login, HANDOFF_FIELDS)

CHECKPOINT_FIELDS = ('itemKey', 'owner', 'recoveryOwner', 'artifactHash', 'status')
RECOVERY_FIELDS = ('eventId', 'dedupeKey', 'owner', 'bodyHash', 'priorStatus', 'status', 'observedAt', 'posted')

def checkpoint(comment, brand):
    return issue_comment(comment, brand, TOM_LOGIN, CHECKPOINT_FIELDS)

def recovery(comment, brand):
    result = issue_comment(comment, brand, TOM_LOGIN, RECOVERY_FIELDS)
    if result['posted'] not in ('true','false'):
        raise ValueError('recovery posted must be explicit')
    result['posted'] = result['posted'] == 'true'
    return result
