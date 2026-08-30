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

/**
 * Resolve what the caller MEANT, and say so when it differs from what they typed.
 *
 * Three tiers, narrowest first: exact id, retired id, then a normalised match
 * that ignores punctuation and the rigor suffix. The third tier exists because
 * a live model asked for `ai.txt` when the id is `ai_txt_live` — a reasonable
 * name for the thing, and an exact-match lookup turned it into "unknown check",
 * which the loop then correctly refused to answer.
 *
 * That refusal was right and the outcome was still wrong: the user asked a
 * groundable question and got nothing. Being strict about ids does not make the
 * grader more truthful, it just moves the failure somewhere less useful. What
 * must stay strict is the VERDICT; the id is a lookup key, and every resolution
 * is reported back so nothing is silently renamed.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function resolveCheckId(id: string): {
  id: string;
  supersededFrom?: string;
  resolvedFrom?: string;
} {
  if (CHECKS.some((c) => c.id === id)) return { id };

  const current = SUPERSEDED[id];
  if (current) return { id: current, supersededFrom: id };

  const n = norm(id);
  if (!n) return { id };

  // Exact after normalising, then prefix (ai.txt -> ai_txt_live). Longest id
  // last so the shortest unambiguous match wins.
  const byNorm = CHECKS.find((c) => norm(c.id) === n);
  if (byNorm) return { id: byNorm.id, resolvedFrom: id };

  const prefixed = CHECKS.filter((c) => norm(c.id).startsWith(n));
  if (prefixed.length === 1) return { id: prefixed[0].id, resolvedFrom: id };

  const contained = CHECKS.filter((c) => norm(c.id).includes(n));
  if (contained.length === 1) return { id: contained[0].id, resolvedFrom: id };

  // Ambiguous or unknown: hand back the original so the caller gets a real
  // "unknown check" rather than an arbitrary pick.
  return { id };
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
  // An unknown id returns the CATALOG, not just a complaint. A model that
  // guessed a plausible-but-wrong name (ecommerce_dash for ecommerce_tax) can
  // then correct itself in the next round instead of asking the user, or worse,
  // inventing an answer. Refusing without saying what exists is a dead end that
  // looks like rigor.
  if (!check) {
    // Returning the catalog alone was not enough: a live model was handed all
    // twelve ids six times and went on inventing names. A list is data; the
    // model needs an instruction. So name the nearest match and say to use it.
    const n = norm(checkId);
    const near = CHECKS.map((c) => c.id).filter((id) => {
      const m = norm(id);
      return m.includes(n.slice(0, 6)) || n.includes(m.slice(0, 6));
    });
    return {
      error: `unknown check: ${checkId}`,
      did_you_mean: near,
      available: CHECKS.map((c) => c.id),
      instruction:
        near.length > 0
          ? `Call explain_cell again with check="${near[0]}". Do not invent another name.`
          : 'Call explain_cell again with one of the ids in available. Do not invent another name.',
    };
  }

  const site = SITES.find((s) => s.key === siteKey);
  if (!site) return { error: `unknown site: ${siteKey}` };

  const v = check.run(site, fx);
  return {
    site: site.key,
    check: check.id,
    supersededFrom: resolved.supersededFrom,
    resolvedFrom: resolved.resolvedFrom,
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
