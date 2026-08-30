/**
 * Print the matrix. No model, no chat, no network.
 *
 *   npm run matrix
 *   npm run matrix -- --live-off
 */
import { CHECKS, SITES, grade, seed } from './grader';
import { LABEL } from './grader/status';

const liveOff = process.argv.includes('--live-off');
const cells = grade(seed({ liveOff }));

const w = Math.max(...CHECKS.map((c) => c.claim.length)) + 2;
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

console.log(`\nHarbor Coffee — three shops${liveOff ? '  (could not reach live pages)' : ''}\n`);
console.log(pad('', w) + SITES.map((s) => pad(s.name.replace('Harbor ', ''), 16)).join(''));
console.log('-'.repeat(w + SITES.length * 16));

for (const check of CHECKS) {
  const row = SITES.map((s) => {
    const c = cells.find((x) => x.site === s.key && x.check === check.id)!;
    return pad(LABEL[c.status], 16);
  }).join('');
  console.log(pad(check.claim, w) + row);
}

console.log('\nNotes:');
for (const c of cells) {
  if (c.status !== 'PASS' && c.note) {
    const claim = CHECKS.find((x) => x.id === c.check)?.claim ?? c.check;
    console.log(`  ${c.site} — ${claim}: ${c.note}`);
  }
}

console.log('\nOK · Broken · Partial · Does not apply · Needs a person · Could not check');
console.log('Does not apply: we looked, this shop does not do that. Needs a person: a script cannot decide.\n');
