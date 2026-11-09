import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import guards from '../lib/daily-cycle-guards.cjs';

const statePath = process.argv[2] || 'automation/daily-cycle-state.json';
const requestedBaseRef = process.argv[3] || process.env.CUAI_BASE_REF || 'main';

function fail(message) {
  console.error(`daily-cycle preservation validation failed: ${message}`);
  process.exit(1);
}

function decodeUtf8(label, bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    fail(`${label} is not valid UTF-8 (${error.message})`);
  }
}

function readJson(label, bytes) {
  const text = decodeUtf8(label, bytes);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON (${error.message})`);
  }
}

const candidateRef = process.argv[4];
if (candidateRef && !/^[a-f0-9]{40}$/.test(candidateRef)) fail('candidate ref must be an exact commit SHA');
if (!candidateRef && !fs.existsSync(statePath)) {
  fail(`candidate file is missing: ${statePath}`);
}

let candidateBytes;
try { candidateBytes = candidateRef ? execFileSync('git', ['show', `${candidateRef}:${statePath}`]) : fs.readFileSync(statePath); }
catch { fail('candidate state unavailable at exact revision'); }
const candidate = readJson('candidate state', candidateBytes);

let baseBytes;
let baseRef = requestedBaseRef;
try {
  baseBytes = execFileSync('git', ['show', `${baseRef}:${statePath}`]);
} catch {
  if (requestedBaseRef !== 'main') {
    fail(`could not read ${statePath} from base ref ${requestedBaseRef}`);
  }
  baseRef = 'HEAD^';
  try {
    baseBytes = execFileSync('git', ['show', `${baseRef}:${statePath}`]);
  } catch {
    fail(`could not read a base copy of ${statePath}; pass an explicit base ref`);
  }
}

const base = readJson(`base state (${baseRef})`, baseBytes);
try {
  guards.validateCurrentContinuity(base.current, candidate.current);
  for (const entry of candidate.history || []) guards.validatePendingSlots(entry, { allowLegacyAttempt: true });
} catch (error) { fail(error.message); }

if (!Array.isArray(base.history)) {
  fail('base state does not contain a history array');
}
if (!Array.isArray(candidate.history)) {
  fail('candidate state does not contain a history array');
}
if (candidate.history.length < base.history.length) {
  fail(`history shrank from ${base.history.length} entries to ${candidate.history.length}`);
}

const candidateHistoryByDate = new Map();
for (const entry of candidate.history) {
  const date = entry?.date;
  if (!date) continue;
  if (candidateHistoryByDate.has(date)) {
    fail(`candidate contains duplicate history date: ${date}`);
  }
  candidateHistoryByDate.set(date, entry);
}

for (const baseEntry of base.history) {
  const date = baseEntry?.date;
  if (!date) continue;
  const candidateEntry = candidateHistoryByDate.get(date);
  if (!candidateEntry) {
    fail(`candidate dropped existing history date: ${date}`);
  }
  if (!isDeepStrictEqual(candidateEntry, baseEntry)) {
    fail(`candidate mutated existing history entry: ${date}`);
  }
}

if (base.current?.date && candidate.current?.date && candidate.current.date < base.current.date) {
  fail(`current date regressed from ${base.current.date} to ${candidate.current.date}`);
}

if (base.current?.date && candidate.current?.date && candidate.current.date > base.current.date) {
  const preservedPriorCurrent = candidateHistoryByDate.get(base.current.date);
  if (!preservedPriorCurrent) {
    fail(`candidate advanced current date to ${candidate.current.date} without preserving prior current ${base.current.date} in history`);
  }
  if (!isDeepStrictEqual(preservedPriorCurrent, base.current)) {
    fail(`candidate advanced current date to ${candidate.current.date} but did not preserve the complete prior current ${base.current.date}`);
  }
}

// Exact already-accepted catch-up and ordinary-cycle transitions predate the
// new outcome format. Each additional edge requires receipt-backed review.
// Retain every original preservation check above and the original chain anchor.
// This is NOT an exemption for new proposals, dates, descendants or byte copies:
// only these immutable previous-state/candidate revision pairs, read by SHA, qualify.
const acceptedLegacyOutcomeTransitions = new Map([
  ['75059e080aaa2925ba936acf786d4ffcd2d7cb26', 'aa43cf2782628289bd927c480799ba15b45af4be'],
  ['b11c32b37f3ba7c24e30295940039bda42c1fef4', '75059e080aaa2925ba936acf786d4ffcd2d7cb26'],
  ['b3dd92178903ea5003a39e3718667c868082be45', 'b11c32b37f3ba7c24e30295940039bda42c1fef4'],
  // November 9 publication/owned closeout: issue #160 comments 6739830095 and
  // 6740292833. Preserve its actual rollover, failure history and editorial hold.
  ['0fc2e5b1254f79e9b8044474122ceeab34ddea8d', 'b3dd92178903ea5003a39e3718667c868082be45'],
  ['ad01aaf1f00959665840e82318d1477940b6b107', '0fc2e5b1254f79e9b8044474122ceeab34ddea8d']
]);
let acceptedLegacyOutcome = false;
if (candidateRef && acceptedLegacyOutcomeTransitions.has(candidateRef)) {
  const exactBase = execFileSync('git', ['rev-parse', `${baseRef}^{commit}`], { encoding: 'utf8' }).trim();
  acceptedLegacyOutcome = exactBase === acceptedLegacyOutcomeTransitions.get(candidateRef);
}
try {
  if (!acceptedLegacyOutcome) {
    guards.validatePublisherCheckpointAdmission(base.current, candidate.current);
    const rules = readJson('publisher cadence rules', fs.readFileSync(new URL('../automation/publishing-rules.json', import.meta.url)));
    guards.validatePublisherCadence(base.current, candidate.current, rules);
  }
}
catch (error) { fail(error.message); }

console.log(
  `daily-cycle preservation validation passed: ${candidate.history.length} history entries; ` +
  `all ${base.history.length} base history entries are unchanged from ${baseRef}`
);
