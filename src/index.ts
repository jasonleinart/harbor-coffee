import { renderMatrix } from './html';
import { grade, explainCell, seed, CHECKS, SITES } from './grader';
import { listProcesses, whoCanSee, readTrace, isRole } from './grader/acl';
import { runChat, REFUSALS } from './chat';
import { openRouter } from './model';

export interface Env {
  OPENROUTER_API_KEY?: string;
  MODEL?: string;
}

/**
 * The Worker: matrix, grader JSON, ACL routes, and the chat loop.
 *
 * The JSON route exists so a reader can see exactly what the model will be
 * handed in Phase 3. If the page and the model ever disagree, that gap is the
 * bug — so both read the same grade() call.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const liveOff = url.searchParams.get('live') === 'off';

    if (url.pathname === '/api/grade') {
      return Response.json({ cells: grade(seed({ liveOff })), liveOff });
    }

    if (url.pathname === '/api/explain') {
      const site = url.searchParams.get('site') ?? '';
      const check = url.searchParams.get('check') ?? '';
      const out = explainCell(site, check, seed({ liveOff }));
      return Response.json(out, { status: 'error' in out ? 404 : 200 });
    }

    if (url.pathname === '/api/catalog') {
      return Response.json({
        sites: SITES,
        checks: CHECKS.map(({ id, claim, rigor, proves, does_not_prove }) => ({
          id, claim, rigor, proves, does_not_prove,
        })),
      });
    }

    // Role comes from the query string on purpose: this is a public exhibit,
    // not an auth system, and pretending otherwise would be the more dishonest
    // choice. The ACL shape is real; the identity is declared.
    const role = url.searchParams.get('role') ?? 'guest';

    if (url.pathname === '/api/processes') {
      const out = listProcesses(role);
      return Response.json(out, { status: out.allowed ? 200 : out.status });
    }

    if (url.pathname === '/api/who-can-see') {
      return Response.json(whoCanSee(url.searchParams.get('resource') ?? 'customer_pii'));
    }

    if (url.pathname === '/api/trace') {
      const out = readTrace(role, url.searchParams.get('id') ?? '');
      return Response.json(out, { status: out.allowed ? 200 : out.status });
    }

    if (url.pathname === '/chat' && request.method === 'POST') {
      // Validate the REQUEST before checking configuration. A malformed body is
      // the caller's error whether or not a key is set, and answering 502 to it
      // would blame the model for a bad request.
      let body: { message?: string; role?: string };
      try {
        body = (await request.json()) as { message?: string; role?: string };
      } catch {
        return Response.json({ error: 'bad json' }, { status: 400 });
      }
      const text = (body.message ?? '').slice(0, 2000);
      if (!text.trim()) return Response.json({ error: 'empty message' }, { status: 400 });

      if (!env.OPENROUTER_API_KEY) {
        // No key is a refusal, not a fallback to an ungrounded answer.
        return Response.json(
          { ok: false, refused: 'model_unreachable', answer: REFUSALS.model_unreachable, toolCalls: [] },
          { status: 502 },
        );
      }

      const result = await runChat(
        text,
        openRouter({ apiKey: env.OPENROUTER_API_KEY, model: env.MODEL, referer: url.origin }),
        isRole(body.role ?? '') ? body.role! : role,
      );
      return Response.json(result, { status: result.httpStatus });
    }

    if (url.pathname === '/' || url.pathname === '/matrix') {
      return new Response(renderMatrix(liveOff), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('not found', { status: 404 });
  },
};
