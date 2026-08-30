import { CHECKS, type Check } from './catalog';
import { SITES, seed, type Fixtures, type Site } from './fixtures';
import { GLYPH, type Status, type Verdict } from './status';

export interface Cell {
  site: string;
  check: string;
  status: Status;
  glyph: string;
  note: string;
}

/** Retired ids, and what replaced them. PLAN.md §4.2 */
export const SUPERSEDED: Record<string, string> = {
  reviews_collected: 'review_ledger_fresh',
};

export function resolveCheckId(id: string): { id: string; supersededFrom?: string } {
  const current = SUPERSEDED[id];
  return current ? { id: current, supersededFrom: id } : { id };
}

export function grade(fx: Fixtures = seed(), sites: Site[] = SITES): Cell[] {
  const cells: Cell[] = [];
  for (const site of sites) {
    for (const check of CHECKS) {
      const v: Verdict = check.run(site, fx);
      cells.push({
        site: site.key,
        check: check.id,
        status: v.status,
        glyph: GLYPH[v.status],
        note: v.note,
      });
    }
  }
  return cells;
}

export function explainCell(siteKey: string, checkId: string, fx: Fixtures = seed()) {
  const resolved = resolveCheckId(checkId);
  const check: Check | undefined = CHECKS.find((c) => c.id === resolved.id);
  if (!check) return { error: `unknown check: ${checkId}` };

  const site = SITES.find((s) => s.key === siteKey);
  if (!site) return { error: `unknown site: ${siteKey}` };

  const v = check.run(site, fx);
  return {
    site: site.key,
    check: check.id,
    supersededFrom: resolved.supersededFrom,
    claim: check.claim,
    rigor: check.rigor,
    status: v.status,
    glyph: GLYPH[v.status],
    note: v.note,
    proves: check.proves,
    does_not_prove: check.does_not_prove,
  };
}

export { CHECKS, SITES, seed };
export type { Fixtures, Site };
