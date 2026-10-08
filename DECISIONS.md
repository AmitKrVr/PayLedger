# DECISIONS

Why PayLedger is built the way it is, and where AI-assisted development got
things wrong along the way. For the full, itemized architecture decision
log see `docs/DECISIONS.md`; this is the short version the assignment asks
for.

## Architecture

- **Turborepo monorepo (pnpm workspaces)**: four apps (`backend`,
  `payment-gateway`, `user-panel`, `admin-panel`) plus shared packages
  (`database`, `shared`, `config`). Shared logic (Drizzle schema, env
  validation, the business-ID generator) lives in one place instead of being
  copy-pasted across apps.
- **One PostgreSQL database**, including the fake payment gateway's own
  tables. A second database was never justified by an actual requirement —
  adding one "for separation" would just be distributed-transaction risk
  with no corresponding benefit here.
- **Redis is for security state only** (login/signup rate limiting, attempt
  counters), not a general cache. Nothing depends on it for correctness.
- **User and admin auth are fully separate**: separate tables, separate
  session tables, separate JWT guards, separate HttpOnly cookies. They were
  *not* separate on cookie names until this was caught and fixed (see
  below) — everything else about the separation was correct from the start.
- **Every API response has the same envelope** (`success`, `code`,
  `message`, `requestId`, `data`/`meta`/`errors`) so client-side error
  handling is one code path, not one per endpoint.

## Financial / ledger correctness

These are the decisions that actually matter for a product that moves
money:

- **Integer paise (`BIGINT`), never floats**, for every stored amount.
  INR-with-decimals only exists at the API boundary.
- **The ledger is append-only.** Nothing is ever edited or deleted to
  represent a correction — a reversal is a *new* transaction with new
  ledger entries; the original stays exactly as it was.
- **Every financial operation runs inside one DB transaction** and either
  fully commits or fully rolls back — a wallet balance and its ledger entry
  can never disagree because one half of a write failed.
- **Business-facing IDs are not database UUIDs.** Primary keys are UUIDv4;
  anything a user or admin can see (`orderId`, `referenceId`, the gateway's
  `paymentId`) is a separate Snowflake-derived, Base32hex-encoded ID. A raw
  UUID is never rendered as visible text in either frontend — this was
  audited and enforced explicitly, not assumed.
- **Payment completion is driven by a signed webhook**, verified over the
  *raw* request bytes (not a re-serialized copy of the parsed body), and
  processed idempotently — the payment row is locked `FOR UPDATE` before
  checking its status, so the same webhook delivered five times (or twice,
  concurrently) credits a wallet exactly once, never more.
- **Transfers lock both wallets in a fixed, ID-ascending order** (never
  "sender first" / "receiver first") specifically so two transfers touching
  the same pair of wallets from opposite directions can't deadlock.
- **A withdrawal hold and an approved withdrawal's debit are deliberately
  ordered**: the hold is released *before* the debit, so a user holding
  their entire balance for one withdrawal doesn't get wrongly rejected by
  a stale `available = 0` read mid-approval.

## Why no Docker

This repo intentionally ships without a `docker-compose.yml` or
application Dockerfiles. PayLedger is a multi-app workspace built and
evaluated locally; `pnpm dev` / `turbo dev` give every app hot-reload
(`tsx watch`, Next dev) with no image-rebuild cycle in the loop, which
matters far more than containerization for an evaluation-scoped project
with no deployment target in this repo. PostgreSQL and Redis are treated as
infrastructure the developer already has (Docker-run or not, their choice)
rather than something this repo orchestrates — one-time setup cost, not
part of the edit-test loop. If this project ever needs to run the same way
on someone else's machine without local Postgres/Redis, that's the point
at which a `docker-compose.yml` for infra-only would earn its complexity;
it wasn't needed for this assignment.

## Where AI-assisted development got it wrong

This project was built with heavy AI (Claude Code) assistance. In the
interest of an honest account, not a polished one — here's what AI-written
code got wrong, how it was caught, and how it was fixed. All of these were
found through actual use (manual testing against the running apps), not
hypothetical review:

- **Infinite re-render after a session died mid-poll.** `usePaymentStatusQuery`
  decided whether to keep polling using only the *last successfully fetched*
  payment status, never the query's own error state. Delete the session's
  cookies mid-poll and every 3-second tick 401'd forever without ever
  stopping, because `data` was never cleared on error. Found by deliberately
  deleting cookies mid-session and watching the network tab spin. Fixed by
  also checking the query's fetch-error state, and separately hardened the
  whole class of bug by clearing the React Query cache in the same place the
  session itself gets cleared on auth failure.
- **Admin and user sessions silently fought over one cookie.** Both panels'
  login flows wrote to the exact same cookie names (`access_token` /
  `refresh_token`) from the same backend origin, so logging into one in a
  second browser tab silently logged the other one out. Found by testing
  both panels open at once (a real, likely-common usage pattern that just
  hadn't been exercised yet). Fixed by giving admin sessions their own
  cookie names; verified by confirming both sessions stay independently
  authenticated in the same cookie jar afterward.
- **Validation errors showed a useless generic message.** The backend sends
  the specific per-field reason in an `errors` array on every
  `VALIDATION_ERROR` response; the frontend's shared error-message helper
  only ever read the generic top-level `message` ("Validation failed") and
  silently ignored `errors` — so every validation failure in both apps
  showed the same unhelpful text instead of e.g. "Please enter a valid
  Indian mobile number." Found from a real failed form submission. Fixed in
  the one shared helper both apps use, which fixed it everywhere at once
  rather than per-form.
- **A failed deposit became permanently invisible.** By design, a
  FAILED/CANCELLED/EXPIRED payment never creates a `transactions` row
  (correctly — no money moved). What AI-written code got wrong was never
  providing *any other* way to see it afterward: there was no `GET /payments`
  list endpoint at all, so once you left the checkout screen a failed
  deposit just vanished. Found by simulating a failed deposit and then
  looking for it. Fixed by adding the missing list endpoint (mirroring the
  withdrawal-history pattern that already existed) rather than, e.g.,
  misusing the transactions ledger to track attempts that never happened.
- **CSS Grid "auto" track sizing caused real layout breakage, twice.** A
  bare `1fr` grid track (and, separately, a grid with no base column count
  below a breakpoint) has an implicit minimum width based on its content —
  so a long transaction description or failure-reason string silently
  pushed the whole page wider than the viewport, or squeezed a sibling
  column, even though `truncate` was correctly applied on the text itself.
  Found from screenshots of real narrow-viewport rendering. Fixed by using
  `minmax(0, 1fr)` / an explicit base column count everywhere a grid track
  could receive unbounded text content — the general form of the bug, not
  just the one reported instance.

Each of these shipped once, was caught by exercising the actual feature
(not just reading the diff), root-caused to the specific wrong assumption
in the code rather than patched at the symptom, and in most cases the fix
was generalized to the whole class of bug rather than the one reported
case.
