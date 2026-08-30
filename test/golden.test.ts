import { describe, it, expect } from 'vitest';
import golden from '../evals/golden.json';
import { runTool } from '../src/chat';
import { explainCell, grade } from '../src/grader';
import { CHECKS } from '../src/grader/catalog';
import { GLYPH } from '../src/grader/status';
import { TRACES } from '../src/grader/fixtures';

/**
 * The nine golden questions, asserted against the GRADER — no model involved.
 *
 * PLAN.md §8: CI must not depend on an LLM to catch a lying grader. A model can
 * be prompted into the right answer on a wrong matrix; these cases fail when the
 * matrix itself stops telling the truth.
 */
const byId = (n: number) => golden.cases.find((c) => c.id === n)!;

/**
 * explainCell returns a union: the cell, or {error}. Casting past that would
 * let a case "pass" against an error object, which is exactly the silent green
 * this repo is about. Assert the branch instead.
 */
function cellOf(site: string, check: string) {
  const e = explainCell(site, check);
  if ('error' in e) throw new Error(`explainCell(${site}, ${check}): ${e.error}`);
  return e;
}

describe('golden case fixture', () => {
  it('has exactly nine cases with unique ids', () => {
    expect(golden.cases).toHaveLength(9);
    expect(new Set(golden.cases.map((c) => c.id)).size).toBe(9);
  });

  it('every case names a tool and says why it exists', () => {
    for (const c of golden.cases) {
      expect(c.tool, `case ${c.id} tool`).toBeTruthy();
      expect(c.why.length, `case ${c.id} why`).toBeGreaterThan(20);
    }
  });
});

describe('1. lakeside ai.txt is FAIL, and the 404 is the reason', () => {
  const c = byId(1);
  it('fails on the status code, naming the import', () => {
    const e = cellOf(c.args!.site!, c.args!.check!);
    expect(e.status).toBe('FAIL');
    for (const s of c.expect!.note_contains!) expect(e.note).toContain(s);
    expect(e.does_not_prove.length).toBeGreaterThan(0);
    expect(e.note).not.toContain('empty/stub');
  });
});

describe('2. campus green, lakeside not — same check', () => {
  it('returns opposite verdicts for the same check id', () => {
    for (const cell of byId(2).cells!) {
      const e = cellOf(cell.site, cell.check);
      expect(e.status, `${cell.site}`).toBe(cell.status);
    }
  });
});

describe('3. a retired id resolves and says so', () => {
  const c = byId(3);
  it('reviews_collected -> review_ledger_fresh, and names the poll', () => {
    const e = cellOf(c.args!.site!, c.args!.check!);
    expect(e.check).toBe(c.expect!.resolves_to);
    expect(e.supersededFrom).toBe(c.expect!.superseded_from);
    expect(e.status).toBe('FAIL');
    expect(e.note.toLowerCase()).toContain('poll');
    expect(e.does_not_prove.toLowerCase()).toContain('poll');
  });
});

describe('4. the dash trap: NA is not MANUAL', () => {
  it('gives them different statuses and different glyphs', () => {
    const [na, man] = byId(4).expect!.distinct_glyphs!;
    const cells = grade();
    const a = cells.find((x) => x.site === na.site && x.check === na.check)!;
    const b = cells.find((x) => x.site === man.site && x.check === man.check)!;
    expect(a.status).toBe('NA');
    expect(b.status).toBe('MANUAL');
    expect(a.glyph).not.toBe(b.glyph);
    expect(GLYPH.NA).not.toBe(GLYPH.MANUAL);
  });
});

describe('5. the human floor is visible to marketing', () => {
  it('lists review-reply as clock-attended with a 1-star floor', () => {
    const r = runTool('list_processes', {}, 'marketing') as {
      allowed: boolean;
      data: { id: string; attendance: string; human_floor?: string }[];
    };
    expect(r.allowed).toBe(true);
    const p = r.data.find((x) => x.id === 'review-reply')!;
    expect(p.attendance).toBe('clock');
    expect(p.human_floor).toContain('1-star');
  });
});

describe('6. the trace: ops yes, marketing no', () => {
  const c = byId(6);
  it('ops reads it', () => {
    const r = runTool('read_trace', c.args!, 'ops') as { allowed: boolean };
    expect(r.allowed).toBe(true);
  });
  it('marketing gets 403 for the same question', () => {
    const r = runTool('read_trace', c.args!, 'marketing') as { allowed: boolean; status: number };
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(403);
  });
});

describe('7. cron is wired while the ledger it feeds is stale', () => {
  it('one PASS and one FAIL on the same site', () => {
    const cells = grade();
    for (const want of byId(7).expect!.cells!) {
      const got = cells.find((x) => x.site === want.site && x.check === want.check)!;
      expect(got.status, want.check).toBe(want.status);
    }
  });
});

describe('8. the control row is green', () => {
  it('station privacy_page PASSes, so red means something', () => {
    const c = byId(8);
    const e = cellOf(c.args!.site!, c.args!.check!);
    expect(e.status).toBe('PASS');
  });
});

describe('9. guest is denied, and the denial leaks nothing', () => {
  it('403 with no trace content in the body', () => {
    const r = runTool('read_trace', byId(9).args!, 'guest') as { allowed: boolean; status: number };
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(403);
    const body = JSON.stringify(r);
    expect(body).not.toContain(TRACES[0].rationale);
    expect(body).not.toContain(TRACES[0].summary);
  });
});

// A live model asked for "ecommerce_dash" when the id is "ecommerce_tax", and
// an error with no catalog left it guessing at the user instead of correcting
// itself. Refusing without saying what exists is a dead end that looks like
// rigor.
describe('an unknown check id hands back the catalog', () => {
  it('names the real ids so the next round can self-correct', () => {
    const e = explainCell('lakeside', 'ecommerce_dash');
    expect('error' in e).toBe(true);
    if (!('error' in e)) return;
    expect(e.available).toContain('ecommerce_tax');
    // Every id, not a curated subset: a partial list is how the model learns a
    // check does not exist when it does.
    expect(e.available).toEqual(CHECKS.map((c) => c.id));
  });

  it('a resolvable near-miss still resolves rather than erroring', () => {
    const e = explainCell('lakeside', 'ecommerce');
    expect('error' in e).toBe(false);
  });

  // The catalog alone was ignored: a live model received all twelve ids six
  // times and kept inventing names. A list is data; the model needs an
  // instruction, so the error names the nearest match and says to use it.
  it('names the nearest match for the ids a real model actually invented', () => {
    for (const guess of ['ecommerce-healthy', 'ecommercehealthy', 'ecommerce_dash']) {
      const e = explainCell('lakeside', guess);
      expect('error' in e, guess).toBe(true);
      if (!('error' in e)) continue;
      expect(e.did_you_mean, guess).toContain('ecommerce_tax');
      expect(e.instruction, guess).toContain('ecommerce_tax');
    }
  });

  it('falls back to the full catalog when nothing is near', () => {
    const e = explainCell('lakeside', 'zzz');
    expect('error' in e).toBe(true);
    if (!('error' in e)) return;
    expect(e.did_you_mean).toEqual([]);
    expect(e.instruction).toContain('available');
  });
});
