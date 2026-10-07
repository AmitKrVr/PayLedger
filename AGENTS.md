# PayLedger Agent Instructions

## 1. Before Coding

Before making changes:

1. Read `ARCHITECTURE.md`.
2. Read `TECHNICAL.md`.
3. Read `DECISIONS.md`.
4. Read `DRD.md`.
5. Inspect the existing code and follow established patterns.

Do not assume a new pattern is required when an existing project pattern already solves the problem.

---

## 2. Architecture

The architecture is defined by `ARCHITECTURE.md`.

Do not:

- Change the application boundaries.
- Introduce new services without approval.
- Introduce another database.
- Change the database architecture.
- Add infrastructure that is not required.
- Replace an existing architectural choice with a personal preference.

If an architectural change is genuinely required, stop and discuss it before implementing it.

---

## 3. Technical Stack

`TECHNICAL.md` defines the project's approved technologies.

Do not introduce alternative libraries or frameworks when an approved technology already exists for the same purpose.

Examples:

- Zod for validation.
- Drizzle ORM for PostgreSQL.
- `pg` for PostgreSQL access.
- `jose` for JWT.
- Argon2 for password hashing.
- Pino for logging.
- Axios for frontend HTTP.
- TanStack Query for server state.
- Zustand for client state.

New dependencies require explicit approval.

---

## 4. Database and Financial Code

The database schema is a locked part of the project.

Do not:

- Add or remove tables without approval.
- Change financial relationships without approval.
- Change ID strategy.
- Change monetary representation.
- Modify immutable ledger entries.
- Bypass database transactions for financial operations.

Financial operations must preserve the project's balance and ledger invariants.

---

## 5. Code Changes

Prefer the smallest clean change that solves the requirement.

Do not:

- Refactor unrelated code.
- Rename working code without a reason.
- Add speculative abstractions.
- Add unnecessary helper layers.
- Duplicate existing utilities.
- Rewrite working code just to use a different style.

The goal is clear, maintainable code—not maximum abstraction.

---

## 6. Code Quality

Keep the codebase clean, simple, and maintainable.

Prefer clear and concise implementations over unnecessary complexity.

Do not:

- Write unnecessarily large files or functions.
- Add excessive abstraction or boilerplate.
- Add code that is not required by the current requirement.
- Duplicate logic that can reasonably be shared.
- Turn a simple requirement into an over-engineered solution.

A feature should use the smallest clean design that is sufficient for the requirement.

Do not optimize for fewer files or fewer lines at the cost of readability, but also do not add hundreds of lines of code to solve a problem that can be solved cleanly with a much smaller implementation.

---

## 7. Documentation Consistency

Documentation must remain consistent with the implementation.

After making a code change, check whether it makes any documented architecture, technical standard, or decision incorrect.

- If no documented rule changed, do not modify the documentation.
- If a documented rule became incorrect, update the relevant document in the same change.
- If an architectural decision changed, update `DECISIONS.md` as well.

Never intentionally leave documentation describing an architecture or rule that the code no longer follows.

---

## 8. When Uncertain

Do not guess about:

- Architecture
- Database schema
- Financial behavior
- Security behavior
- Authentication
- Dependencies
- Business rules

If the existing documentation and code do not provide the answer, ask before making the decision.

---

## 9. Verification

Before considering a change complete:

1. Run the relevant checks.
2. Confirm the changed code follows the existing architecture.
3. Check for unintended changes.
4. Check documentation consistency when applicable.

Do not claim a change is complete without verifying it.