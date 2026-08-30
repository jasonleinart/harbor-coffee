import { describe, it, expect } from 'vitest';
import {
  CHECKS,
  orderOnlineVerdict,
  privacyPageVerdict,
  ledgerFreshVerdict,
  cronWiredVerdict,
  humanFloorVerdict,
  cateringFormVerdict,
  roleAclVerdict,
} from '../src/grader/catalog';
import { grade, explainCell, resolveCheckId, SITES } from '../src/grader';
import { renderMatrix } from '../src/html';
import { seed, PROCESSES, PRINCIPALS } from '../src/grader/fixtures';
import { STATUSES, GLYPH, isClassifiedDegraded } from '../src/grader/status';

const cell = (cells: ReturnType<typeof grade>, site: string, check: string) =>
  cells.find((c) => c.site === site && c.check === check)!;

// Assert the non-error branch rather than casting past it: a cast would let a
// test go green against {error}, which is the silent pass this repo exists to
// prevent.
function cellOf(site: string, check: string) {
  const e = explainCell(site, check);
  if ('error' in e) throw new Error(`explainCell(${site}, ${check}): ${e.error}`);
  return e;
}

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
      orderOnlineVerdict(true, null),
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
  it('order page: 404 FAILs, 200+wired PASSes, unreachable DEGRADEs', () => {
    expect(orderOnlineVerdict(true, 404).status).toBe('FAIL');
    expect(orderOnlineVerdict(true, 200, 'x'.repeat(60)).status).toBe('PASS');
    expect(orderOnlineVerdict(true, null).status).toBe('DEGRADED');
  });

  it('order page: a 404 FAILs on the missing page, never on body length', () => {
    const v = orderOnlineVerdict(true, 404);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('404');
    expect(v.note).not.toContain('empty');
  });

  it('order page: the button-in-the-build is named in the failure', () => {
    expect(orderOnlineVerdict(true, 404).note).toContain('button');
    expect(orderOnlineVerdict(false, 404).note).not.toContain('button');
  });

  it('order page: live 200 without the usual build is PARTIAL, not PASS', () => {
    expect(orderOnlineVerdict(false, 200, 'x'.repeat(60)).status).toBe('PARTIAL');
  });

  it('order page: 200 with an empty body FAILs', () => {
    expect(orderOnlineVerdict(true, 200, 'ok').status).toBe('FAIL');
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

  it('catering form: protected PASSes, open FAILs and is named', () => {
    expect(cateringFormVerdict([{ path: '/catering', spam_check: true }]).status).toBe('PASS');
    const v = cateringFormVerdict([{ path: '/catering', spam_check: false }]);
    expect(v.status).toBe('FAIL');
    expect(v.note).toContain('/catering');
  });

  it('catering form: no forms is NA, not PASS', () => {
    expect(cateringFormVerdict([])).toMatchObject({ status: 'NA' });
  });

  it('role_acl: restricted PASSes; a leak to marketing FAILs and is named', () => {
    expect(roleAclVerdict(PRINCIPALS).status).toBe('PASS');
    const leaked = PRINCIPALS.map((p) =>
      p.role === 'marketing' ? { ...p, can_read: [...p.can_read, 'customer_pii'] } : p,
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

  it('1. lakeside order page FAILs despite the button; campus PASSes; station PARTIAL', () => {
    expect(cell(cells, 'lakeside', 'order_online').status).toBe('FAIL');
    expect(cell(cells, 'campus', 'order_online').status).toBe('PASS');
    expect(cell(cells, 'station', 'order_online').status).toBe('PARTIAL');
  });

  it('2. a superseded id resolves to the current one', () => {
    expect(resolveCheckId('reviews_collected')).toEqual({
      id: 'reviews_arriving',
      supersededFrom: 'reviews_collected',
    });
    const e = cellOf('lakeside', 'reviews_collected');
    expect(e.check).toBe('reviews_arriving');
    expect(e.supersededFrom).toBe('reviews_collected');
  });

  it('3. the dash trap: NA and MANUAL do not share a label', () => {
    const na = cell(cells, 'lakeside', 'online_store');
    const man = cell(cells, 'lakeside', 'chalkboard');
    expect(na.status).toBe('NA');
    expect(man.status).toBe('MANUAL');
    expect(na.glyph).not.toBe(man.glyph);
  });

  it('4. download is scheduled while reviews are not arriving', () => {
    expect(cell(cells, 'lakeside', 'review_download_scheduled').status).toBe('PASS');
    expect(cell(cells, 'lakeside', 'reviews_arriving').status).toBe('FAIL');
  });

  it('privacy is the control: PASS on all three', () => {
    for (const s of ['lakeside', 'campus', 'station']) {
      expect(cell(cells, s, 'privacy').status).toBe('PASS');
    }
  });
});

describe('explain_cell', () => {
  it('always carries does_not_prove', () => {
    const e = cellOf('lakeside', 'order_online');
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
    for (const c of CHECKS) expect(html).toContain(c.claim);
    for (const s of SITES) expect(html).toContain(s.name);
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
    expect(resolveCheckId('ai.txt').id).toBe('order_online');
    expect(resolveCheckId('ai_txt').id).toBe('order_online');
    expect(resolveCheckId('AI-TXT').id).toBe('order_online');
    expect(resolveCheckId('order').id).toBe('order_online');
  });

  it('reports what it resolved from, so nothing is silently renamed', () => {
    expect(resolveCheckId('ai.txt').resolvedFrom).toBe('ai.txt');
    expect(resolveCheckId('order_online').resolvedFrom).toBeUndefined();
  });

  it('keeps the superseded path distinct from a fuzzy match', () => {
    const r = resolveCheckId('reviews_collected');
    expect(r.id).toBe('reviews_arriving');
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
    const e = cellOf('lakeside', 'ai.txt');
    expect(e.check).toBe('order_online');
    expect(e.resolvedFrom).toBe('ai.txt');
    expect(e.status).toBe('FAIL');
  });
});
