import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const statePath = process.argv[2] || 'automation/daily-cycle-state.json';
const requestedBaseRef = process.argv[3] || process.env.CUAI_BASE_REF || 'main';

function fail(message) {
  console.error(`daily-cycle preservation validation failed: ${message}`);
  process.exit(1);
}

function readJson(label, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON (${error.message})`);
  }
}

if (!fs.existsSync(statePath)) {
  fail(`candidate file is missing: ${statePath}`);
}

const candidate = readJson('candidate state', fs.readFileSync(statePath, 'utf8'));

let baseText;
let baseRef = requestedBaseRef;
try {
  baseText = execFileSync('git', ['show', `${baseRef}:${statePath}`], { encoding: 'utf8' });
} catch {
  if (requestedBaseRef !== 'main') {
    fail(`could not read ${statePath} from base ref ${requestedBaseRef}`);
  }
  baseRef = 'HEAD^';
  try {
    baseText = execFileSync('git', ['show', `${baseRef}:${statePath}`], { encoding: 'utf8' });
  } catch {
    fail(`could not read a base copy of ${statePath}; pass an explicit base ref`);
  }
}

const base = readJson(`base state (${baseRef})`, baseText);

if (!Array.isArray(base.history)) {
  fail('base state does not contain a history array');
}
if (!Array.isArray(candidate.history)) {
  fail('candidate state does not contain a history array');
}
if (candidate.history.length < base.history.length) {
  fail(`history shrank from ${base.history.length} entries to ${candidate.history.length}`);
}

const baseDates = base.history.map((entry) => entry?.date).filter(Boolean);
const candidateDates = new Set(candidate.history.map((entry) => entry?.date).filter(Boolean));
const missingDates = baseDates.filter((date) => !candidateDates.has(date));
if (missingDates.length) {
  fail(`candidate dropped existing history dates: ${missingDates.join(', ')}`);
}

if (base.current?.date && candidate.current?.date && candidate.current.date < base.current.date) {
  fail(`current date regressed from ${base.current.date} to ${candidate.current.date}`);
}

console.log(
  `daily-cycle preservation validation passed: ${candidate.history.length} history entries; ` +
  `all ${baseDates.length} dated base entries preserved from ${baseRef}`
);
