# PayLedger — Architecture Decisions

## 1. Monorepo

PayLedger uses a Turborepo monorepo managed with pnpm.

Applications:
- Backend
- Payment Gateway
- User Panel
- Admin Panel

Shared code belongs in packages rather than being duplicated across applications.

---

## 2. Single PostgreSQL Database

PayLedger uses one PostgreSQL database.

The Payment Gateway is a separate application but uses the same PostgreSQL database with its own gateway-related tables.

A second database is not introduced unless there is a genuine architectural requirement.

---

## 3. Redis Usage

Redis is used for security-related temporary data such as:

- Login rate limiting
- Signup rate limiting
- Authentication attempt counters

Redis is not used as a general-purpose cache unless explicitly required later.

---

## 4. Authentication

User and Admin authentication are completely separate.

They have:
- Separate tables
- Separate sessions
- Separate authentication flows
- Separate authorization rules

Authentication uses:
- JWT access tokens
- Hashed refresh tokens
- PostgreSQL-backed sessions
- HTTP-only cookies

Access and refresh tokens are not stored in browser localStorage.

---

## 5. Validation

Zod is the validation library across the project.

A different validation library should not be introduced when Zod can handle the requirement.

---

## 6. API Versioning

All APIs are versioned.

Current API version:

`/api/v1`

Future breaking API changes should use a new API version instead of silently changing the existing contract.

---

## 7. API Response Contract

APIs use a consistent response structure containing:

- `success`
- `code`
- `message`
- `requestId`
- `data` where applicable
- `meta` for pagination
- `errors` for validation errors

Internal validation details such as raw Zod errors are never exposed to clients.

---

## 8. ID Strategy

UUIDv7 is used for internal database primary keys.

Snowflake IDs are used for business identifiers and are encoded using Base32 before being exposed externally.

Internal UUIDs and public business identifiers serve different purposes and should not be mixed.

---

## 9. Money Representation

All monetary values are stored as integer paise using PostgreSQL `BIGINT`.

Floating-point numbers are never used for financial calculations.

---

## 10. Ledger Immutability

Ledger entries are append-only.

Existing ledger entries are never updated or deleted.

Corrections to financial history are represented by new transactions and new ledger entries.

---

## 11. Financial Transactions

Financial operations must execute inside PostgreSQL transactions.

A financial operation must either complete all required database changes or make none of them.

Wallet balance changes and their corresponding ledger entries must remain consistent.

---

## 12. Wallet Model

Wallets support two types:

- `USER`
- `SYSTEM`

User wallets belong to a user.

System wallets do not belong to a user.

The system wallet is used for system-level financial movements such as transfer fees.

---

## 13. Transfer Idempotency

Transfers require an idempotency key.

The same idempotency key for the same sender wallet must not create multiple transfers.

Concurrent transfer requests must lock the sender wallet before checking and modifying its balance.

---

## 14. Payment Webhooks

The Payment Gateway communicates with the Backend through HTTP APIs.

Payment webhooks are the source of truth for successful payment completion.

Webhook signatures must be verified before processing.

Repeated delivery of the same webhook must not credit the wallet more than once.

---

## 15. Withdrawal Processing

Withdrawal requests are initially stored as `PENDING`.

They do not create a financial transaction immediately.

An approved withdrawal creates the corresponding transaction and ledger entries.

Rejected withdrawals do not modify wallet balance.

---

## 16. Reversals

Financial transactions are never edited to represent a reversal.

A reversal creates a new transaction with new ledger entries.

The original transaction and ledger entries remain unchanged.

---

## 17. Database Schema Changes

Database schema changes are managed through Drizzle migrations.

Schema changes should not be made manually in the database as a replacement for migrations.

---

## 18. Architecture Changes

Existing architectural decisions should not be changed casually.

A new requirement that conflicts with an existing decision must be evaluated before implementation.

If the decision changes, this document must be updated in the same change.