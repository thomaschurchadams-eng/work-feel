import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const rules = JSON.parse(read('automation/publishing-rules.json'));
const state = JSON.parse(read('automation/daily-cycle-state.json'));
const operating = read('automation/scheduled-tasks/cuai-operating-system.md');
const runbook = read('automation/AUTONOMOUS_NEWSROOM.md');

const errors = [];
const alertCycle = rules?.cycleOwnership?.alertCycle || '';
const standard = rules?.standardCycle || {};

if (standard.alertTarget !== null) errors.push('publishing-rules standardCycle.alertTarget must remain null');
if (standard.alertMaximumPerWeekday !== 1) errors.push('publishing-rules alertMaximumPerWeekday must remain 1');
if (standard.alertQuotaEnabled !== false) errors.push('publishing-rules alertQuotaEnabled must remain false');
if (!/at most one/i.test(alertCycle) || !/no quota|no minimum/i.test(alertCycle)) {
  errors.push('publishing-rules cycleOwnership.alertCycle must preserve max-one/no-quota semantics');
}
if (!/at most one Alert per weekday/i.test(runbook) || !/no Alert quota or minimum target/i.test(runbook)) {
  errors.push('AUTONOMOUS_NEWSROOM.md must preserve max-one/no-quota Alert semantics');
}
if (!/at most one genuinely new, time-sensitive Alert per weekday/i.test(operating) || !/Do not use a quota, target/i.test(operating)) {
  errors.push('cuai-operating-system.md must preserve max-one/no-quota Alert semantics');
}

const policySurfaces = `${JSON.stringify(rules)}\n${runbook}\n${operating}`;
if (/three[- ]Alert|three Alerts|3 Alerts/i.test(policySurfaces)) {
  errors.push('an authoritative policy surface reintroduced a three-Alert quota/target');
}

if (state?.dailyTargets?.alerts != null) {
  if (!/legacy alert target count.*non-authoritative|legacy.*non-authoritative metadata/i.test(alertCycle)) {
    errors.push('legacy daily-cycle-state Alert metadata is present but is not explicitly marked non-authoritative in publishing rules');
  }
}

if (errors.length) {
  console.error('Alert policy consistency validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Alert policy consistency validation passed.');
