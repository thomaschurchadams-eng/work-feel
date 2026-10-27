#!/usr/bin/env node
// Explicit local invocation only. Does not run from CI or scheduled tasks.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { hash, prepare, technicalCheck, handoff, craftReviewTemplate } = require('../lib/video-production.cjs');
function atomic(file, value) { const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temp, file); }
function run(binary, args) { const r = spawnSync(binary, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 1048576 }); if (r.error || r.status !== 0) throw Error(r.error?.message || r.stderr.slice(-2000) || 'media_process_failed'); return r.stdout; }
function main() {
  const [specName, outputDir, reviewName] = process.argv.slice(2);
  if (!specName || !outputDir) throw Error('Usage: node scripts/produce-video.cjs job.json output-directory [finished-review.json]');
  const specFile = path.resolve(specName), out = path.resolve(outputDir), renderer = path.join(__dirname, 'render-video.swift');
  const spec = JSON.parse(fs.readFileSync(specFile));
  for (const input of [spec.source, spec.transcript, spec.audio, spec.alignment].filter(Boolean)) {
    const inputPath = fs.realpathSync(path.resolve(path.dirname(specFile), input.file));
    if (inputPath === out || inputPath.startsWith(out + path.sep)) throw Error('output_must_be_separate_from_inputs');
  }
  const job = prepare(spec, path.dirname(specFile));
  job.fingerprint = hash(Buffer.from(JSON.stringify({ ...job, renderer: hash(fs.readFileSync(renderer)), pipeline: hash(fs.readFileSync(__filename)), validation: hash(fs.readFileSync(path.join(__dirname, '../lib/video-production.cjs'))) })));
  fs.mkdirSync(out, { recursive: true });
  const receiptFile = path.join(out, 'production-state.json'), renderFile = path.join(out, 'render-job.json'), movie = path.join(out, 'review.mp4');
  let previous = null; try { previous = JSON.parse(fs.readFileSync(receiptFile)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous && previous.inputFingerprint !== job.fingerprint) throw Error('output_contains_different_job; choose a new output directory');
  atomic(renderFile, job);
  let resumed = false;
  if (previous?.technical && fs.existsSync(movie) && hash(fs.readFileSync(movie)) === previous.technical.sha256) resumed = true;
  let technical = previous?.technical;
  if (!resumed) {
    // A previous interrupted render belongs to this identical job; never touch inputs.
    if (previous?.inputFingerprint === job.fingerprint) fs.rmSync(movie + '.partial.mp4', { force: true });
    atomic(receiptFile, { inputFingerprint: job.fingerprint, assetId: job.id, status: 'rendering', published: false });
    try {
      const probe = JSON.parse(run('/usr/bin/swift', [renderer, renderFile, movie]));
      atomic(path.join(out, 'probe.json'), probe);
      technical = technicalCheck(fs.readFileSync(movie), probe, job.mode);
    } catch (error) {
      atomic(receiptFile, { inputFingerprint: job.fingerprint, assetId: job.id, status: 'render-failed', blocker: error.message, published: false });
      throw error;
    }
  }
  let review = null; if (reviewName) review = JSON.parse(fs.readFileSync(path.resolve(reviewName)));
  const receipt = handoff(job, technical, review);
  atomic(receiptFile, { ...receipt, technical, resumed, reviewFile: 'review.mp4' });
  const craftFile = path.join(out, 'craft-review.json');
  if (!fs.existsSync(craftFile)) atomic(craftFile, craftReviewTemplate(job.id, technical.sha256, job.mode));
  else if (JSON.parse(fs.readFileSync(craftFile)).finishedSha256 !== technical.sha256) throw Error('craft_receipt_identity_mismatch');
  fs.writeFileSync(path.join(out, 'transcript.txt'), job.transcript + '\n');
  atomic(path.join(out, 'captions.json'), job.captions);
  const escape = text => text.replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  fs.writeFileSync(path.join(out, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CUAI video production review</title><style>body{font:18px/1.6 system-ui;max-width:900px;margin:2rem auto;padding:1rem;color:#102030;overflow-wrap:anywhere}video{display:block;max-width:100%;max-height:70vh}a{color:#174b72}</style><main><h1>${escape(job.id)}</h1><p><strong>Private review — unpublished.</strong> ${escape(receipt.mode)}. ${escape(receipt.blocker || 'Normal source, rights and production release gates still apply.')}</p><video controls playsinline preload="metadata" src="review.mp4"></video><h2>Approved text</h2><p>${escape(job.transcript)}</p><h2>Source context</h2><ul>${job.sources.map(u => `<li><a href="${escape(u)}">${escape(u)}</a></li>`).join('')}</ul><p>${escape(job.rightsNote)}</p><p>Finished SHA256: ${technical.sha256}. No publication, catch-up or social request is implied.</p></main></html>`);
  console.log(JSON.stringify({ assetId: job.id, status: receipt.status, finishedSha256: technical.sha256, resumed, output: out }));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
