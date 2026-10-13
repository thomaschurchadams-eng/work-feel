"""Read-only adapters for existing connector responses and local test execution.

These accept results supplied by the authorized caller. This module cannot call ChatGPT's
connected GitHub/Vercel tools from a standalone Python process. Never mark a saved or
caller-authored JSON fixture as a fresh connector read in production.
"""
from __future__ import annotations
import hashlib
import re
import subprocess
from pathlib import Path
from engine import BUS
from receipts import approval, handoff, checkpoint, recovery

QA_COMMANDS = {
    'cuai': (('python3', '-m', 'unittest', 'discover', '-s', 'tests/roadmap', '-q'),
             ('python3', 'automation/product-roadmap/verify.py')),
    'cai': (('python3', '-m', 'py_compile', 'operations/product-roadmap/engine.py',
             'operations/product-roadmap/cli.py', 'operations/product-roadmap/receipts.py'),),
}

def issue_read(result, brand, *, fresh_complete):
    """Normalize a successful `github_fetch_issue_comments` structuredContent."""
    if not fresh_complete or not isinstance(result, dict) or not isinstance(result.get('comments'), list):
        raise ValueError('fresh complete GitHub issue read required')
    repo, number = BUS[brand].split('#')
    prefix = f'https://github.com/{repo}/issues/{number}#issuecomment-'
    comments = result['comments']
    if any(not isinstance(c, dict) or not str(c.get('url','')).startswith(prefix)
           or not re.fullmatch(r'\d+', str(c.get('url',''))[len(prefix):]) for c in comments):
        raise ValueError('comment outside authoritative issue')
    return comments

def approval_from_issue(comments, brand, comment_id):
    matches = [c for c in comments if str(c.get('id')) == str(comment_id)]
    if len(matches) != 1:
        raise ValueError('approval comment missing or ambiguous')
    return approval(matches[0], brand)

def handoff_from_issue(comments, brand, comment_id, owner_login):
    matches = [c for c in comments if str(c.get('id')) == str(comment_id)]
    if len(matches) != 1:
        raise ValueError('handoff comment missing or ambiguous')
    return handoff(matches[0], brand, owner_login)

def qa_run(repo_root, brand, artifact_path, source_version):
    """Run bounded repository checks; bind result to exact checked-out commit and bytes."""
    root = Path(repo_root).resolve()
    artifact = (root / artifact_path).resolve()
    if root not in artifact.parents or not artifact.is_file():
        raise ValueError('artifact outside checkout or missing')
    commit = subprocess.run(('git','rev-parse','HEAD'), cwd=root, capture_output=True, text=True, check=True).stdout.strip()
    if source_version != commit:
        raise ValueError('source version differs from checkout')
    relative = artifact.relative_to(root)
    status = subprocess.run(('git','status','--porcelain','--',str(relative)), cwd=root, capture_output=True, text=True, check=True)
    if status.stdout.strip():
        raise ValueError('artifact is not committed at exact checkout head')
    for argv in QA_COMMANDS[brand]:
        outcome = subprocess.run(argv, cwd=root, capture_output=True, text=True)
        if outcome.returncode:
            raise ValueError(f'QA failed: {" ".join(argv)}: {outcome.stderr[-500:]}')
    return dict(testCommand=' && '.join(' '.join(c) for c in QA_COMMANDS[brand]), testResult='passed',
                artifactHash=hashlib.sha256(artifact.read_bytes()).hexdigest(), commitSha=commit,
                sourceVersion=commit, source=f'local checkout {root} at {commit}', sourceVerified=True)

def deployment_read(result, expected):
    """Require exact immutable production identity from a trusted deployment read."""
    if not isinstance(result, dict) or any(not result.get(k) for k in
       ('deploymentId','commitSha','artifactHash','environment','state','source')):
        raise ValueError('deployment read lacks exact identity')
    if result['environment'] != 'production' or result['state'] != 'READY':
        raise ValueError('production deployment is not READY')
    if any(result[k] != expected[k] for k in ('deploymentId','commitSha','artifactHash')):
        raise ValueError('deployment differs from expected candidate')
    return dict(deploymentId=result['deploymentId'],commitSha=result['commitSha'],
                artifactHash=result['artifactHash'],environment='production',
                source=result['source'],sourceVerified=True)

def receipt_from_issue(comments, brand, comment_id, kind):
    matches = [c for c in comments if str(c.get('id')) == str(comment_id)]
    if len(matches) != 1:
        raise ValueError('receipt comment missing or ambiguous')
    parser = {'checkpoint':checkpoint, 'recovery':recovery}[kind]
    return parser(matches[0],brand)
