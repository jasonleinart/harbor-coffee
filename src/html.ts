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
  #chat { margin:2rem 0; border:1px solid var(--line); padding:1rem; }
  #chat h2 { font-size:.95rem; margin:0 0 .25rem; }
  #log { margin:1rem 0; }
  .msg { margin:.6rem 0; padding:.5rem .7rem; border-left:2px solid var(--line); }
  .msg.u { border-left-color:#3498db; }
  .msg.a { border-left-color:#27ae60; }
  .msg.r { border-left-color:#c0392b; }
  .tool { margin:.35rem 0 .35rem 1rem; font-size:.82rem; color:var(--mut); }
  .tool summary { cursor:pointer; }
  .tool pre { overflow-x:auto; background:var(--head); padding:.5rem; margin:.35rem 0 0; }
  form { display:flex; gap:.5rem; }
  #q { flex:1; padding:.5rem; font:inherit; background:var(--bg); color:var(--fg);
       border:1px solid var(--line); }
  button { padding:.5rem 1rem; font:inherit; cursor:pointer; background:var(--head);
           color:var(--fg); border:1px solid var(--line); }
  #egs code { cursor:pointer; text-decoration:underline dotted; margin-right:.75rem; }
</style></head><body><main>
<h1>Harbor Coffee — keep-true matrix${liveOff ? ' (live fixtures OFF)' : ''}</h1>
<p class="sub">Synthetic fleet. Hover any cell for what it proves and what it does not.</p>
<div class="wrap"><table>
<thead><tr><th scope="col">check</th>${SITES.map((s) => `<th scope="col">${esc(s.key)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<section id="chat">
  <h2>Ask the grader</h2>
  <p class="sub">Role: <select id="role">
    <option value="guest">guest</option><option value="marketing">marketing</option><option value="ops">ops</option>
  </select> &nbsp; The model may not assert a status without calling a tool. When it cannot, it refuses.</p>
  <div id="log"></div>
  <form id="f"><input id="q" placeholder="Is lakeside ai.txt OK?" autocomplete="off">
  <button>Ask</button></form>
  <p class="sub" id="egs"></p>
</section>

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
</main>
<script>
const EG = ['Is lakeside ai.txt OK?','Why is campus green and lakeside not?',
  'Are we collecting reviews?','Can I ignore the dash on ecommerce?',
  'Is the cron healthy so reviews are fine?','Show me why we approved that 1-star.'];
document.getElementById('egs').innerHTML = 'Try: ' +
  EG.map(e => '<code>' + e + '</code>').join('');
document.getElementById('egs').onclick = e => {
  if (e.target.tagName === 'CODE') { document.getElementById('q').value = e.target.textContent; }
};
const log = document.getElementById('log');
function add(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls; d.textContent = text; log.appendChild(d); return d;
}
document.getElementById('f').onsubmit = async ev => {
  ev.preventDefault();
  const q = document.getElementById('q'); const text = q.value.trim();
  if (!text) return;
  add('u', text); q.value = ''; const pending = add('a', 'thinking...');
  try {
    const res = await fetch('/chat', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ message:text, role: document.getElementById('role').value }) });
    const d = await res.json();
    pending.remove();
    // The tool calls render BEFORE the answer, because the whole claim of this
    // page is that the answer came from them.
    for (const t of (d.toolCalls || [])) {
      const det = document.createElement('details'); det.className = 'tool';
      det.innerHTML = '<summary>used <b>' + t.name + '</b>(' +
        JSON.stringify(t.args) + ')</summary><pre>' +
        JSON.stringify(t.result, null, 2).replace(/</g,'&lt;') + '</pre>';
      log.appendChild(det);
    }
    add(d.refused ? 'r' : 'a', d.answer || d.error || '(no answer)');
  } catch (err) { pending.remove(); add('r', 'Request failed: ' + err.message); }
  log.scrollIntoView({block:'end'});
};
</script>
</body></html>`;
}
