/**
 * Print the matrix. No model, no chat, no network.
 *
 * Phase 1's deliverable in embryo: the planted defects must be legible here,
 * before any LLM is involved. If the matrix cannot show them, chat on top of it
 * would only be a more confident way to be wrong.
 *
 *   npm run matrix
 *   npm run matrix -- --live-off
 */
import { CHECKS, SITES, grade, seed } from './grader';

const liveOff = process.argv.includes('--live-off');
const cells = grade(seed({ liveOff }));

const w = Math.max(...CHECKS.map((c) => c.id.length)) + 2;
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

console.log(`\nHarbor Coffee — keep-true matrix${liveOff ? '  (live fixtures OFF)' : ''}\n`);
console.log(pad('check', w) + SITES.map((s) => pad(s.key, 12)).join(''));
console.log('-'.repeat(w + SITES.length * 12));

for (const check of CHECKS) {
  const row = SITES.map((s) => {
    const c = cells.find((x) => x.site === s.key && x.check === check.id)!;
    return pad(`${c.glyph} ${c.status}`, 12);
  }).join('');
  console.log(pad(check.id, w) + row);
}

console.log('\nNotes:');
for (const c of cells) {
  if (c.status !== 'PASS' && c.note) console.log(`  ${c.site}/${c.check}: ${c.note}`);
}

console.log('\nLegend: ✅ PASS  ❌ FAIL  ⚠️ PARTIAL  — NA  ❓ MANUAL  🚨 DEGRADED');
console.log('NA means evaluated and not applicable. ❓ MANUAL means no machine decided it.\n');
