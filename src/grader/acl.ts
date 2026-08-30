import { PRINCIPALS, PROCESSES, TRACES, type Principal, type Process, type Trace } from './fixtures';

export type Role = Principal['role'];

export const ROLES: Role[] = ['ops', 'marketing', 'guest'];

export function isRole(x: string): x is Role {
  return (ROLES as string[]).includes(x);
}

/**
 * One gate. Every read goes through here.
 *
 * The rule is deny-by-default: an unknown role or an unlisted resource is a
 * refusal, not a fallthrough. A permissive default is how an ACL passes its own
 * tests and still leaks — the tests only ever name resources someone remembered
 * to protect.
 */
export function canRead(role: string, resource: string, principals: Principal[] = PRINCIPALS): boolean {
  const p = principals.find((x) => x.role === role);
  if (!p) return false;
  return p.can_read.includes(resource);
}

export interface Denial {
  allowed: false;
  status: 403;
  role: string;
  resource: string;
  reason: string;
}

export interface Grant<T> {
  allowed: true;
  role: string;
  resource: string;
  data: T;
}

export type Guarded<T> = Grant<T> | Denial;

function deny(role: string, resource: string): Denial {
  return {
    allowed: false,
    status: 403,
    role,
    resource,
    // Names the resource and the role, never the contents. A denial that leaks
    // what it is hiding is not a denial.
    reason: `role "${role}" cannot read ${resource}`,
  };
}

/** who_can_see: which roles hold a given resource. PLAN.md §7 */
export function whoCanSee(resource: string, principals: Principal[] = PRINCIPALS) {
  return {
    resource,
    roles: principals.filter((p) => p.can_read.includes(resource)).map((p) => p.role),
    denied: principals.filter((p) => !p.can_read.includes(resource)).map((p) => p.role),
  };
}

/**
 * list_processes: id, attendance, human_floor — for every role.
 *
 * The process list itself is not secret; the plan is explicit that Guest sees
 * runbooks. What Marketing must not get is the TRACE, so the floor is described
 * here while the decision behind it stays behind readTrace().
 */
export function listProcesses(
  role: string,
  processes: Process[] = PROCESSES,
  principals: Principal[] = PRINCIPALS,
): Guarded<Process[]> {
  if (!canRead(role, 'processes', principals)) return deny(role, 'processes');
  return { allowed: true, role, resource: 'processes', data: processes };
}

/** The Ops-only row. Marketing and Guest get 403. PLAN.md §4.6 */
export function readTrace(
  role: string,
  traceId: string,
  traces: Trace[] = TRACES,
  principals: Principal[] = PRINCIPALS,
): Guarded<Trace> | { allowed: false; status: 404; reason: string } {
  // Authorize BEFORE looking the id up. Checking existence first would let an
  // unauthorized caller tell a real trace id from a fake one by the status
  // code alone, which is a slower way of reading the same secret.
  if (!canRead(role, 'ops_trace', principals)) return deny(role, 'ops_trace');

  const t = traces.find((x) => x.id === traceId);
  if (!t) return { allowed: false, status: 404, reason: `no trace ${traceId}` };
  return { allowed: true, role, resource: 'ops_trace', data: t };
}

export { PRINCIPALS, PROCESSES, TRACES };
export type { Principal, Process, Trace };
