# PayLedger Technical Standards

This document defines the technologies, libraries, and technical conventions used by PayLedger.

AI agents must follow these standards and must not introduce alternative technologies or patterns without an explicit architectural decision.

---

## 1. Runtime and Language

- Node.js
- TypeScript
- ES Modules

All backend services and shared TypeScript packages use TypeScript.

---

## 2. Monorepo

- pnpm
- Turborepo

The repository is managed as a single Turborepo monorepo.

Applications are located under `apps/`.

Shared packages are located under `packages/`.

---

## 3. Backend

The backend uses:

- Node.js
- TypeScript
- Express

The backend is the primary API and owns PayLedger business logic.

The fake payment gateway uses the same backend technology stack:

- Node.js
- TypeScript
- Express

---

## 4. Validation

Zod is the only validation library used across the project.

### Backend

Zod is used for:

- Request body validation
- Query parameter validation
- Route parameter validation
- Environment configuration validation
- Other runtime input validation

### Frontend

Zod is used for client-side validation and form schemas.

Do not introduce:

- Joi
- Yup
- class-validator
- class-transformer
- Other validation libraries

---

## 5. Database

### PostgreSQL

PostgreSQL is the only database used by PayLedger.

There is one PostgreSQL database:

```text
payledger
```

### ORM

Drizzle ORM is used for database access and schema management.

### PostgreSQL Driver

`pg` is used as the PostgreSQL driver.

Do not introduce another ORM or database driver.

Do not introduce:

- Prisma
- TypeORM
- Sequelize
- Mongoose
- MongoDB

---

## 6. Database Migrations

Database migrations are managed through Drizzle.

Database schema changes must be reflected through Drizzle migrations.

Do not modify the database manually as a replacement for migrations.

---

## 7. Authentication

Authentication uses:

- `jose` for JWT handling
- `argon2` for password hashing
- `cookie-parser` for reading cookies

### Password hashing

Passwords are hashed using Argon2id.

Plain-text passwords are never stored.

### Tokens

Access tokens are JWTs.

Refresh tokens are stored hashed in the appropriate PostgreSQL session table.

User and admin authentication use separate authentication flows and separate session tables.

---

## 8. Browser Authentication

Authentication for browser applications uses HTTP cookies.

The backend generates and sets authentication cookies.

Authentication tokens are not returned directly in API response bodies.

The frontend does not manually store authentication tokens in local storage.

---

## 9. Redis

Redis is used only for short-lived security-related state.

Initial use cases:

- Login rate limiting
- Signup rate limiting
- Authentication attempt counters where required

Rate limiting is implemented through an internal rate-limit service backed by Redis.

Redis is not used as the source of truth for application or financial data.

Redis is not used for general application caching unless a future architectural decision explicitly introduces it.

There is no OTP functionality in the current project.

---

## 10. Logging

Pino is the application logger.

`pino-pretty` is used for readable local development logs.

Logging should be structured.

Do not introduce another logging library.

---

## 11. API Documentation

The backend exposes OpenAPI/Swagger documentation.

The API documentation is used for:

- API reference
- Request/response inspection
- Manual API testing
- Development

---

## 12. API Versioning

All APIs are versioned.

The current API version is:

```text
v1
```

API routes use the version in the URL.

Example:

```text
/api/v1/auth/login
/api/v1/wallet
/api/v1/transfers
```

Only `v1` exists currently.

Future API versions must be introduced explicitly and must not silently change the contract of an existing version.

---

## 13. API Response Contract

All backend APIs use a consistent response structure.

### Success

```ts
export interface SuccessResponse<T> {
    success: true;
    code: string;
    message: string;
    requestId: string;
    data: T;
}
```

### Pagination

PayLedger uses offset pagination only.

Cursor pagination is not used.

```ts
export interface PaginatedResponse<T> {
    success: true;
    code: string;
    message: string;
    requestId: string;
    data: T[];
    meta: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}
```

### Error

```ts
export interface ErrorResponse {
    success: false;
    code: string;
    message: string;
    requestId: string;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}
```

The common API response type is:

```ts
export type ApiResponse<T> =
    | SuccessResponse<T>
    | PaginatedResponse<T>
    | ErrorResponse;
```

---

## 14. Validation Error Handling

Raw Zod errors are never returned directly to API clients.

Zod validation failures are converted into the standard `ErrorResponse`.

Example:

```json
{
    "success": false,
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "requestId": "request-id",
    "errors": [
        {
            "field": "email",
            "message": "Invalid email address."
        }
    ]
}
```

All API errors must follow the application's error response contract.

HTTP status codes are used appropriately in addition to the application-level `code`.

---

## 15. Frontend

The frontend stack is:

- Next.js
- React
- TanStack Query
- Zustand
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Axios

### Data fetching

TanStack Query handles server-state fetching and synchronization.

### Client state

Zustand is used for client-side application state where required.

Server state should not be unnecessarily duplicated into Zustand.

### HTTP

Axios is used for API communication.

Axios interceptors handle common HTTP concerns.

### Forms

React Hook Form is used for form state.

Zod is used for form validation.

### UI

Tailwind CSS is used for styling.

shadcn/ui is used for reusable UI components.

---

## 16. IDs

PayLedger uses two ID strategies.

### Internal IDs

UUIDv7 is used for PostgreSQL primary keys.

### Business IDs

Snowflake is used to generate 63-bit numeric identifiers.

Business identifiers are encoded using Base32 before being stored or exposed as human-readable identifiers.

```text
Snowflake
    ↓
63-bit integer
    ↓
Base32
    ↓
Business identifier
```

The raw Snowflake integer is not stored as the business identifier.

---

## 17. Money

All monetary values are stored as integer paise.

Example:

```text
₹100.00
=
10000 paise
```

PostgreSQL uses `BIGINT` for monetary integer values.

Floating-point numbers must not be used for financial calculations.

---

## 18. Financial Data

Financial operations are executed inside PostgreSQL database transactions.

Wallet balances and financial records must remain consistent if an operation succeeds or fails.

Ledger entries are immutable.

Ledger entries must never be edited or deleted.

For every financial transaction, ledger movements must balance to zero.

---

## 19. Wallets

Wallets have two types:

```text
USER
SYSTEM
```

A `USER` wallet belongs to a user.

A `SYSTEM` wallet does not belong to a user.

The system wallet is used for system-level financial movements such as transfer fees.

A system wallet is not represented as a user account.

---

## 20. Payment Gateway

The fake payment gateway is a separate application.

It communicates with the backend through HTTP REST.

It uses the same technical stack as the backend:

- Node.js
- TypeScript
- Express
- Zod
- Drizzle ORM
- PostgreSQL

The payment gateway simulates an external payment provider.

The backend remains responsible for PayLedger financial state.

---

## 21. Testing

Vitest is the test framework.

Testing priority is:

1. Financial correctness
2. Concurrency-sensitive operations
3. Payment webhook idempotency
4. Transfer idempotency
5. Basic API/business logic

Tests use PostgreSQL for database-dependent behavior.

The project does not require an unnecessarily large test suite.

---

## 22. Infrastructure

### Development

Docker is used for infrastructure only.

```text
Docker
├── PostgreSQL
└── Redis
```

Applications run locally during development.

```text
Local
├── Backend
├── Payment Gateway
├── User Panel
└── Admin Panel
```

Turborepo may run applications together, or individual applications may be started using pnpm filters.

### Production

Production infrastructure may use Docker, but production deployment configuration is separate from local development architecture.

---

## 23. Technology Introduction Rules

The following rules apply to the project:

- Do not introduce a new ORM.
- Do not introduce another database.
- Do not introduce another validation library.
- Do not introduce another authentication framework without a decision.
- Do not introduce Redis for unrelated purposes without a requirement.
- Do not introduce another state-management library.
- Do not introduce another HTTP client on the frontend.
- Do not introduce another logging library.
- Do not replace existing technologies because another technology is personally preferred.
- Do not add dependencies simply to solve a problem that can be handled cleanly with the existing stack.

If a new technology is genuinely required, it must be discussed and recorded as an architectural decision before implementation.