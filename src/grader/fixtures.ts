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
    id: 'conformance',
    attendance: 'clock',
    human_floor: 'DEGRADED rows are triaged by a person',
    runner: 'workers/conformance',
  },
  { id: 'class-email', attendance: 'operator-started', runner: 'scripts/class-email' },
  { id: 'weekly-pulse', attendance: 'operator-started', runner: 'scripts/weekly-pulse' },
];

/** Who can read what. Used by role_acl and, in Phase 2, who_can_see. */
export interface Principal {
  role: 'ops' | 'marketing' | 'guest';
  can_read: string[];
}

/**
 * Marketing and Guest must not reach ops traces.
 *
 * The 1-star approval trace is the thing Marketing is not cleared for, and
 * PLAN.md §8 case 6 turns on it: the same question returns a trace for Ops and
 * a denial for Marketing.
 */
export const PRINCIPALS: Principal[] = [
  { role: 'ops', can_read: ['matrix', 'processes', 'ops_trace'] },
  { role: 'marketing', can_read: ['matrix', 'processes'] },
  { role: 'guest', can_read: ['matrix', 'processes'] },
];

export const KIT_CURRENT_TAG = 'v2.4.0';

export interface Fixtures {
  /** Simulates --no-live. A live-rigor check must never PASS when this is set. */
  liveOff: boolean;
  ai_txt: Record<string, { wired: boolean; code: number; body: string }>;
  privacy: Record<string, number>;
  ledger: Record<string, { lastRowAgeH: number; lastPollAgeH: number; boundH: number }>;
  cron: Record<string, string[]>;
  processes: Process[];
  /** GTM container: which hostnames it fires on, per site. */
  gtm: Record<string, { hostnames: string[] }>;
  /** Public forms and whether each is behind Turnstile. */
  forms: Record<string, { path: string; turnstile: boolean }[]>;
  /** The kit tag each site pins. */
  kit_pin: Record<string, string>;
  principals: Principal[];
}

const BODY = '# Harbor Coffee\n\n> A synthetic fleet used to demonstrate keep-true grading.';

export function seed(overrides: Partial<Fixtures> = {}): Fixtures {
  return {
    liveOff: false,

    // PLANT 1 — import is not deployment.
    // lakeside imports the helper and still 404s: the repo says yes, the URL
    // says no, and only one of those is the outcome.
    // station serves a hand-rolled page: right outcome, off-standard route.
    ai_txt: {
      lakeside: { wired: true, code: 404, body: '' },
      campus: { wired: true, code: 200, body: BODY },
      station: { wired: false, code: 200, body: BODY },
    },

    // Control row: green everywhere, so the matrix is not uniformly red.
    privacy: { lakeside: 200, campus: 200, station: 200 },

    // PLANT 4 — rows look fresh, the poll that writes them is stale.
    // lakeside's newest row is 2h old and would read as healthy on its own.
    ledger: {
      lakeside: { lastRowAgeH: 2, lastPollAgeH: 76, boundH: 24 },
      campus: { lastRowAgeH: 3, lastPollAgeH: 3, boundH: 24 },
      station: { lastRowAgeH: 5, lastPollAgeH: 5, boundH: 24 },
    },

    // Stays green on lakeside while the ledger row above fails. That pair is
    // the point: the schedule is declared, and declaring it proves nothing
    // about whether data arrived.
    cron: {
      lakeside: ['0 * * * *'],
      campus: ['0 * * * *'],
      station: ['0 * * * *'],
    },

    // PLANT — station's container also fires on a preview host.
    // A container that fires off production sends real events from a staging
    // URL, and the tag itself looks perfectly healthy while it happens.
    gtm: {
      lakeside: { hostnames: ['harborcoffee.example'] },
      campus: { hostnames: ['harborcoffee.example'] },
      station: { hostnames: ['harborcoffee.example', 'preview.harborcoffee.example'] },
    },

    // PLANT — campus ships a public form with no Turnstile.
    forms: {
      lakeside: [{ path: '/contact', turnstile: true }],
      campus: [
        { path: '/contact', turnstile: true },
        { path: '/catering', turnstile: false },
      ],
      station: [{ path: '/contact', turnstile: true }],
    },

    // PLANT — station pins an old kit tag. Not broken, just behind: PARTIAL.
    kit_pin: {
      lakeside: KIT_CURRENT_TAG,
      campus: KIT_CURRENT_TAG,
      station: 'v2.1.0',
    },

    processes: PROCESSES,
    principals: PRINCIPALS,
    ...overrides,
  };
}
