'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
test('industry marker does not count as technology concentration; real technology and function caps remain', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-candidates-')); t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const functions = ['payments-deposits', 'risk-compliance', 'board-strategy', 'finance-treasury', 'lending-collections'];
  const candidate = (name, fn, tech) => ({title: name, sourceUrl: 'https://example.invalid/source', sourceTier: 1, confidence: 1, functions: [fn], technologies: [tech], format: 'explainer', newsworthiness: 100, creditUnionRelevance: 100, sourcePublishedAt: new Date().toISOString()});
  const run = rows => { const file = path.join(dir, 'candidates.json'); fs.writeFileSync(file, JSON.stringify(rows)); const result = spawnSync(process.execPath, ['scripts/score-editorial-candidates.mjs', file], {cwd: root, encoding: 'utf8'}); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout).selected; };
  assert.equal(run(functions.map((fn, i) => candidate(`Unique fixture alpha ${i}`, fn, 'industry-development'))).length, 5);
  assert.equal(run(functions.map((fn, i) => candidate(`Unique fixture beta ${i}`, fn, 'generative-ai'))).length, 2);
  assert.equal(run([0,1,2].map(i => candidate(`Unique fixture gamma ${i}`, functions[0], 'industry-development'))).length, 2);
});
