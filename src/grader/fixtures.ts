/**
 * Seed data for three invented sites.
 *
 * The defects live HERE, not in a model and not in prose. A reader can diff
 * this file against the matrix and see exactly why each cell says what it says.
 * PLAN.md §4.
 */

export interface Site {
  key: string;
  name: string;
}

export const SITES: Site[] = [
  { key: 'lakeside', name: 'Harbor Lakeside' },
  { key: 'campus', name: 'Harbor Campus' },
  { key: 'station', name: 'Harbor Station' },
];

export interface Process {
  id: string;
  attendance: 'clock' | 'operator-started';
  human_floor?: string;
  /** Where it actually runs. A named process with no runner is a story. */
  runner?: string;
}

/** PLAN.md §4, closing line. review-reply's floor is the 1-star case. */
export const PROCESSES: Process[] = [
  {
    id: 'review-reply',
    attendance: 'clock',
    human_floor: '1-star replies go to a person',
    runner: 'workers/review-reply',
  },
  {
    id: 'shop-alerts',
    attendance: 'clock',
    human_floor: 'someone reads the shop alerts',
    runner: 'workers/shop-alerts',
  },
  { id: 'catering-email', attendance: 'operator-started', runner: 'scripts/catering-email' },
  { id: 'weekly-summary', attendance: 'operator-started', runner: 'scripts/weekly-summary' },
];

/** Who can read what. Used by role_acl and, in Phase 2, who_can_see. */
export interface Principal {
  role: 'ops' | 'marketing' | 'guest';
  can_read: string[];
}

/**
 * Marketing and Guest must not reach customer PII.
 *
 * The public 1-star reply is marketing's job. The refund payee email is not.
 * PLAN.md §8 case 6: same tool, two roles, two answers — because the row is
 * an email, not a review.
 */
export const PRINCIPALS: Principal[] = [
  { role: 'ops', can_read: ['matrix', 'processes', 'customer_pii'] },
  { role: 'marketing', can_read: ['matrix', 'processes'] },
  { role: 'guest', can_read: ['matrix', 'processes'] },
];

/**
 * Ops-only: who we paid. Not why we replied in public.
 */
export interface Trace {
  id: string;
  process: string;
  resource: string;
  summary: string;
  decided_by: string;
  /** The secret. A 403 body must never contain this. */
  customer_email: string;
  rationale: string;
}

export const TRACES: Trace[] = [
  {
    id: 'refund-lakeside-0412',
    process: 'review-reply',
    resource: 'customer_pii',
    summary: 'refund payee for a 1-star (PII held)',
    decided_by: 'ops',
    customer_email: 'm.chen@example.net',
    rationale:
      'Refund $18.00 to m.chen@example.net, order 4412. Do not put the email in a public reply.',
  },
];

export interface Fixtures {
  /** Simulates --no-live. A live-rigor check must never PASS when this is set. */
  liveOff: boolean;
  order_online: Record<string, { wired: boolean; code: number; body: string }>;
  privacy: Record<string, number>;
  ledger: Record<string, { lastRowAgeH: number; lastPollAgeH: number; boundH: number }>;
  cron: Record<string, string[]>;
  processes: Process[];
  forms: Record<string, { path: string; spam_check: boolean }[]>;
  principals: Principal[];
}

const BODY = 'Order from Harbor Coffee — pickup at the counter.';

export function seed(overrides: Partial<Fixtures> = {}): Fixtures {
  return {
    liveOff: false,

    // The order button is in the lakeside build. The page is gone.
    order_online: {
      lakeside: { wired: true, code: 404, body: '' },
      campus: { wired: true, code: 200, body: BODY },
      station: { wired: false, code: 200, body: BODY },
    },

    privacy: { lakeside: 200, campus: 200, station: 200 },

    ledger: {
      lakeside: { lastRowAgeH: 2, lastPollAgeH: 76, boundH: 24 },
      campus: { lastRowAgeH: 3, lastPollAgeH: 3, boundH: 24 },
      station: { lastRowAgeH: 5, lastPollAgeH: 5, boundH: 24 },
    },

    cron: {
      lakeside: ['0 * * * *'],
      campus: ['0 * * * *'],
      station: ['0 * * * *'],
    },

    forms: {
      lakeside: [{ path: '/catering', spam_check: true }],
      campus: [{ path: '/catering', spam_check: false }],
      station: [{ path: '/catering', spam_check: true }],
    },

    processes: PROCESSES,
    principals: PRINCIPALS,
    ...overrides,
  };
}
