import { renderMatrix } from './html';
import { grade, explainCell, seed, CHECKS, SITES } from './grader';

/**
 * Phase 1 Worker: the matrix, and the JSON behind it. No chat yet.
 *
 * The JSON route exists so a reader can see exactly what the model will be
 * handed in Phase 3. If the page and the model ever disagree, that gap is the
 * bug — so both read the same grade() call.
 */
export default {
  async fetch(request: Request): Promise<Response> {
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

    if (url.pathname === '/' || url.pathname === '/matrix') {
      return new Response(renderMatrix(liveOff), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('not found', { status: 404 });
  },
};
