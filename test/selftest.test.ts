import { describe, it, expect } from 'vitest';
import {
  CHECKS,
  aiTxtVerdict,
  privacyPageVerdict,
  ledgerFreshVerdict,
  cronWiredVerdict,
  humanFloorVerdict,
} from '../src/grader/catalog';
import { grade, explainCell, resolveCheckId } from '../src/grader';
import { seed, PROCESSES } from '../src/grader/fixtures';
import { STATUSES, GLYPH, isClassifiedDegraded } from '../src/grader/status';

const cell = (cells: ReturnType<typeof grade>, site: string, check: string) =>
  cells.find((c) => c.site === site && c.check === check)!;

describe('catalog contract', () => {
  it('every check declares a non-empty does_not_prove', () => {
    for (const c of CHECKS) {
      expect(c.does_not_prove.trim().length, `${c.id} does_not_prove`).toBeGreaterThan(0);
    }
  });

  it('every check declares a non-empty claim and proves', () => {
    for (const c of CHECKS) {
      expect(c.claim.trim().length, `${c.id} claim`).toBeGreaterThan(0);
      expect(c.proves.trim().length, `${c.id} proves`).toBeGreaterThan(0);
    }
  });

  it('check ids are unique', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('status enum', () => {
  it('is exactly six', () => {
    expect(STATUSES.length).toBe(6);
  });

  it('gives every status a glyph, all distinct — NA must not look like MANUAL', () => {
    const glyphs = STATUSES.map((s) => GLYPH[s]);
    expect(new Set(glyphs).size).toBe(STATUSES.length);
    expect(GLYPH.NA).not.toBe(GLYPH.MANUAL);
  });

  it('only the six statuses can appear in a graded matrix', () => {
    for (const c of grade()) {
      expect(STATUSES).toContain(c.status);
    }
  });
});

describe('DEGRADED notes are classified', () => {
  it('every DEGRADED a probe can emit leads with a declared class', () => {
    const degraded = [
      aiTxtVerdict(true, null),
      privacyPageVerdict(null),
      ledgerFreshVerdict(null, null, 24),
    ];
    for (const v of degraded) {
      expect(v.status).toBe('DEGRADED');
      expect(isClassifiedDegraded(v), `unclassified: ${v.note}`).toBe(true);
    }
  });

  it('an unclassified DEGRADED is detectable', () => {
    expect(isClassifiedDegraded({ status: 'DEGRADED', note: 'it broke' })).toBe(false);
  });
});

// Three ways per live row, or a check hardcoded to FAIL still "passes".
describe('live rows: three-way', () => {
  it('ai_txt: 404 FAILs, 200+import PASSes, unreachable DEGRADEs', () => {
    expect(aiTxtVerdict(true, 404).status).toBe('FAIL');
    expect(aiTxtVerdict(true, 200, 'x'.repeat(60)).status).toBe('PASS');
    expect(aiTxtVerdict(true, null).status).toBe('DEGRADED');
  });

  // THE HEADLINE DEFECT, asserted on the NOTE and not only the status.
  // A status-only assertion let a mutation survive that made import-only green:
  // wired + 404 fell through to the empty-body branch and returned FAIL for the
  // wrong reason. Right answer, wrong path, and the test could not tell. The
  // note is the only place the reason travels, so the reason is what to assert.
  it('ai_txt: a 404 FAILs *on the status code*, never on body length', () => {
    const v = aiTxtVerdict(true, 404);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('404');
    expect(v.note).not.toContain('empty/stub');
  });

  it('ai_txt: the import is named in the failure, so "but we imported it" is answered', () => {
    expect(aiTxtVerdict(true, 404).note).toContain('imported');
    expect(aiTxtVerdict(false, 404).note).not.toContain('imported');
  });

  it('ai_txt: live 200 without the kit import is PARTIAL, not PASS', () => {
    expect(aiTxtVerdict(false, 200, 'x'.repeat(60)).status).toBe('PARTIAL');
  });

  it('ai_txt: 200 with a stub body FAILs', () => {
    expect(aiTxtVerdict(true, 200, 'ok').status).toBe('FAIL');
  });

  it('privacy_page: 404 FAILs, 200 PASSes, unreachable DEGRADEs', () => {
    expect(privacyPageVerdict(404).status).toBe('FAIL');
    expect(privacyPageVerdict(200).status).toBe('PASS');
    expect(privacyPageVerdict(null).status).toBe('DEGRADED');
  });

  it('review_ledger_fresh: stale poll FAILs, fresh PASSes, unreadable DEGRADEs', () => {
    expect(ledgerFreshVerdict(2, 76, 24).status).toBe('FAIL');
    expect(ledgerFreshVerdict(2, 3, 24).status).toBe('PASS');
    expect(ledgerFreshVerdict(null, null, 24).status).toBe('DEGRADED');
  });

  it('live checks cannot PASS when live fixtures are off', () => {
    const cells = grade(seed({ liveOff: true }));
    const liveIds = CHECKS.filter((c) => c.rigor === 'live').map((c) => c.id);
    expect(liveIds.length).toBeGreaterThan(0);
    for (const c of cells.filter((x) => liveIds.includes(x.check))) {
      expect(c.status, `${c.site}/${c.check} passed with live off`).not.toBe('PASS');
    }
  });
});

describe('non-live rows can still fail', () => {
  it('human_floor_declared: PASSes on seed, FAILs when a clock floor is stripped', () => {
    expect(humanFloorVerdict(PROCESSES).status).toBe('PASS');
    const stripped = PROCESSES.map((p) =>
      p.id === 'review-reply' ? { ...p, human_floor: undefined } : p,
    );
    const v = humanFloorVerdict(stripped);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('review-reply');
  });

  it('cron_invocations: PASSes when declared, FAILs when absent', () => {
    expect(cronWiredVerdict(['0 * * * *']).status).toBe('PASS');
    expect(cronWiredVerdict([]).status).toBe('FAIL');
  });
});

describe('planted defects (PLAN.md §4)', () => {
  const cells = grade();

  it('1. lakeside ai_txt FAILs despite the import; campus PASSes; station PARTIAL', () => {
    expect(cell(cells, 'lakeside', 'ai_txt_live').status).toBe('FAIL');
    expect(cell(cells, 'campus', 'ai_txt_live').status).toBe('PASS');
    expect(cell(cells, 'station', 'ai_txt_live').status).toBe('PARTIAL');
  });

  it('2. a superseded id resolves to the current one', () => {
    expect(resolveCheckId('reviews_collected')).toEqual({
      id: 'review_ledger_fresh',
      supersededFrom: 'reviews_collected',
    });
    const e = explainCell('lakeside', 'reviews_collected') as Record<string, unknown>;
    expect(e.check).toBe('review_ledger_fresh');
    expect(e.supersededFrom).toBe('reviews_collected');
  });

  it('3. the dash trap: NA and MANUAL do not share a glyph', () => {
    const na = cell(cells, 'lakeside', 'ecommerce_tax');
    const man = cell(cells, 'lakeside', 'brand_voice');
    expect(na.status).toBe('NA');
    expect(man.status).toBe('MANUAL');
    expect(na.glyph).not.toBe(man.glyph);
  });

  it('4. cron is green while the ledger it feeds FAILs', () => {
    expect(cell(cells, 'lakeside', 'cron_invocations').status).toBe('PASS');
    expect(cell(cells, 'lakeside', 'review_ledger_fresh').status).toBe('FAIL');
  });

  it('privacy_page is the control: PASS on all three', () => {
    for (const s of ['lakeside', 'campus', 'station']) {
      expect(cell(cells, s, 'privacy_page').status).toBe('PASS');
    }
  });
});

describe('explain_cell', () => {
  it('always carries does_not_prove', () => {
    const e = explainCell('lakeside', 'ai_txt_live') as Record<string, string>;
    expect(e.does_not_prove.length).toBeGreaterThan(0);
    expect(e.status).toBe('FAIL');
  });
});
