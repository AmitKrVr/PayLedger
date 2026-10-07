# PayLedger Architecture

## 1. Overview

PayLedger is a digital wallet application built as a Turborepo monorepo.

The system consists of:

- User Panel
- Admin Panel
- Backend API
- Fake Payment Gateway
- PostgreSQL
- Redis

The backend is the central service responsible for authentication, wallet operations, payments, transfers, withdrawals, transactions, and ledger management.

---

## 2. Repository Architecture

```text
payledger/
├── apps/
│   ├── user-panel/
│   ├── admin-panel/
│   ├── backend/
│   └── payment-gateway/
│
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
│
├── tests/
│
├── docs/
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

The repository uses:

- `pnpm` for package management and workspaces.
- `Turborepo` for monorepo task orchestration.

---

## 3. Applications

### User Panel

The user-facing Next.js application.

Users can:

- Register and log in.
- View wallet balance.
- Add money.
- Send money.
- View transaction history.
- Request withdrawals.
- View withdrawal status.

### Admin Panel

The admin-facing Next.js application.

Admins can:

- Authenticate separately from users.
- View withdrawal requests.
- Approve withdrawals.
- Reject withdrawals.
- Reverse transfers.

User and admin authentication are completely separate.

### Backend

The main Node.js + Express + TypeScript API.

The backend owns all PayLedger business rules and financial operations.

It is responsible for:

- User authentication.
- Admin authentication.
- Sessions.
- Wallets.
- Payments.
- Transfers.
- Withdrawals.
- Transactions.
- Ledger entries.
- Audit logs.
- Payment webhooks.
- Financial consistency.

The backend is the source of truth for PayLedger data.

### Fake Payment Gateway

A separate application that simulates an external payment provider.

Communication between the backend and payment gateway is HTTP REST.

The payment gateway has its own gateway-related tables, but uses the same PostgreSQL database as PayLedger.

The gateway must not directly modify PayLedger wallet balances or ledger entries.

---

## 4. Development Architecture

Docker is used only for infrastructure during local development.

```text
Docker
├── PostgreSQL
└── Redis
```

Applications run directly on the local machine:

```text
Local
├── Backend
├── Payment Gateway
├── User Panel
└── Admin Panel
```

Applications can be started together through Turborepo or individually using package filters.

---

## 5. Database

PayLedger uses one PostgreSQL database.

```text
PostgreSQL
└── payledger
```

The database is accessed through Drizzle ORM.

Financial data is stored only in PostgreSQL.

The database contains:

- Users
- User sessions
- Admins
- Admin sessions
- Audit logs
- Wallets
- Payments
- Transactions
- Ledger entries
- Transfers
- Withdrawals
- Fake payment gateway data

The database schema is managed through Drizzle migrations.

---

## 6. Redis

Redis is used only where short-lived state provides a clear benefit.

Initial use cases:

- Login rate limiting.
- Signup rate limiting.
- OTP/authentication attempt limiting.
- Other short-lived authentication/security counters when required.

Redis is not the source of truth for:

- Users
- Sessions
- Wallet balances
- Payments
- Transfers
- Withdrawals
- Transactions
- Ledger entries

Redis is not used for general application caching at this stage.

---

## 7. Authentication

User and admin authentication are separate.

Both use:

```text
Access Token  → JWT
Refresh Token → hashed and stored in PostgreSQL session table
```

For browser clients, authentication tokens are handled through server-generated HTTP cookies.

Tokens are not returned directly in API response bodies.

User sessions are stored in `user_sessions`.

Admin sessions are stored in `admin_sessions`.

---

## 8. ID Architecture

Two ID strategies are used for different purposes.

### Internal IDs

UUIDv7 is used for database primary keys.

```text
users.id
wallets.id
payments.id
transactions.id
ledger_entries.id
transfers.id
withdrawals.id
```

### Business IDs

Snowflake generates a 63-bit numeric ID.

The numeric Snowflake ID is encoded using Base32 before being exposed or stored as a business identifier.

```text
Snowflake
    ↓
63-bit integer
    ↓
Base32
    ↓
Business ID
```

Snowflake implementation and worker-ID handling are maintained separately from the database schema.

---

## 9. Wallet Architecture

Every wallet has a type:

```text
USER
SYSTEM
```

### User wallet

A user wallet is associated with exactly one user.

```text
wallet_type = USER
user_id     = required
```

### System wallet

A system wallet is not associated with a user.

```text
wallet_type = SYSTEM
user_id     = NULL
```

The system wallet is used for system-level financial movements such as transfer fees.

No fake user account is created for the system wallet.

---

## 10. Financial Architecture

Financial operations use PostgreSQL database transactions.

Money is stored as whole paise using integer `BIGINT` values.

Wallet balance must never become negative.

Financial operations update the relevant wallet state and ledger records atomically.

### Ledger

`ledger_entries` is the immutable financial history.

Ledger entries are never edited or deleted.

Each ledger entry belongs to:

- One transaction.
- One wallet.

For every financial transaction, the sum of all ledger entry movements must equal zero.

Example:

```text
Transfer amount: ₹1,000
Transfer fee:    ₹10

Sender wallet       DEBIT   ₹1,010
Receiver wallet     CREDIT  ₹1,000
System fee wallet   CREDIT  ₹10

Total movement = 0
```

Balance snapshots are stored in ledger entries:

```text
balance_before_paise
balance_after_paise
```

The `wallets` table stores the current wallet state, while `ledger_entries` stores the immutable financial history.

---

## 11. Payment Flow

The payment gateway is treated as a separate external service boundary even though it runs as part of the same local project.

```text
User Panel
    │
    ▼
Backend
    │
    │ HTTP REST
    ▼
Fake Payment Gateway
    │
    │ webhook
    ▼
Backend
    │
    ├── Verify webhook signature
    │
    └── PostgreSQL transaction
            │
            ├── Payment
            ├── Transaction
            ├── Wallet
            └── Ledger
```

The webhook is the source of truth for payment completion.

Repeated webhook delivery must not create duplicate financial credit.

---

## 12. Transfer Flow

Transfers are executed inside a PostgreSQL transaction.

The sender wallet is protected against concurrent modifications during the financial operation.

The transfer must verify:

- Sender has sufficient available balance.
- Transfer amount is within the allowed limit.
- Daily transfer limit is not exceeded.
- Transfer idempotency requirements are satisfied.

The transfer fee is paid by the sender.

The complete transfer produces balanced ledger entries for:

- Sender wallet.
- Receiver wallet.
- System fee wallet.

---

## 13. Withdrawal Flow

A withdrawal request does not immediately create a completed financial transaction.

```text
User
  │
  ▼
Withdrawal Request
  │
  ▼
PENDING
  │
  ├── REJECTED
  │      └── release held amount
  │
  └── APPROVED
         └── create financial transaction
                └── create ledger entries
```

The withdrawal amount is held while the request is pending.

A `transaction_id` is created only when the withdrawal is approved.

Rejected withdrawals do not create a financial transaction.

---

## 14. Transfer Reversal

A transfer reversal never modifies the original ledger entries.

Instead, the system creates:

```text
New TRANSFER_REVERSAL transaction
        +
New immutable ledger entries
```

The original transaction and its ledger entries remain unchanged.

---

## 15. Data Ownership

The backend owns PayLedger business data.

The payment gateway owns its gateway simulation data.

The user panel and admin panel do not directly access PostgreSQL.

All application data access goes through the appropriate backend service.

```text
User Panel ────────┐
                    │
Admin Panel ────────┼──→ Backend ───→ PostgreSQL
                    │
Payment Gateway ────┘
       ▲
       │
       └──── HTTP REST ─── Backend
```

Financial state is changed only by backend-controlled business operations.