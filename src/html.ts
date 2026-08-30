import { CHECKS } from './grader/catalog';
import { SITES, grade, seed } from './grader';
import { GLYPH } from './grader/status';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The matrix as a page. No chat, no model — Phase 1 has to stand on its own.
 *
 * Every cell carries its note, its proves and its does_not_prove in a title
 * attribute, so the claim and its limit travel together. Splitting them is how
 * a green cell starts meaning more than it earned.
 */
export function renderMatrix(liveOff = false): string {
  const cells = grade(seed({ liveOff }));
  const find = (site: string, check: string) =>
    cells.find((c) => c.site === site && c.check === check)!;

  const rows = CHECKS.map((check) => {
    const tds = SITES.map((s) => {
      const c = find(s.key, check.id);
      const tip = `${check.claim}\n\nrigor: ${check.rigor}\nnote: ${c.note}\n\nproves: ${check.proves}\ndoes not prove: ${check.does_not_prove}`;
      return `<td class="s-${c.status}" title="${esc(tip)}"><span class="g">${c.glyph}</span> ${c.status}</td>`;
    }).join('');
    return `<tr><th scope="row"><code>${esc(check.id)}</code><small>${esc(check.rigor)}</small></th>${tds}</tr>`;
  }).join('\n');

  const notes = cells
    .filter((c) => c.status !== 'PASS' && c.note)
    .map((c) => `<li><code>${esc(c.site)}/${esc(c.check)}</code> — ${esc(c.note)}</li>`)
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harbor Coffee — keep-true matrix</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --line:#d8d8d8; --mut:#666; --head:#f6f6f6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#131313; --fg:#eee; --line:#333; --mut:#999; --head:#1c1c1c; }
  }
  body { background:var(--bg); color:var(--fg); margin:0; padding:2rem 1.25rem;
         font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
  main { max-width:60rem; margin:0 auto; }
  h1 { font-size:1.1rem; margin:0 0 .25rem; }
  p.sub { color:var(--mut); margin:0 0 1.5rem; }
  .wrap { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid var(--line); padding:.5rem .6rem; text-align:left; white-space:nowrap; }
  thead th { background:var(--head); }
  th[scope=row] { font-weight:400; }
  th[scope=row] small { display:block; color:var(--mut); font-size:.75rem; }
  td { cursor:help; }
  .g { font-family:system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif; }
  .s-FAIL { color:#c0392b; } .s-PARTIAL { color:#b8860b; }
  .s-DEGRADED { color:#8e44ad; } .s-MANUAL { color:var(--mut); } .s-NA { color:var(--mut); }
  ul { padding-left:1.1rem; } li { margin:.2rem 0; }
  .legend { margin-top:2rem; border-top:1px solid var(--line); padding-top:1rem;
            color:var(--mut); font-size:.85rem; }
  code { font:inherit; }
</style></head><body><main>
<h1>Harbor Coffee — keep-true matrix${liveOff ? ' (live fixtures OFF)' : ''}</h1>
<p class="sub">Synthetic fleet. Hover any cell for what it proves and what it does not.</p>
<div class="wrap"><table>
<thead><tr><th scope="col">check</th>${SITES.map((s) => `<th scope="col">${esc(s.key)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<h2 style="font-size:.95rem;margin:1.75rem 0 .5rem">Notes</h2>
<ul>
${notes}
</ul>
<div class="legend">
  ${Object.entries(GLYPH).map(([k, v]) => `${v} ${k}`).join(' &nbsp; ')}
  <p><strong>—&nbsp;NA</strong> means evaluated and not applicable.
     <strong>❓&nbsp;MANUAL</strong> means no machine decided it. They are different,
     which is why they do not share a glyph.</p>
</div>
</main></body></html>`;
}
