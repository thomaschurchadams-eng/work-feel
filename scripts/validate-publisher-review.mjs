import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import planner from '../lib/publisher-write-plan.cjs';
const statePath = 'automation/daily-cycle-state.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const base = process.argv[2], head = process.argv[3] || git('rev-parse', 'HEAD');
if (![base, head].every(value => /^[a-f0-9]{40}$/.test(value || ''))) throw Error('explicit-review-and-base-shas-required');
const mergeBase = git('merge-base', base, head);
const files = git('diff', '--name-status', '--no-renames', mergeBase, head).split('\n').filter(Boolean).map(line => {
  const [status, path] = line.split('\t'); return { path, status: status === 'A' ? 'added' : status === 'D' ? 'removed' : 'modified' };
});
const isArticle = file => file.status === 'added' && (/^news\/[^/]+\.html$/.test(file.path) || /^insight-[^/]+\.html$/.test(file.path));
if (files.some(isArticle)) {
    const state = JSON.parse(git('show', `${base}:${statePath}`));
    const stateBlob = ref => git('rev-parse', `${ref}:${statePath}`);
    const result = planner.validateArticleReview({
      mergeBase: { sha: mergeBase, stateBlob: stateBlob(mergeBase) },
      review: { sha: head, stateBlob: stateBlob(head), files },
      main: { sha: base, stateBlob: stateBlob(base), state, changedPaths: git('diff', '--no-renames', '--name-only', mergeBase, base).split('\n').filter(Boolean) },
      rules: JSON.parse(fs.readFileSync(new URL('../automation/publishing-rules.json', import.meta.url), 'utf8'))
    });
    console.log(JSON.stringify(result));
    console.log('daily-cycle preservation validation passed: effective merge retains the exact canonical main state');
} else {
  const cli = fileURLToPath(new URL('./validate-daily-cycle-preservation.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, statePath, base, head], { encoding: 'utf8' });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  process.exitCode = result.status ?? 1;
}
