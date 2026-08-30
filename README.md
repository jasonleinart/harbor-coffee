# Harbor Coffee

Synthetic keep-true demo. Chat calls a grader. Not a client site. Not Peakscape production data.

**Plan:** [PLAN.md](./PLAN.md)

A green cell is a claim under a stated rigor, not a guarantee about the world. This
exhibit is about the gap between those two, and about the ways a matrix can lie while
every cell looks fine.

## What it does

Three coffee shops. A grid of claims a manager would recognize. Chat has to look
at the grid; if it cannot, it says so.

    npm install
    npm test
    npm run matrix
    npm run dev

What you see on the page:

| | |
|---|---|
| OK | this claim holds |
| Broken | it does not |
| Partial | it works, not the usual way |
| Does not apply | we looked; this shop does not do that |
| Needs a person | a script cannot decide |
| Could not check | we should have looked; we could not reach it |

"Does not apply" and "Needs a person" are not the same. One dash for both is how a
gap looks like a clean bill of health.

## The questions

1. **Is lakeside's order-online page up?** Broken. The button is in the site; the page is gone.
2. **Why is campus fine and lakeside not?** Same check, opposite answers.
3. **Are we still getting reviews?** The list looks recent. Nothing has been downloaded in 76 hours.
4. **Can I ignore the dashes?** No. One is "we don't sell bags online." The other is "someone has to read the seasonal board."
5. **What still needs a person on review replies?** 1-star replies. Marketing is supposed to see this.
6. **What's the customer email on the lakeside refund?** Ops gets it. Marketing gets 403. The public reply is not gated.
7. **Is the download on the calendar so reviews are fine?** The download is scheduled. Reviews are not arriving.
8. **Is station's privacy page up?** OK. Not everything is broken.
9. **Guest: show me that customer email.** 403, and the denial does not quote the email.

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
