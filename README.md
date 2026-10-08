# PayLedger

A digital wallet platform: users add money, send money to other users, and
request withdrawals; admins review withdrawals and reverse completed
transfers. See `docs/BRD.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL.md`,
and `DECISIONS.md` for the full product/technical spec.

> This README covers **local development and evaluation only** — there is
> no Docker setup and no deployment instructions here by design (see
> `DECISIONS.md`).

## Tech stack

- **Backend**: Node.js, Express, TypeScript, Zod validation
- **Database**: PostgreSQL via Drizzle ORM (migrations in `packages/database`)
- **Cache / rate limiting**: Redis
- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Monorepo tooling**: Turborepo + pnpm workspaces
- **Tests**: Vitest + Supertest (backend)

## Apps

| App | Path | Default port |
|---|---|---|
| Backend API | `apps/backend` | 5001 |
| Fake Payment Gateway | `apps/payment-gateway` | 5002 |
| User Panel (Next.js) | `apps/user-panel` | 3000 |
| Admin Panel (Next.js) | `apps/admin-panel` | 3001 |

Shared code lives in `packages/database` (Drizzle schema/migrations),
`packages/shared`, and `packages/config` (environment validation).

## 1. Install

```sh
pnpm install
```

## 2. Configure environment

**Backend + Fake Payment Gateway** share a single root `.env` (loaded via
`@payledger/config`). Copy it and fill in real values for your machine:

```sh
cp .env.example .env
```

Key variables: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` /
`JWT_REFRESH_SECRET`, `PAYMENT_GATEWAY_BASE_URL` (where the gateway listens),
`PAYLEDGER_WEBHOOK_URL` (where the gateway sends webhooks back to — must
point at the backend), and `PAYMENT_WEBHOOK_SECRET` (must be the **same**
value on both sides — it's the HMAC key used to sign/verify webhooks).

Financial limits (`PAYMENT_MIN_DEPOSIT_INR`, `PAYMENT_MAX_DEPOSIT_INR`,
`TRANSFER_MAX_AMOUNT_INR`, `TRANSFER_DAILY_LIMIT_INR`, `TRANSFER_FEE_PERCENT`,
`TRANSFER_FEE_MIN_INR`, `TRANSFER_FEE_MAX_INR`, `WITHDRAWAL_MIN_AMOUNT_INR`,
`WITHDRAWAL_MAX_AMOUNT_INR`) are **environment-driven, not hardcoded** — change
them in `.env` and restart the backend; no code change is required.

**User Panel / Admin Panel** each need their own `.env.local`:

```sh
echo "NEXT_PUBLIC_API_URL=http://localhost:5001/api" > apps/user-panel/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5001/api" > apps/admin-panel/.env.local
```

Never commit a real `.env` or `.env.local` — only `.env.example` belongs in git.

## 3. Start PostgreSQL and Redis

Point `DATABASE_URL`/`REDIS_URL` at a running PostgreSQL and Redis instance —
locally installed, or in Docker containers you manage yourself. There is
currently no checked-in `docker-compose.yml` for this; see "Known
limitations" below.

## 4. Run migrations

```sh
pnpm --filter @payledger/database db:migrate
```

## 5. Create an admin account

```sh
pnpm --filter backend admin:create
```

Interactive prompt — asks for name, email, mobile, and password, then
creates an `ADMIN` row you can log into the Admin Panel with.

## 6. Ensure the SYSTEM wallet exists

Transfers move the fee into a single `SYSTEM`-type wallet (not tied to any
user). It is data, not schema, so it isn't created by a migration:

```sh
pnpm --filter backend wallet:create-system
```

Safe to re-run — it's a no-op if the SYSTEM wallet already exists.

## 7. Start the applications

Everything together:

```sh
pnpm dev
```

Or individually, with pnpm filters:

```sh
pnpm --filter backend dev
pnpm --filter payment-gateway dev
pnpm --filter user-panel dev
pnpm --filter admin-panel dev
```

## 8. The fake payment (Add Money) flow

The User Panel never talks to the Fake Payment Gateway directly — only the
backend does:

```text
User Panel: POST /api/v1/payments (create)
  -> Backend creates a PayLedger payment row (status CREATED)
  -> Backend calls the Fake Payment Gateway to create a matching gateway order

User Panel: POST /api/v1/payments/:id/simulate { outcome: "SUCCESS" | "FAILED" }
  -> Backend calls the gateway's own test-checkout action for that order
  -> Gateway sends a signed webhook back to the backend
  -> Backend verifies the HMAC signature against the exact raw request body
  -> Backend settles the payment (SUCCESS credits the wallet + creates a
     DEPOSIT transaction + balanced ledger entry; FAILED changes nothing)

User Panel: polls GET /api/v1/payments/:id until the status is terminal
```

The `/simulate` endpoint exists because the gateway has no real hosted
checkout page — it's the only legitimate way to drive a deposit to
completion from the product itself, and it never sets the payment's status
directly: that only ever happens inside the signed-webhook handler, exactly
as it would for a real payment provider. Repeated/duplicate webhook delivery
is idempotent — it can never credit a wallet twice.

## 9. Tests and checks

```sh
pnpm check-types   # tsc --noEmit across every package
pnpm lint          # eslint across every package
pnpm test          # vitest for the backend (and payment-gateway, if it has tests)
pnpm build         # production build of every app/package
```

Run a single backend test file directly when iterating:

```sh
cd apps/backend
npx vitest run src/domains/payment/payment.test.ts
```

**Known flaky tests, by design of the test fixtures, not the financial
logic:** a few concurrency tests in `transfer.test.ts`,
`admin-transfer.test.ts`, and `admin-withdrawal.test.ts` share one SYSTEM
wallet row and a Snowflake ID generator across test files. Run together with
high parallelism, two files can occasionally collide on that shared state
(or occasionally hit a Snowflake worker-ID collision) and fail with a
balance-mismatch or timeout assertion that has nothing to do with the code
under test. Run the affected file alone to get a clean, deterministic
result:

```sh
npx vitest run src/domains/transfer/transfer.test.ts
npx vitest run src/domains/admin/transfer/admin-transfer.test.ts
npx vitest run src/domains/admin/withdrawal/admin-withdrawal.test.ts
```

## 10. Known limitations

- No `docker-compose.yml` is checked in (intentional — see `DECISIONS.md`);
  provide your own local PostgreSQL and Redis instances.
