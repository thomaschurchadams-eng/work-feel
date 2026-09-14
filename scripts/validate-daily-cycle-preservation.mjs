import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

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

if (!fs.existsSync(statePath)) {
  fail(`candidate file is missing: ${statePath}`);
}

const candidate = readJson('candidate state', fs.readFileSync(statePath));

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

console.log(
  `daily-cycle preservation validation passed: ${candidate.history.length} history entries; ` +
  `all ${base.history.length} base history entries are unchanged from ${baseRef}`
);