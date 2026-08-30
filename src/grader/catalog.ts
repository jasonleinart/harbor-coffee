import type { Verdict } from './status';
import { P, F, PART, NA, MAN, DEG } from './status';
import type { Site, Fixtures } from './fixtures';

/**
 * A check must say what it does NOT prove.
 *
 * Kept for the grader and the chat tools. The page does not dump this into a
 * hover — that was how a coffee-shop matrix started reading like an audit log.
 */
export interface Check {
  id: string;
  claim: string;
  rigor: 'live' | 'content' | 'config';
  proves: string;
  does_not_prove: string;
  run: (site: Site, fx: Fixtures) => Verdict;
}

/** The order button is in the build. Whether /order exists is a different fact. */
export function orderOnlineVerdict(
  wired: boolean,
  code: number | null,
  body = '',
): Verdict {
  if (code === null) return DEG('TRANSIENT', 'could not reach the order-online page');
  if (code !== 200) {
    return F(
      wired
        ? `the order button is in the site, but the page is missing (${code})`
        : `the order-online page is missing (${code})`,
    );
  }
  if (body.trim().length < 40) return F('the order-online page loaded but is empty');
  if (!wired) return PART('the order page works; it was not built the usual way');
  return P('the order-online page is up');
}

/** @deprecated name kept so older tests that imported it still typecheck during edit */
export const aiTxtVerdict = orderOnlineVerdict;

export function privacyPageVerdict(code: number | null): Verdict {
  if (code === null) return DEG('TRANSIENT', 'could not reach the privacy page');
  if (code !== 200) return F(`the privacy page is missing (${code})`);
  return P('the privacy page is up');
}

export function ledgerFreshVerdict(
  lastRowAgeH: number | null,
  lastPollAgeH: number | null,
  boundH: number,
): Verdict {
  if (lastRowAgeH === null || lastPollAgeH === null) {
    return DEG('TRANSIENT', 'could not read the review inbox');
  }
  if (lastPollAgeH > boundH) {
    return F(
      `the review list looks ${lastRowAgeH}h old, but nothing has been downloaded in ${lastPollAgeH}h`,
    );
  }
  if (lastRowAgeH > boundH) return F(`newest review is ${lastRowAgeH}h old`);
  return P('new reviews have been downloaded within a day');
}

/** On the calendar ≠ actually arriving. */
export function cronWiredVerdict(triggers: string[]): Verdict {
  if (triggers.length === 0) return F('no review download is scheduled');
  return P('the review download is on the calendar');
}

export function humanFloorVerdict(
  processes: { id: string; attendance: string; human_floor?: string }[],
): Verdict {
  const clock = processes.filter((p) => p.attendance === 'clock');
  const bare = clock.filter((p) => !p.human_floor || p.human_floor.trim() === '');
  if (bare.length > 0) {
    return F(`a nightly job has no named person: ${bare.map((p) => p.id).join(', ')}`);
  }
  return P('every nightly job names what still needs a person');
}

export function cateringFormVerdict(
  forms: { path: string; spam_check: boolean }[],
): Verdict {
  if (forms.length === 0) return NA('this shop has no public forms');
  const bare = forms.filter((f) => !f.spam_check);
  if (bare.length > 0) {
    return F(`no spam check on ${bare.map((f) => f.path).join(', ')}`);
  }
  return P('public forms have a spam check');
}

export const formsTurnstileVerdict = (
  forms: { path: string; turnstile?: boolean; spam_check?: boolean }[],
): Verdict =>
  cateringFormVerdict(
    forms.map((f) => ({ path: f.path, spam_check: f.spam_check ?? Boolean(f.turnstile) })),
  );

export function roleAclVerdict(
  principals: { role: string; can_read: string[] }[],
  guarded = 'customer_pii',
): Verdict {
  const ops = principals.find((p) => p.role === 'ops');
  if (!ops || !ops.can_read.includes(guarded)) {
    return F('ops cannot read customer emails; the door is backwards');
  }
  const leaked = principals.filter(
    (p) => p.role !== 'ops' && p.can_read.includes(guarded),
  );
  if (leaked.length > 0) {
    return F(`${leaked.map((p) => p.role).join(', ')} can read customer emails`);
  }
  return P('customer emails stay with ops');
}

export const CHECKS: Check[] = [
  {
    id: 'order_online',
    claim: 'Order-online page is up',
    rigor: 'live',
    proves: 'someone can open /order right now',
    does_not_prove: 'that orders go through, or that the kitchen sees them',
    run: (s, fx) => {
      const f = fx.order_online[s.key];
      return orderOnlineVerdict(f.wired, fx.liveOff ? null : f.code, f.body);
    },
  },
  {
    id: 'privacy',
    claim: 'Privacy page is up',
    rigor: 'live',
    proves: 'the privacy page loads',
    does_not_prove: 'that the policy is accurate or current',
    run: (s, fx) => privacyPageVerdict(fx.liveOff ? null : fx.privacy[s.key]),
  },
  {
    id: 'reviews_arriving',
    claim: 'New Google reviews are still arriving',
    rigor: 'live',
    proves: 'the inbox was downloaded recently',
    does_not_prove: 'that anyone replied, or that the download job is healthy',
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
    id: 'review_download_scheduled',
    claim: 'Review download is on the calendar',
    rigor: 'config',
    proves: 'a schedule exists',
    does_not_prove: 'that it ran, or that reviews are actually arriving',
    run: (s, fx) => cronWiredVerdict(fx.cron[s.key]),
  },
  {
    id: 'one_star_to_a_person',
    claim: '1-star review replies go to a person',
    rigor: 'content',
    proves: 'it is written down',
    does_not_prove: 'that a person is on shift, or that they actually reply',
    run: (_s, fx) => humanFloorVerdict(fx.processes),
  },
  {
    id: 'catering_form',
    claim: 'Catering form is not open to bots',
    rigor: 'content',
    proves: 'a spam check is on the form',
    does_not_prove: 'that spam stopped',
    run: (s, fx) => cateringFormVerdict(fx.forms[s.key]),
  },
  {
    id: 'customer_emails',
    claim: 'Customer emails stay with ops',
    rigor: 'config',
    proves: 'the door is specified that way',
    does_not_prove: 'that the running site enforces it',
    run: (_s, fx) => roleAclVerdict(fx.principals),
  },
  {
    id: 'online_store',
    claim: 'Online store charges tax',
    rigor: 'config',
    proves: 'nothing — Harbor does not sell bags online',
    does_not_prove: 'anything about the cafés themselves',
    run: () => NA('Harbor does not sell coffee bags online'),
  },
  {
    id: 'chalkboard',
    claim: 'Seasonal board copy is on-brand',
    rigor: 'content',
    proves: 'nothing a machine can prove',
    does_not_prove: 'that nobody read it — only that no machine decided it',
    run: () => MAN('a person has to read the board; a script cannot'),
  },
];
