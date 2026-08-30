/**
 * The closed status set. Six, and no seventh dash.
 *
 * PLAN.md §5. Adding a status here is a deliberate act; inventing one at a call
 * site is a compile error. That is the point — the demo exists to show that a
 * matrix cell can lie, and the first way it lies is by rendering "we did not
 * look" identically to "this is fine".
 */
export const STATUSES = [
  'PASS',
  'FAIL',
  'PARTIAL',
  'NA',
  'MANUAL',
  'DEGRADED',
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Glyphs. NA and MANUAL MUST NOT share one.
 *
 * NA is "evaluated, does not apply". MANUAL is "no machine can decide this
 * here". Both are legitimate non-verdicts and they mean opposite things to an
 * operator: one is settled, one is waiting on a person. Render them the same
 * and the matrix reports a monitoring gap as a clean result.
 */
/** Words on the page and in the cell JSON. No emoji, no ❓. */
export const LABEL: Record<Status, string> = {
  PASS: 'OK',
  FAIL: 'Broken',
  PARTIAL: 'Partial',
  NA: 'Does not apply',
  MANUAL: 'Needs a person',
  DEGRADED: 'Could not check',
};

export const GLYPH = LABEL;

/**
 * Every DEGRADED note leads with one of these, and the class comes FIRST
 * because the reader (and any alert) quotes the head of the string.
 *
 *   TRANSIENT — nothing is wrong with the control; run it again
 *   NO ACCESS — an identity lost or never had permission; a human must act,
 *               and a re-run will fail identically
 *   BROKEN    — the check or its input is malformed; fix code or schema
 *
 * "Re-run it" and "go rotate a credential" are different instructions. An
 * unclassified DEGRADED makes the reader guess which one they are holding.
 */
export const DEGRADED_CLASSES = ['TRANSIENT', 'NO ACCESS', 'BROKEN'] as const;

export type DegradedClass = (typeof DEGRADED_CLASSES)[number];

export interface Verdict {
  status: Status;
  note: string;
}

export const P = (note = ''): Verdict => ({ status: 'PASS', note });
export const F = (note: string): Verdict => ({ status: 'FAIL', note });
export const PART = (note: string): Verdict => ({ status: 'PARTIAL', note });
export const NA = (note: string): Verdict => ({ status: 'NA', note });
export const MAN = (note: string): Verdict => ({ status: 'MANUAL', note });

/** DEGRADED takes its class as a separate argument so it cannot be forgotten. */
export const DEG = (cls: DegradedClass, note: string): Verdict => ({
  status: 'DEGRADED',
  note: `${cls}: ${note}`,
});

/** True iff a DEGRADED note leads with a declared class. Asserted in selftest. */
export function isClassifiedDegraded(v: Verdict): boolean {
  if (v.status !== 'DEGRADED') return true;
  return DEGRADED_CLASSES.some((c) => v.note.startsWith(`${c}: `));
}
