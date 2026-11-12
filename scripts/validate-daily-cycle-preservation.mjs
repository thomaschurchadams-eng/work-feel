import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
try { guards.validateStateHistory(base, candidate); } catch (error) { fail(error.message); }

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
  ['ad01aaf1f00959665840e82318d1477940b6b107', '0fc2e5b1254f79e9b8044474122ceeab34ddea8d'],
  // Pre-activation Nov9 Alert and Nov10 PR313/verified closeout. These are
  // exact state-changing first-parent edges, not a rolling activation cutoff.
  // The private reconciliation proposes these three additions for release review.
  ['2c6d7cc9c99c987c1ed5ae7ba0a2dacbda29b422', 'ad01aaf1f00959665840e82318d1477940b6b107'],
  ['7ab4c73a58b5c965bc559e01bab5acfe6e692ef8', '2c6d7cc9c99c987c1ed5ae7ba0a2dacbda29b422'],
  ['f2260a0269b03c30029df993b17bf56647a5fa05', '7ab4c73a58b5c965bc559e01bab5acfe6e692ef8'],
  // PR314: existing operating-review root status, no article/slot/history changes.
  // One further immutable historical pair proposed for explicit release review.
  ['470f8f191dc825cd3dec7d70b87ba3a634268649', 'f2260a0269b03c30029df993b17bf56647a5fa05'],
  // Exact pre-activation Nov11/12 article/receipt edges (PR315, PR316, PR322).
  // State-changing predecessors only; unrelated metadata commits add no exemption.
  ['040e54901be0677622f009668aafc21ae5317ed6', '470f8f191dc825cd3dec7d70b87ba3a634268649'],
  ['d28746bb3ebae4b6a2c89c2491467e36a1a865fc', '040e54901be0677622f009668aafc21ae5317ed6'],
  ['dd65b2c1785d126f52c0e4089fdd3f1e875621af', 'd28746bb3ebae4b6a2c89c2491467e36a1a865fc'],
  ['7893f89b4718863d2360821962ae1f484f704f24', 'dd65b2c1785d126f52c0e4089fdd3f1e875621af'],
  ['33a53184da1908e6edd393ec4180de250ff51cc5', '7893f89b4718863d2360821962ae1f484f704f24'],
  ['a8c9a78e617a80e994182cbcabe47689f7ac2ca5', '33a53184da1908e6edd393ec4180de250ff51cc5']
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
