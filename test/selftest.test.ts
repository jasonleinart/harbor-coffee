import { describe, it, expect } from 'vitest';
import {
  CHECKS,
  aiTxtVerdict,
  privacyPageVerdict,
  ledgerFreshVerdict,
  cronWiredVerdict,
  humanFloorVerdict,
  gtmProdHostVerdict,
  formsTurnstileVerdict,
  kitPinVerdict,
  processCatalogVerdict,
  roleAclVerdict,
} from '../src/grader/catalog';
import { grade, explainCell, resolveCheckId, SITES } from '../src/grader';
import { renderMatrix } from '../src/html';
import { seed, PROCESSES, PRINCIPALS } from '../src/grader/fixtures';
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

  it('gtm_prod_host: prod-only PASSes, extra host FAILs and is named', () => {
    expect(gtmProdHostVerdict(['prod.example'], 'prod.example').status).toBe('PASS');
    const v = gtmProdHostVerdict(['prod.example', 'preview.example'], 'prod.example');
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('preview.example');
    expect(gtmProdHostVerdict([], 'prod.example').status).toBe('FAIL');
  });

  it('forms_turnstile: all-protected PASSes, a bare form FAILs and is named', () => {
    expect(formsTurnstileVerdict([{ path: '/a', turnstile: true }]).status).toBe('PASS');
    const v = formsTurnstileVerdict([
      { path: '/a', turnstile: true },
      { path: '/catering', turnstile: false },
    ]);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('/catering');
  });

  it('forms_turnstile: no forms is NA, not PASS — nothing was protected', () => {
    expect(formsTurnstileVerdict([]).status).toBe('NA');
  });

  it('kit_pin: current PASSes, old is PARTIAL, missing FAILs', () => {
    expect(kitPinVerdict('v2.4.0', 'v2.4.0').status).toBe('PASS');
    expect(kitPinVerdict('v2.1.0', 'v2.4.0').status).toBe('PARTIAL');
    expect(kitPinVerdict(undefined, 'v2.4.0').status).toBe('FAIL');
  });

  it('process_catalog: all-runners PASSes, an orphan FAILs and is named', () => {
    expect(processCatalogVerdict(PROCESSES).status).toBe('PASS');
    const orphaned = PROCESSES.map((p) =>
      p.id === 'class-email' ? { ...p, runner: undefined } : p,
    );
    const v = processCatalogVerdict(orphaned);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('class-email');
  });

  it('role_acl: restricted PASSes; a leak to marketing FAILs and is named', () => {
    expect(roleAclVerdict(PRINCIPALS).status).toBe('PASS');
    const leaked = PRINCIPALS.map((p) =>
      p.role === 'marketing' ? { ...p, can_read: [...p.can_read, 'ops_trace'] } : p,
    );
    const v = roleAclVerdict(leaked);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('marketing');
  });

  // An ACL that denies everyone is not secure, it is broken. Without this the
  // row would go green on a principal table that locked ops out of its own data.
  it('role_acl: FAILs when ops itself cannot read the guarded resource', () => {
    const inverted = PRINCIPALS.map((p) =>
      p.role === 'ops' ? { ...p, can_read: ['matrix'] } : p,
    );
    expect(roleAclVerdict(inverted).status).toBe('FAIL');
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
    const e = explainCell('lakeside', 'reviews_collected') as unknown as Record<string, unknown>;
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
    const e = explainCell('lakeside', 'ai_txt_live') as unknown as Record<string, string>;
    expect(e.does_not_prove.length).toBeGreaterThan(0);
    expect(e.status).toBe('FAIL');
  });
});

// The page and the model must read the same grade() call. If the HTML ever
// disagrees with the JSON, the human and the LLM are looking at different
// worlds — and the demo's whole claim is that they are not.
describe('rendered matrix matches the graded cells', () => {
  it('every cell in the HTML carries the status the grader returned', () => {
    const html = renderMatrix();
    const rendered = [...html.matchAll(/<td class="s-([A-Z]+)"/g)].map((m) => m[1]);
    const graded = grade().map((c) => c.status);
    const count = (xs: string[]) =>
      xs.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    expect(rendered.length).toBe(graded.length);
    expect(count(rendered)).toEqual(count(graded));
  });

  it('renders every check row and site column', () => {
    const html = renderMatrix();
    for (const c of CHECKS) expect(html).toContain(c.id);
    for (const s of SITES) expect(html).toContain(s.key);
  });

  it('live-off renders DEGRADED, never PASS, on live rows', () => {
    const html = renderMatrix(true);
    expect(html).toContain('s-DEGRADED');
  });
});

// A live model asked for "ai.txt" when the id is "ai_txt_live". Exact-match
// lookup made that an unknown check, and the loop refused a question it could
// have answered. Strictness about ids does not buy truthfulness; it just moves
// the failure. The VERDICT stays strict, and every resolution is reported.
describe('check id resolution', () => {
  it('resolves a plausible short name to the real id', () => {
    expect(resolveCheckId('ai.txt').id).toBe('ai_txt_live');
    expect(resolveCheckId('ai_txt').id).toBe('ai_txt_live');
    expect(resolveCheckId('AI-TXT').id).toBe('ai_txt_live');
  });

  it('reports what it resolved from, so nothing is silently renamed', () => {
    expect(resolveCheckId('ai.txt').resolvedFrom).toBe('ai.txt');
    expect(resolveCheckId('ai_txt_live').resolvedFrom).toBeUndefined();
  });

  it('keeps the superseded path distinct from a fuzzy match', () => {
    const r = resolveCheckId('reviews_collected');
    expect(r.id).toBe('review_ledger_fresh');
    expect(r.supersededFrom).toBe('reviews_collected');
    expect(r.resolvedFrom).toBeUndefined();
  });

  it('an exact id is never rewritten', () => {
    for (const c of CHECKS) {
      const r = resolveCheckId(c.id);
      expect(r.id).toBe(c.id);
      expect(r.resolvedFrom).toBeUndefined();
    }
  });

  it('an unknown name stays unknown rather than picking something', () => {
    expect(explainCell('lakeside', 'wholly-unrelated')).toHaveProperty('error');
  });

  it('explain_cell surfaces the resolution to the caller', () => {
    const e = explainCell('lakeside', 'ai.txt') as unknown as Record<string, string>;
    expect(e.check).toBe('ai_txt_live');
    expect(e.resolvedFrom).toBe('ai.txt');
    expect(e.status).toBe('FAIL');
  });
});
