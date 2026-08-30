---
title: Harbor Coffee — keep-true demo (plan)
status: plan
created: 2026-08-30
---

# Harbor Coffee keep-true demo

Public, synthetic fleet. Chat asks a grader, not a document dump. Cousin of Peakscape conformance. Not a Glean clone. Not Arkon.

This repo is the Work layer. Publishing is optional and later.

**Done when:** a stranger opens one URL, asks the planted “import ≠ live URL” question, sees a tool call, sees a red or PARTIAL cell whose `does_not_prove` line is visible, the grader selftest is green (including three-way live rows), and the nine chat cases are green in CI.

**Not done when:** it looks like a coffee-shop chatbot.

Related: `~/Workspace/vault/wkm/notes/knowledge-work-problems-are-a-family.md`, `~/Workspace/vault/wkm/notes/company-brain-vs-wkm-gaps.md`. GBP series (different loop): `~/Workspace/vault/publishing/drafts/series-gbp-build-vs-buy-brief.md`.

---

## 1. Who it is for

| Audience | What they do in 90 seconds |
|---|---|
| Hiring manager | Open URL → ask one planted question → believe you know green-cell lies |
| Substack reader | Same, plus clone appendix |
| You | Proof the keep-true story is legible without client data |

Two roles: **Ops**, **Marketing**. **Guest** = runbooks + matrix with exception-trace hidden.

---

## 2. Out of scope (v1)

Slack/Drive ingest, vector DB as the product, LangGraph, Arkon, Notion/Custom GPT, real OAuth to Google, client names, Peakscape ledgers, MCP as the *only* share path, pretty wiki compiler, acting tools that publish.

MCP may exist later as a second door. The share link is the Worker.

---

## 3. Stack (option A)

- Cloudflare Worker + static HTML chat (one origin).
- D1: `sites`, `checks`, `cells` (or recompute cells on each `grade()` and only persist seed + overrides), `processes`, `traces`, `principals`.
- Grader: **TypeScript in the Worker, no model.** Same spirit as `conformance-audit.py`.
- Chat turn: OpenRouter or Workers AI. System prompt: you may not assert cell status without `grade` / `explain_cell`.
- Secrets: API key for the LLM. Optional `DEMO_KEY` if you want to throttle abuse; hiring managers should not hit a wall.
- This repo is public. Pin nothing from a private repo that names clients.

Rent: CF + LLM. Own: check functions, statuses, floors, traces schema, golden questions.

---

## 4. Fictional world (seed data)

**Harbor Coffee** — three sites: `harbor-lakeside`, `harbor-campus`, `harbor-station`.
Invent venue names. Do not reuse a real client's city, neighbourhood, or trading name — a real sector plus a real locality plus a real incident is a client fingerprint even when no client is named.

Planted facts (write these into fixtures, not into the model):

1. **Import ≠ deployed:** a `/.well-known/ai.txt` (or similar) check — helper imported in the repo fixture; live URL for **lakeside** returns 404. Campus PASS. Station PARTIAL (hand-rolled page, no kit import). Pick a well-known file for the public plant only if no private matrix already grades it; reuse of a real graded row is a fingerprint.
2. **Superseded name:** old check id `reviews_collected` retired; current id `review_ledger_fresh`. Chat that uses the old name must be corrected by `explain_cell` / catalog, not treated as current.
3. **Dash trap:** one check `NA` (“no ecommerce” — evaluated, does not apply) vs one `MANUAL` (a person must decide). They must not share a glyph. This is the sibling scar: one dash meant “safe” and “unexamined.” Guest copy must not collapse them.
4. **Poll vs ledger:** ledger rows look recent; last poll heartbeat is stale → `review_ledger_fresh` FAIL or `DEGRADED` with `does_not_prove` naming the poll. `cron_invocations` stays PASS (see §6: it is a gate, not health).
5. **Human floor:** process `review-reply` — floor = 1-star replies. Marketing cannot see the 1-star exception trace; Ops can. Do not name GBP as a vendor-of-record in the public UI if it reads as a client stack tell; “review reply” is enough.
6. **Decision trace:** one row, Ops-only: why a 1-star reply was approved.

Processes (operator-started vs clock, fake): review-reply (clock), class-email (operator-started), weekly pulse (operator-started), conformance (clock).

---

## 5. Status enum (declare in Phase 0)

Sibling: `conformance-audit.py` statuses + `EMOJI`. Harbor ships **six**. `NOTSELECTED` and `ELSEWHERE` are fleet/tier glyphs; three synthetic sites do not need them. Do not invent a seventh dash.

| Status | Glyph | Means | Must never look like |
|---|---|---|---|
| `PASS` | ✅ | Claim holds under this rigor | — |
| `FAIL` | ❌ | Claim does not hold | — |
| `PARTIAL` | ⚠️ | Outcome works, not the standard way (e.g. live 200, no kit import) | PASS |
| `NA` | — | Evaluated; condition does not apply | MANUAL, “we didn’t look” |
| `MANUAL` | ❓ | No machine can decide this here; expected to sit | NA, DEGRADED |
| `DEGRADED` | 🚨 | Machine-decidable, evidence unreachable. Note **class first**: `TRANSIENT` / `NO ACCESS` / `BROKEN` | MANUAL, PASS |

UI and `explain_cell` render the glyph from this table. The dash trap in §4.3 is why `NA` and `MANUAL` cannot share `—`.

**DEGRADED class is required.** Every `DEGRADED` return’s note starts with `TRANSIENT`, `NO ACCESS`, or `BROKEN` (class first; sibling scar and `_degraded_notes_unclassified()`). Phase 0 selftest walks every DEGRADED the grader can emit (probes + live-off path). An unclassified degradation cannot ship.

## 6. Checks to implement first (aim 10–12, not 40)

Each check: `id`, `claim`, `rigor`, `proves`, `does_not_prove`, function returning `{ status, note }`.

**`does_not_prove` is required.** Phase 0 selftest: every check in the catalog has a non-empty `does_not_prove`. A new check cannot ship without it (sibling pattern: keyed off `CHECKS`, asserted in `--selftest`).

A check that cannot be shown to fail is not yet a check. Site plants prove the *world*; **pure verdict functions** prove the *row can FAIL / DEGRADE*. Do not mutate the seed catalog mid-run.

Suggested ids:

| id | Claim (short) | Rigor | Plant |
|---|---|---|---|
| `ai_txt_live` | Production host serves /.well-known/ai.txt | live + kit-import | lakeside 404 |
| `gtm_prod_host` | GTM gated to prod hostnames | content | station leak on preview host in fixture |
| `review_ledger_fresh` | Ledger heartbeat within bound | live (fixture clock) | stale poll — this row owns freshness |
| `cron_invocations` | Cron is **wired** (trigger declared) | config/fixture | PASS if the cron line exists. **Gate, not property.** Does not re-derive poll/ledger health. Plant: cron green, ledger stale. |
| `privacy_page` | Privacy URL 200 | live | **Sites:** PASS all three (control). **Probe:** `_privacy_page_verdict(code)` — 404 FAIL, 200 PASS, unreachable DEGRADED. Independent of any site fixture. |
| `forms_turnstile` | Public forms have Turnstile | content | campus FAIL |
| `kit_pin` | Site pins current kit tag | git/fixture | station old pin PARTIAL |
| `process_catalog` | Named processes have a runner path | content | always PASS (meta) |
| `human_floor_declared` | Every clock process has human_floor | content | **Sites:** all floors present. **Probe:** `_human_floor_verdict(processes)` — PASS on the seed list; FAIL on the same list with one clock floor stripped. Do not mutate fixtures. |
| `role_acl` | Marketing cannot read ops traces | config | used by `who_can_see` |

### Grader selftest (not only golden questions)

A check marked `live` must not PASS if live fixtures are off (`--no-live` analog). Assert **per live row**, **three ways**, or a check hardcoded to FAIL still “passes” the eval:

| Check | FAIL case | PASS case | Unreachable |
|---|---|---|---|
| `ai_txt_live` | lakeside plant (404) **and** `_ai_txt_verdict(imported, 404)` | campus plant **and** verdict(imported, 200) | verdict(imported, `null`) → DEGRADED |
| `review_ledger_fresh` | stale-poll plant | campus/station in-bound | clock/poll unreachable → DEGRADED |
| `privacy_page` | **probe only** `_privacy_page_verdict(404)` — no site plant | all three sites + verdict(200) | verdict(`null`) → DEGRADED |

Sibling shape: `_llms_txt_verdict` 404 FAIL / 200 PASS / unreachable DEGRADED.

`human_floor_declared` is not live; it still needs both directions via `_human_floor_verdict`, same reason.

Every DEGRADED from those probes: note starts with `TRANSIENT` / `NO ACCESS` / `BROKEN`.

---

## 7. Chat tools (Worker RPC)

| Tool | Does | Must not |
|---|---|---|
| `grade` | Run all or one site’s checks; return matrix JSON | Invent status |
| `explain_cell` | One site × check: claim, rigor, status, proves, does_not_prove | Skip does_not_prove |
| `list_processes` | id, attendance, human_floor | Hide Ops traces from Marketing |
| `who_can_see` | Principal × resource | |

System rule: if the user asks about health/status/green/red, call `grade` or `explain_cell` in that turn.

**Tool loop (max 3 rounds) — failure is refuse, not unsourced answer.**

| Fault | `/chat` returns | Must not |
|---|---|---|
| 3 rounds, still no tool result for a status question | Explicit refuse: could not ground the answer; no PASS/FAIL/PARTIAL asserted | Guess a cell |
| OpenRouter / model timeout or 5xx | `I could not reach the grader` (or “the model”); HTTP 502/504 with that body | Invent status from training |
| Grader throw | Same refuse class; log the error | 200 + a green story |

Test the timeout path by **injecting the fault** (mock fetch abort / 504) before shipping Phase 3. That is the demo’s own failure mode: asserting a status without a tool call.

---

## 8. Eval pack (the moat)

Nine **chat** cases plus the grader selftest in §6. Chat cases: JSON, CI, grader **without** the LLM. Separate LLM-path tests: mock the model or assert the Worker injects tool results.

Golden questions (expected tool + assertion):

1. Is lakeside ai.txt OK? → `explain_cell` / `grade` → FAIL, 404, import is not enough.
2. Why is campus ai.txt green and lakeside not? → two cells.
3. Are we collecting reviews? → must not treat `reviews_collected` as current; `review_ledger_fresh` + does_not_prove poll.
4. Can I ignore the dash on ecommerce? → NA vs MANUAL (different glyphs).
5. What still needs a human on review replies? → `list_processes` human_floor.
6. Show me why we approved that 1-star. → Ops: trace. Marketing: denied.
7. Is the cron healthy so reviews are fine? → `cron_invocations` PASS (wired) while `review_ledger_fresh` FAIL.
8. Station privacy page? → PASS (control: not everything is red).
9. Guest: read the exception log. → denied.

**Live-off / unreachable is grader selftest, not a tenth chat question.** It runs on every `live` check, three-way, every CI. A chat case may still *exercise* it, but CI must not depend on the LLM to catch a lying grader.

LLM-path: at least 1 and 3 with a cheap model **or** recorded fixtures; don’t block merge on flaky OpenRouter. Plus injected-timeout refuse. Grader selftest is the gate.

---

## 9. UI (deliberately plain)

- Role switcher (query param or cookie): `?role=ops|marketing|guest`.
- Chat transcript.
- Optional: matrix table under the chat so the human can see the same JSON the model saw.
- No brand theater. Harbor logo optional; the cell is the product.

---

## 10. Phases

### Phase 0 — Fixtures (half day)

- `wrangler.toml`, D1 schema, seed SQL or JSON fixtures for three sites.
- Status enum + glyphs as a typed module (`PASS` \| `FAIL` \| …). Invalid status fails compile or selftest.
- Catalog type requires `does_not_prove: string` (min length 1). Selftest iterates the catalog.
- Same loop: every `DEGRADED` the probes emit has a note starting with `TRANSIENT` \| `NO ACCESS` \| `BROKEN`.
- README stays honest: what this is / is not; no client names.
- **Done:** seed loads; `grade()` returns lakeside `ai_txt_live` FAIL; every catalog row has `does_not_prove`; only the six statuses exist in the type; unclassified DEGRADED fails selftest.

### Phase 1 — Grader + matrix (1–2 days)

- All v1 checks + full selftest (three-way live rows **including privacy_page probe**; `_human_floor_verdict` both directions; `does_not_prove` and DEGRADED class still asserted).
- HTML or JSON dump of the matrix (no chat yet).
- **Done:** planted defects 1–4 visible without an LLM.

### Phase 2 — ACL + processes + one trace (half day)

- Principals, `who_can_see`, `list_processes`.
- **Done:** Marketing fetch of trace id returns 403.

### Phase 3 — Chat (1 day)

- Worker `POST /chat`: messages in, tool loop (max 3 rounds), stream or single JSON.
- Spend cap on the OpenRouter key.
- Refuse paths from §7 implemented; timeout/3-round faults injected in tests.
- **Done:** question 1 in the browser shows a tool call in the UI (log line or collapsible “used grade”); injected timeout returns the refuse body, not a cell status.

### Phase 4 — Evals + CI (half day)

- Grader selftest + nine chat cases in CI on PRs.
- One documented loom script (90s).
- **Done:** selftest green; 9/9 chat cases; README lists the questions.

### Phase 5 — Share (quarter day)

- Deploy `workers.dev` or a throwaway subdomain (not a client zone).
- Then, if you want a post: write it in `vault/publishing/drafts/`. Hiring: URL in the packet, not a PDF of the matrix.

Do not start Phase 3 until Phase 1 planted defects are test-proven. Chat on a lying grader is worse than no chat.

---

## 11. Article spine (write after Phase 4)

Stand-alone post, non-engineers OK, no CTA required. File under publishing, not here.

1. Green cells can lie (import ≠ live URL, one paragraph — no client names, no real graded row).
2. Family: findability vs keep-true.
3. Harbor: what you click.
4. Why not RAG / Arkon for this exhibit.
5. Nine chat questions plus the grader selftest; one question Marketing fails.
6. Peakscape is the private cousin; Harbor is the exhibit.
7. Appendix: clone, `npm test`, `wrangler deploy`.

---

## 12. Risks

| Risk | Handle |
|---|---|
| Looks like a toy chatbot | UI shows tool JSON; evals in README |
| LLM ignores tools or loop/timeout | Refuse body; injected-fault test; grader selftest is the keep-true gate |
| Spend | Key cap; rate limit `/chat` |
| Scope creep | v1 check list is closed; new checks are a v1.1 |
| “Is this Peakscape data?” | README + guest role + fake names only |

---

## 13. Open later (not this plan)

Second fake brand in one Worker. Cron that re-grades Harbor. Gated “propose post.” Client-shaped ingest. Arkon as a *different* engagement.

---

## First action

Phase 0 fixtures **plus** the status enum, the `does_not_prove` catalog assertion, and the DEGRADED class assertion. Do not write the Substack draft until Phase 4 is green.
