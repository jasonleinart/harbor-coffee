import { CHECKS } from './grader/catalog';
import { SITES, grade, seed } from './grader';
import { LABEL } from './grader/status';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The public page. A stranger should know what this is and what to do
 * before they hit the table.
 */
export function renderMatrix(liveOff = false): string {
  const cells = grade(seed({ liveOff }));
  const find = (site: string, check: string) =>
    cells.find((c) => c.site === site && c.check === check)!;

  const shopName = (key: string) => SITES.find((s) => s.key === key)?.name ?? key;

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
      return `<li><strong>${esc(shopName(c.site))}</strong> — ${esc(claim)}: ${esc(c.note)}</li>`;
    })
    .join('\n');

  const liveBanner = liveOff
    ? `<p class="banner">Live pages could not be reached, so anything that needs a real URL is marked “Could not check.” That is not the same as OK.</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harbor Coffee — three made-up shops</title>
<style>
  :root { color-scheme: light dark; --bg:#f7f3ee; --fg:#1a1612; --line:#d4cbbf;
          --mut:#5c5348; --head:#efe8df; --card:#fffdf9; --accent:#8b3a2f; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1a1816; --fg:#f3ece4; --line:#3a342e; --mut:#b5a99c;
            --head:#241f1b; --card:#221e1a; --accent:#e08b7c; }
  }
  * { box-sizing:border-box; }
  body { background:var(--bg); color:var(--fg); margin:0;
         font:18px/1.5 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
  main { max-width:44rem; margin:0 auto; padding:2.25rem 1.25rem 4rem; }
  .eyebrow { letter-spacing:.08em; text-transform:uppercase; font-size:.72rem;
             color:var(--mut); margin:0 0 .5rem;
             font-family:ui-sans-serif,system-ui,sans-serif; }
  h1 { font-size:2rem; line-height:1.15; font-weight:400; margin:0 0 1rem; }
  h2 { font-size:1.15rem; font-weight:600; margin:2.25rem 0 .5rem; }
  p { margin:0 0 1rem; }
  .lede { font-size:1.15rem; }
  .banner { background:var(--head); border-left:3px solid var(--accent);
            padding:.75rem 1rem; }
  ol.how { padding-left:1.25rem; margin:0 0 1.5rem; }
  ol.how li { margin:.35rem 0; }
  .wrap { overflow-x:auto; margin:1rem 0 1.25rem; background:var(--card);
          border:1px solid var(--line); }
  table { border-collapse:collapse; width:100%;
          font:14px/1.4 ui-sans-serif,system-ui,sans-serif; }
  th,td { border-bottom:1px solid var(--line); padding:.55rem .7rem; text-align:left; }
  thead th { background:var(--head); font-weight:600; }
  th[scope=row] { font-weight:500; white-space:normal; min-width:12rem; }
  td { white-space:nowrap; }
  .s-FAIL { color:#a32d22; font-weight:600; } .s-PARTIAL { color:#8a6a12; }
  .s-DEGRADED { color:#6b3d8a; } .s-MANUAL { color:var(--mut); } .s-NA { color:var(--mut); }
  ul.notes { padding-left:1.15rem; margin:0 0 1rem;
             font:15px/1.45 ui-sans-serif,system-ui,sans-serif; color:var(--mut); }
  .legend { color:var(--mut); font-size:.95rem; }
  #chat { margin:2rem 0 0; padding:1.15rem 1.2rem; background:var(--card);
          border:1px solid var(--line); }
  #log { margin:.75rem 0; }
  .msg { margin:.5rem 0; padding:.5rem .7rem; border-left:3px solid var(--line); }
  .msg.u { border-left-color:#3d6ea8; } .msg.a { border-left-color:#2f7a4a; }
  .msg.r { border-left-color:var(--accent); }
  .tool { margin:.35rem 0 .35rem 1rem; font-size:.85rem; color:var(--mut);
          font-family:ui-sans-serif,system-ui,sans-serif; }
  .tool summary { cursor:pointer; } .tool pre { overflow-x:auto; background:var(--head);
          padding:.5rem; margin:.35rem 0 0; font-size:.78rem; }
  form { display:flex; gap:.5rem; flex-wrap:wrap; }
  #q { flex:1; min-width:12rem; padding:.55rem .7rem; font:inherit;
       background:var(--bg); color:var(--fg); border:1px solid var(--line); }
  button, .eg { padding:.55rem .9rem; font:15px/1.3 ui-sans-serif,system-ui,sans-serif;
          cursor:pointer; background:var(--head); color:var(--fg);
          border:1px solid var(--line); }
  button.ask { background:var(--fg); color:var(--bg); border-color:var(--fg); }
  #egs { display:flex; flex-wrap:wrap; gap:.4rem; margin:0 0 1rem; }
  label.who { display:block; font-size:.9rem; color:var(--mut); margin:0 0 .75rem; }
  select { font:inherit; margin-left:.35rem; }
</style></head><body><main>
<p class="eyebrow">A demo · not a real café</p>
<h1>Harbor Coffee has three shops. Only one of them can take an order online.</h1>
${liveBanner}
<p class="lede">This page is a fake café chain used to show a real problem: a dashboard can look healthy while something important is broken. There is no product to buy. You are meant to poke it for a minute.</p>
<p>Lakeside still has an Order button in the website. The order page itself is missing. Campus works. Station’s page works, but it was put up a different way. That is the first row of the table.</p>

<h2>What to do</h2>
<ol class="how">
  <li>Skim the table. “Broken” is a problem. “OK” is only OK for that one row — not a gold star for the shop.</li>
  <li>Ask a question in the box. The assistant has to look at this table. If it answers without looking, it is guessing, and this page will refuse that.</li>
  <li>Try the customer-email question as <em>marketing</em>, then as <em>ops</em>. Marketing writes the public reply. They do not get the customer’s email.</li>
</ol>

<h2>The three shops</h2>
<p>Each column is a location. Each row is one thing we actually checked — can you order, are reviews still coming in, is the catering form a spam hole, and so on.</p>
<div class="wrap"><table>
<thead><tr><th scope="col">We checked</th>${SITES.map((s) => `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<p class="legend"><strong>OK</strong> — that one check passed.
<strong>Broken</strong> — it failed.
<strong>Partial</strong> — it works, not the usual way.
<strong>Does not apply</strong> — we looked; this shop does not do that (Harbor does not sell bags online).
<strong>Needs a person</strong> — a script cannot decide (someone has to read the seasonal board).
<strong>Could not check</strong> — we should have looked and could not reach it.</p>

<h2>Why some rows are not OK</h2>
<ul class="notes">
${notes}
</ul>

<section id="chat">
  <h2 style="margin-top:0">Ask about a shop</h2>
  <p>Pick who you are, then click a question or type your own.</p>
  <label class="who">I am
    <select id="role">
      <option value="guest">a guest (public)</option>
      <option value="marketing">marketing (writes public replies)</option>
      <option value="ops">ops (can see a customer email to issue a refund)</option>
    </select>
  </label>
  <div id="egs"></div>
  <div id="log"></div>
  <form id="f"><input id="q" placeholder="e.g. Can people order online from Lakeside?" autocomplete="off">
  <button class="ask">Ask</button></form>
</section>
</main>
<script>
const EG = [
  'Can people order online from Lakeside?',
  'Why does Campus work if Lakeside does not?',
  'Are we still getting Google reviews?',
  'What do “does not apply” and “needs a person” mean?',
  'Who has to handle 1-star review replies?',
  'What is the customer email on the Lakeside refund?'
];
document.getElementById('egs').innerHTML = EG.map(e => '<button type="button" class="eg">'+e+'</button>').join('');
document.getElementById('egs').onclick = e => {
  if (e.target.classList.contains('eg')) {
    document.getElementById('q').value = e.target.textContent;
    document.getElementById('q').focus();
  }
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
  add('u', text); q.value = ''; const pending = add('a', 'Looking at the table…');
  try {
    const res = await fetch('/chat', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ message:text, role: document.getElementById('role').value }) });
    const d = await res.json();
    pending.remove();
    for (const t of (d.toolCalls || [])) {
      const det = document.createElement('details'); det.className = 'tool';
      det.innerHTML = '<summary>looked up <b>' + t.name + '</b></summary><pre>' +
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
