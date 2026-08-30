import { describe, it, expect } from 'vitest';
import {
  canRead,
  whoCanSee,
  listProcesses,
  readTrace,
  ROLES,
  PRINCIPALS,
  TRACES,
} from '../src/grader/acl';

const TRACE_ID = TRACES[0].id;

describe('the door: Marketing cannot read an ops trace', () => {
  it('ops gets the trace', () => {
    const r = readTrace('ops', TRACE_ID);
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.data.id).toBe(TRACE_ID);
  });

  // PLAN.md Phase 2 "Done": Marketing fetch of trace id returns 403.
  it('marketing gets 403, not the trace', () => {
    const r = readTrace('marketing', TRACE_ID);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(403);
  });

  it('guest gets 403 too', () => {
    expect(readTrace('guest', TRACE_ID).status).toBe(403);
  });

  // A denial that quotes what it is withholding has not withheld it.
  it('a denial leaks no trace content', () => {
    const r = readTrace('marketing', TRACE_ID);
    expect(r.allowed).toBe(false);
    const body = JSON.stringify(r);
    expect(body).not.toContain(TRACES[0].rationale);
    expect(body).not.toContain(TRACES[0].summary);
    expect(body).not.toContain('refund');
  });

  // Authorization must come first. If existence were checked first, an
  // unauthorized caller could tell a real id from a fake one by the status
  // code — reading the secret one bit at a time.
  it('an unauthorized role gets 403 for a real AND a fake id', () => {
    expect(readTrace('marketing', TRACE_ID).status).toBe(403);
    expect(readTrace('marketing', 'trace-does-not-exist').status).toBe(403);
  });

  it('an authorized role gets 404 for a fake id', () => {
    expect(readTrace('ops', 'trace-does-not-exist').status).toBe(404);
  });
});

describe('deny by default', () => {
  it('an unknown role reads nothing', () => {
    expect(canRead('admin', 'matrix')).toBe(false);
    expect(canRead('', 'matrix')).toBe(false);
    expect(readTrace('admin', TRACE_ID).status).toBe(403);
    expect(listProcesses('admin').allowed).toBe(false);
  });

  it('an unlisted resource is denied to every role', () => {
    for (const role of ROLES) {
      expect(canRead(role, 'payroll'), `${role} read payroll`).toBe(false);
    }
  });
});

describe('list_processes', () => {
  it('every declared role can list processes, including guest', () => {
    for (const role of ROLES) {
      const r = listProcesses(role);
      expect(r.allowed, `${role} denied processes`).toBe(true);
    }
  });

  it('carries the human floor, which is the point of the row', () => {
    const r = listProcesses('marketing');
    expect(r.allowed).toBe(true);
    if (!r.allowed) return;
    const rr = r.data.find((p) => p.id === 'review-reply')!;
    expect(rr.attendance).toBe('clock');
    expect(rr.human_floor).toContain('1-star');
  });

  // The floor is public; the decision behind it is not. Marketing must be able
  // to see that a person handles 1-star replies without seeing which customer
  // or why.
  it('names the floor without exposing the trace rationale', () => {
    const r = listProcesses('marketing');
    expect(r.allowed).toBe(true);
    expect(JSON.stringify(r)).not.toContain(TRACES[0].rationale);
  });
});

describe('who_can_see', () => {
  it('reports ops_trace as ops-only', () => {
    const w = whoCanSee('ops_trace');
    expect(w.roles).toEqual(['ops']);
    expect(w.denied).toContain('marketing');
    expect(w.denied).toContain('guest');
  });

  it('reports a shared resource as shared', () => {
    expect(whoCanSee('matrix').roles.sort()).toEqual(['guest', 'marketing', 'ops']);
  });

  it('agrees with canRead for every role and resource', () => {
    const resources = ['matrix', 'processes', 'ops_trace', 'payroll'];
    for (const res of resources) {
      const w = whoCanSee(res);
      for (const role of ROLES) {
        expect(w.roles.includes(role), `${role}/${res}`).toBe(canRead(role, res));
      }
    }
  });
});

describe('the ACL can fail', () => {
  it('a leaked principal table lets marketing through — the door is real', () => {
    const leaked = PRINCIPALS.map((p) =>
      p.role === 'marketing' ? { ...p, can_read: [...p.can_read, 'ops_trace'] } : p,
    );
    expect(readTrace('marketing', TRACE_ID, TRACES, leaked).allowed).toBe(true);
    expect(readTrace('marketing', TRACE_ID).status).toBe(403);
  });
});
