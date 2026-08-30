import { CHECKS } from './grader/catalog';
import { SITES, grade, seed } from './grader';
import { LABEL } from './grader/status';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The matrix as a page. Claims in English. No hover essays.
 */
export function renderMatrix(liveOff = false): string {
  const cells = grade(seed({ liveOff }));
  const find = (site: string, check: string) =>
    cells.find((c) => c.site === site && c.check === check)!;

  const rows = CHECKS.map((check) => {
    const tds = SITES.map((s) => {
      const c = find(s.key, check.id);
      return `<td class="s-${c.status}">${esc(LABEL[c.status])}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(check.claim)}</th>${tds}</tr>`;
  }).join('\n');

  const notes = cells
    .filter((c) => c.status !== 'PASS' && c.note)
    .map((c) => {
      const claim = CHECKS.find((x) => x.id === c.check)?.claim ?? c.check;
      return `<li><strong>${esc(c.site)}</strong> — ${esc(claim)}: ${esc(c.note)}</li>`;
    })
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
  td { cursor:default; }
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
<h1>Harbor Coffee — three shops${liveOff ? ' (could not reach the live pages)' : ''}</h1>
<p class="sub">A cell is one claim about one shop. OK does not mean everything is fine.</p>
<div class="wrap"><table>
<thead><tr><th scope="col"></th>${SITES.map((s) => `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<section id="chat">
  <h2>Ask the grader</h2>
  <p class="sub">Who is asking:
    <select id="role">
    <option value="guest">guest</option><option value="marketing">marketing</option><option value="ops">ops</option>
  </select>
  The assistant has to look at the grid. If it cannot, it says so.</p>
  <div id="log"></div>
  <form id="f"><input id="q" placeholder="Is lakeside's order-online page up?" autocomplete="off">
  <button>Ask</button></form>
  <p class="sub" id="egs"></p>
</section>

<h2 style="font-size:.95rem;margin:1.75rem 0 .5rem">Notes</h2>
<ul>
${notes}
</ul>
<div class="legend">
  ${Object.entries(LABEL).map(([k, v]) => `<span>${esc(v)}</span>`).join(' · ')}
  <p><strong>Does not apply</strong> means we looked, and this shop does not do that.
     <strong>Needs a person</strong> means a script cannot decide. Those are not the same.</p>
</div>
</main>
<script>
const EG = ['Is lakeside order-online up?','Why is campus fine and lakeside not?',
  'Are we still getting reviews?','Can I ignore the dashes?',
  'What still needs a person on reviews?','What is the customer email on the lakeside refund?'];
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
