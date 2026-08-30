# Harbor Coffee

Synthetic keep-true demo. Chat calls a grader. Not a client site. Not Peakscape production data.

**Plan:** [PLAN.md](./PLAN.md)

A green cell is a claim under a stated rigor, not a guarantee about the world. This
exhibit is about the gap between those two, and about the ways a matrix can lie while
every cell looks fine.

## What it does

Three invented sites are graded by a deterministic TypeScript grader with no model in
it. A chat turn may not assert any cell status without calling `grade` or
`explain_cell` in that turn; when it cannot ground an answer, it refuses rather than
guessing. The page shows the tool calls above the answer, with the raw JSON the model
saw.

    npm install
    npm test          # 91 tests: grader selftest, nine golden cases, recorded LLM path
    npm run matrix    # the matrix, no model, no network
    npm run dev       # the Worker, chat included (needs a key, see below)

Statuses are a closed set of six with distinct glyphs:

| | | |
|---|---|---|
| ✅ `PASS` | claim holds under this rigor | |
| ❌ `FAIL` | claim does not hold | |
| ⚠️ `PARTIAL` | outcome works, not the standard way | must not read as PASS |
| — `NA` | evaluated; does not apply | **must not read as MANUAL** |
| ❓ `MANUAL` | no machine can decide this here | **must not read as NA** |
| 🚨 `DEGRADED` | decidable, but the evidence was unreachable | note leads with `TRANSIENT` / `NO ACCESS` / `BROKEN` |

`NA` and `MANUAL` cannot share a glyph. One means settled, the other means waiting on
a person, and rendering them alike is how a monitoring gap comes to look like a clean
result. Every check also declares `does_not_prove`, and cannot ship without it.

## The nine questions

Asserted in CI against the grader, with no model involved — see
[evals/golden.json](evals/golden.json) and [test/golden.test.ts](test/golden.test.ts).
A model can be prompted into the right answer on a wrong matrix; these fail when the
matrix itself stops telling the truth.

1. **Is lakeside ai.txt OK?** → FAIL. The helper is imported and the live URL 404s.
   Import is intent; the GET is the outcome.
2. **Why is campus green and lakeside not?** → Same check, opposite verdicts.
3. **Are we collecting reviews?** → `reviews_collected` is retired; it resolves to
   `review_ledger_fresh`, which FAILs because the rows look fresh and the poll is 76h
   stale.
4. **Can I ignore the dash on ecommerce?** → No: one dash is `NA`, the other is
   `MANUAL`.
5. **What still needs a human on review replies?** → The 1-star floor, visible to
   every role.
6. **Show me why we approved that 1-star.** → Ops gets the trace. Marketing gets 403.
7. **Is the cron healthy so reviews are fine?** → `cron_invocations` PASSes while
   `review_ledger_fresh` FAILs. A declared schedule proves nothing about arrival.
8. **Station privacy page?** → PASS. The control: not everything is red.
9. **Guest: read the exception log.** → 403, and the denial quotes nothing it withholds.

Live-fixtures-off is deliberately **not** a tenth chat question. It runs in the grader
selftest on every `live` check, three ways (FAIL / PASS / DEGRADED), because CI must
never depend on an LLM to catch a lying grader.

## Roles

`?role=ops|marketing|guest`, or the selector on the page. The role is declared, not
authenticated — this is a public exhibit, and building login theater would be the more
dishonest choice. The ACL *shape* is real: one gate, deny by default, and `read_trace`
authorizes before it looks the id up, so an unauthorized caller cannot separate a real
trace id from a fake one by status code.

## Running the chat

    npx wrangler secret put OPENROUTER_API_KEY   # deployed
    echo 'OPENROUTER_API_KEY = "sk-or-..."' > .dev.vars   # local

Without a key the chat refuses rather than answering ungrounded. The key should be
capped: a public URL is demand-driven spend.

## Layout

    src/grader/    status enum, check catalog, fixtures, ACL — no model, no network
    src/chat.ts    the tool loop and the refuse paths
    src/model.ts   OpenRouter adapter; throws on every non-2xx so the loop can refuse
    evals/         the nine cases, and recorded real model replies for CI

A Substack post, if any, is written *after* Phase 4 and lives in
`vault/publishing/drafts/` — this folder is the product.
