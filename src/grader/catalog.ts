import type { Status, Verdict } from './status';
import { P, F, PART, NA, MAN, DEG } from './status';
import type { Site, Fixtures } from './fixtures';

/**
 * A check must say what it does NOT prove.
 *
 * This is the whole thesis of the demo. A green cell is a claim under a stated
 * rigor, not a guarantee about the world, and the gap between those two is
 * where every planted defect in PLAN.md §4 lives. A check that cannot name its
 * own blind spot is not finished, so the field is required and non-empty — the
 * type refuses it at compile time and the selftest refuses it again at runtime.
 */
export interface Check {
  id: string;
  claim: string;
  /** How hard the evidence is: what the check actually touched. */
  rigor: 'live' | 'content' | 'config' | 'git';
  proves: string;
  does_not_prove: string;
  run: (site: Site, fx: Fixtures) => Verdict;
}

/** Import is intent. A live GET is the outcome. PLAN.md §4.1 */
export function aiTxtVerdict(
  wired: boolean,
  code: number | null,
  body = '',
): Verdict {
  if (code === null) return DEG('TRANSIENT', 'live GET /.well-known/ai.txt unreachable');
  if (code !== 200) {
    return F(
      wired
        ? `kit helper imported but /.well-known/ai.txt is ${code} live`
        : `/.well-known/ai.txt is ${code} live`,
    );
  }
  if (body.trim().length < 40) return F('/.well-known/ai.txt is 200 but empty/stub');
  if (!wired) return PART('served live, not via the kit helper');
  return P('kit helper + live 200');
}

/**
 * Same three-way shape as aiTxtVerdict, and it exists for the same reason.
 *
 * privacy_page is the control row: PASS on all three sites, so a reader can see
 * that not everything here is red. But a check that has never been shown to
 * fail is not a check yet, and the seed alone can only ever exercise its PASS
 * branch. The probe supplies the other two branches without disturbing the
 * control.
 */
export function privacyPageVerdict(code: number | null): Verdict {
  if (code === null) return DEG('TRANSIENT', 'live GET /privacy unreachable');
  if (code !== 200) return F(`/privacy is ${code} live`);
  return P('/privacy 200');
}

/**
 * The ledger looks recent; the poll that fills it stopped.
 *
 * Row freshness is downstream of the poll, so recent-looking rows prove only
 * that something was written once — never that the writer is still running.
 * PLAN.md §4.4
 */
export function ledgerFreshVerdict(
  lastRowAgeH: number | null,
  lastPollAgeH: number | null,
  boundH: number,
): Verdict {
  if (lastRowAgeH === null || lastPollAgeH === null) {
    return DEG('TRANSIENT', 'ledger heartbeat unreadable');
  }
  if (lastPollAgeH > boundH) {
    return F(
      `rows ${lastRowAgeH}h old but last poll ${lastPollAgeH}h ago (bound ${boundH}h)`,
    );
  }
  if (lastRowAgeH > boundH) return F(`newest ledger row ${lastRowAgeH}h old`);
  return P(`rows ${lastRowAgeH}h, poll ${lastPollAgeH}h`);
}

/**
 * A gate, not a property. PLAN.md §6
 *
 * This asserts the cron trigger is DECLARED, nothing more. It deliberately does
 * not re-derive whether reviews are flowing — review_ledger_fresh owns that,
 * and the planted defect is precisely that this row stays green while that one
 * fails. Re-deriving health here would collapse the two and destroy the plant.
 */
export function cronWiredVerdict(triggers: string[]): Verdict {
  if (triggers.length === 0) return F('no cron trigger declared');
  return P(`cron declared: ${triggers.join(', ')}`);
}

/** Every clock-attended process must declare a human floor. PLAN.md §4.5 */
export function humanFloorVerdict(
  processes: { id: string; attendance: string; human_floor?: string }[],
): Verdict {
  const clock = processes.filter((p) => p.attendance === 'clock');
  const bare = clock.filter((p) => !p.human_floor || p.human_floor.trim() === '');
  if (bare.length > 0) {
    return F(`clock process without human_floor: ${bare.map((p) => p.id).join(', ')}`);
  }
  return P(`${clock.length} clock processes, all with a declared floor`);
}

export const CHECKS: Check[] = [
  {
    id: 'ai_txt_live',
    claim: 'Production host serves /.well-known/ai.txt',
    rigor: 'live',
    proves: 'the URL answered 200 with a non-stub body at grade time',
    does_not_prove: 'that the file is correct, current, or that any agent reads it',
    run: (s, fx) => {
      const f = fx.ai_txt[s.key];
      return aiTxtVerdict(f.wired, fx.liveOff ? null : f.code, f.body);
    },
  },
  {
    id: 'privacy_page',
    claim: 'Privacy URL returns 200',
    rigor: 'live',
    proves: 'a privacy page exists at the expected path',
    does_not_prove: 'that its contents are accurate, current, or lawful',
    run: (s, fx) => privacyPageVerdict(fx.liveOff ? null : fx.privacy[s.key]),
  },
  {
    id: 'review_ledger_fresh',
    claim: 'Review ledger heartbeat is within bound',
    rigor: 'live',
    proves: 'a row was written inside the freshness window',
    does_not_prove: 'that the poll is still running, or that replies were sent',
    run: (s, fx) => {
      const f = fx.ledger[s.key];
      return ledgerFreshVerdict(
        fx.liveOff ? null : f.lastRowAgeH,
        fx.liveOff ? null : f.lastPollAgeH,
        f.boundH,
      );
    },
  },
  {
    id: 'cron_invocations',
    claim: 'Cron trigger is wired (declared in config)',
    rigor: 'config',
    proves: 'a schedule exists in the deployed config',
    does_not_prove: 'that it fired, succeeded, or that downstream data is fresh',
    run: (s, fx) => cronWiredVerdict(fx.cron[s.key]),
  },
  {
    id: 'human_floor_declared',
    claim: 'Every clock-attended process declares a human floor',
    rigor: 'content',
    proves: 'the floor is written down for unattended processes',
    does_not_prove: 'that a human is available, or that the floor is respected',
    run: (_s, fx) => humanFloorVerdict(fx.processes),
  },
  {
    id: 'ecommerce_tax',
    claim: 'Checkout applies tax rules',
    rigor: 'config',
    proves: 'nothing here — this site sells no products',
    does_not_prove: 'anything about the other sites; NA is scoped to this row',
    run: () => NA('no ecommerce on any Harbor site'),
  },
  {
    id: 'brand_voice',
    claim: 'Published copy matches the brand voice guide',
    rigor: 'content',
    proves: 'nothing mechanically; a person read it or did not',
    does_not_prove: 'that copy is unreviewed — only that no machine decided it',
    run: () => MAN('needs a person; no machine decides voice here'),
  },
];
