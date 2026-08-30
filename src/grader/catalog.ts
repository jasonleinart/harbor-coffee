import type { Status, Verdict } from './status';
import { P, F, PART, NA, MAN, DEG } from './status';
import type { Site, Fixtures } from './fixtures';
import { KIT_CURRENT_TAG } from './fixtures';

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

/**
 * A container firing on a non-production host pollutes production data.
 *
 * The tag is live and healthy either way — that is what makes this one hard to
 * see from the inside. Only the hostname allowlist separates a working setup
 * from one quietly counting staging traffic as real.
 */
export function gtmProdHostVerdict(hostnames: string[], prodHost: string): Verdict {
  if (hostnames.length === 0) return F('container fires on no declared hostname');
  const extra = hostnames.filter((h) => h !== prodHost);
  if (extra.length > 0) return F(`container also fires on: ${extra.join(', ')}`);
  return P(`gated to ${prodHost}`);
}

/** Every public form behind Turnstile, or name the ones that are not. */
export function formsTurnstileVerdict(
  forms: { path: string; turnstile: boolean }[],
): Verdict {
  if (forms.length === 0) return NA('no public forms on this site');
  const bare = forms.filter((f) => !f.turnstile);
  if (bare.length > 0) {
    return F(`public form without Turnstile: ${bare.map((f) => f.path).join(', ')}`);
  }
  return P(`${forms.length} public form(s), all behind Turnstile`);
}

/**
 * Behind is not broken. An old pin is PARTIAL, a missing one is FAIL.
 *
 * Collapsing those two would be its own small lie: a site that pins nothing has
 * no reproducible build, while a site pinning v2.1.0 has one that is merely
 * old. Different problems, different urgency, different glyph.
 */
export function kitPinVerdict(pinned: string | undefined, current: string): Verdict {
  if (!pinned) return F('no kit tag pinned');
  if (pinned !== current) return PART(`pinned ${pinned}, current is ${current}`);
  return P(`pinned ${pinned}`);
}

/** Meta row: every named process has somewhere to actually run. */
export function processCatalogVerdict(
  processes: { id: string; attendance: string; runner?: string }[],
): Verdict {
  if (processes.length === 0) return F('no processes declared');
  const orphans = processes.filter((p) => !p.runner || p.runner.trim() === '');
  if (orphans.length > 0) {
    return F(`process with no runner path: ${orphans.map((p) => p.id).join(', ')}`);
  }
  return P(`${processes.length} processes, all with a runner`);
}

/**
 * Marketing must not reach ops traces.
 *
 * Asserted as a property of the principal table rather than by attempting a
 * read, so the row grades the same whether or not anything has been requested
 * yet. Phase 2's who_can_see enforces it at the door; this proves the door was
 * specified correctly in the first place.
 */
export function roleAclVerdict(
  principals: { role: string; can_read: string[] }[],
  guarded = 'ops_trace',
): Verdict {
  const ops = principals.find((p) => p.role === 'ops');
  if (!ops || !ops.can_read.includes(guarded)) {
    return F(`ops cannot read ${guarded}; the ACL is inverted or empty`);
  }
  const leaked = principals.filter(
    (p) => p.role !== 'ops' && p.can_read.includes(guarded),
  );
  if (leaked.length > 0) {
    return F(`${leaked.map((p) => p.role).join(', ')} can read ${guarded}`);
  }
  return P(`${guarded} restricted to ops`);
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
    id: 'gtm_prod_host',
    claim: 'GTM container is gated to production hostnames',
    rigor: 'content',
    proves: 'the container declares only the production host',
    does_not_prove: 'that tags fire correctly, or that events reach the property',
    run: (s, fx) => gtmProdHostVerdict(fx.gtm[s.key].hostnames, 'harborcoffee.example'),
  },
  {
    id: 'forms_turnstile',
    claim: 'Every public form is behind Turnstile',
    rigor: 'content',
    proves: 'a Turnstile widget is wired to each public form',
    does_not_prove: 'that the widget validates server-side, or that spam stopped',
    run: (s, fx) => formsTurnstileVerdict(fx.forms[s.key]),
  },
  {
    id: 'kit_pin',
    claim: 'Site pins the current kit tag',
    rigor: 'git',
    proves: 'the declared dependency matches the current release',
    does_not_prove: 'that the pinned build was deployed, or that it works',
    run: (s, fx) => kitPinVerdict(fx.kit_pin[s.key], KIT_CURRENT_TAG),
  },
  {
    id: 'process_catalog',
    claim: 'Every named process has a runner path',
    rigor: 'content',
    proves: 'each declared process points somewhere it could run',
    does_not_prove: 'that the runner exists, is deployed, or has ever executed',
    run: (_s, fx) => processCatalogVerdict(fx.processes),
  },
  {
    id: 'role_acl',
    claim: 'Only ops can read ops traces',
    rigor: 'config',
    proves: 'the principal table restricts the guarded resource',
    does_not_prove: 'that the running service enforces it — that is who_can_see',
    run: (_s, fx) => roleAclVerdict(fx.principals),
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
