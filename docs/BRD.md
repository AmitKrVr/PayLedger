# PayLedger — Business Requirements Document

## 1. Product Overview

PayLedger is a digital wallet application that allows users to:

- Create an account and log in.
- Maintain a wallet balance.
- Add money through a payment flow.
- Send money to other registered PayLedger users.
- View transaction history.
- Request withdrawals.
- Track withdrawal status.

Administrators can:

- View withdrawal requests.
- Approve or reject withdrawals.
- Reverse completed transfers.

---

## 2. User Roles

### 2.1 User

A user can:

- Register and log in.
- View their own wallet balance.
- Add money.
- Send money to another registered user.
- View their own transaction history.
- Request withdrawals.
- View their withdrawal status.

A user must never be able to access another user's wallet or financial history.

### 2.2 Admin

An admin can:

- View withdrawal requests.
- Approve withdrawals.
- Reject withdrawals.
- Reverse completed transfers.

`ADMIN` and `SUPER_ADMIN` have the same permissions for the current version.

Role-based permission differences may be introduced later.

---

# 3. Registration and Login

## 3.1 Registration

Registration requires:

- Name
- Mobile number
- Password

Email is optional.

Mobile number must be unique.

No mobile or email verification is required.

A user can log in using their credentials immediately after registration.

## 3.2 Login

Users authenticate using their credentials.

A successful login provides access to the user's wallet and financial features.

Blocked users cannot perform wallet operations.

---

# 4. Wallet

Each user has a wallet.

The wallet contains:

- Available balance
- Held amount

The available balance represents money that can currently be used.

The held amount represents money reserved for pending operations such as a pending withdrawal.

### Wallet rules

- Wallet balance can never become negative.
- Held amount cannot exceed the wallet balance.
- Held money cannot be used for another financial operation.
- A blocked wallet cannot perform financial operations.
- Wallet financial history must be preserved.

---

# 5. Add Money

Users can add money to their wallet through the PayLedger payment flow.

A payment order is created before payment is completed.

Users may have multiple pending payment orders at the same time.

A payment order has an expiration time.

An expired payment order cannot be completed.

### Deposit limits

| Rule | Value |
|---|---:|
| Minimum deposit | ₹100 |
| Maximum deposit | ₹25,000 |

These values are configurable through environment configuration and must not be treated as permanently hardcoded business values.

### Successful payment

Money is added to the user's wallet only after the payment is successfully confirmed.

A payment must not credit the wallet more than once.

If the same payment confirmation is received repeatedly, only the first valid processing can affect the wallet.

### Failed/expired payment

A failed or expired payment must not add money to the wallet.

---

# 6. Send Money

Users can transfer money only to another registered PayLedger user.

The recipient is identified using their mobile number.

A user cannot transfer money to themselves.

### Transfer limits

| Rule | Value |
|---|---:|
| Maximum transfer amount | ₹25,000 |
| Daily transfer limit | ₹50,000 |

The daily limit is currently based on the calendar day:

`00:00 – 23:59 IST`

The daily limit currently counts the transfer amount and does not include the transfer fee.

The daily-limit calculation may change to a rolling/first-transaction-based period in the future.

---

# 7. Transfer Fee

Every transfer has a fee of **1%**.

The fee is subject to:

- Minimum: ₹1
- Maximum: ₹20

The sender pays the fee.

The receiver receives exactly the requested transfer amount.

### Example

For a ₹1,000 transfer:

```text
Transfer amount: ₹1,000
Fee:             ₹10
Sender debit:    ₹1,010
Receiver credit: ₹1,000
System fee:      ₹10
```

For a ₹25,000 transfer:

```text
Transfer amount: ₹25,000
Fee:             ₹20
Sender debit:    ₹25,020
Receiver credit: ₹25,000
System fee:      ₹20
```

The ₹25,000 limit applies to the transfer amount, not the sender's total debit including the fee.

---

# 8. Transfer Financial Rules

A transfer must satisfy all of the following:

- Sender exists and is active.
- Receiver exists and is active.
- Sender and receiver are different users.
- Both wallets are eligible for the operation.
- Transfer amount is within the configured limits.
- Sender has sufficient available balance for the transfer amount plus fee.
- Sender has not exceeded the daily transfer limit.
- The transfer has not already been processed using the same idempotency key.

A transfer must be processed as one complete financial operation.

There must never be a situation where:

- Sender is debited but receiver is not credited.
- Receiver is credited without sender being debited.
- Sender is debited twice for one transfer.
- The fee is charged without the corresponding transfer.
- A partial transfer remains after an error.

---

# 9. Transfer Idempotency

A transfer request contains an idempotency key.

If the same request is retried because of:

- Double-clicking
- Network retry
- Client retry
- Request timeout
- Duplicate submission

the transfer must be processed only once.

A retry must not create another transfer or another financial movement.

---

# 10. Concurrent Transfers

The wallet must remain financially correct when multiple transfer requests arrive at the same time.

Example:

```text
Initial balance: ₹1,000

50 concurrent transfers:
₹100 transfer + ₹1 fee = ₹101 sender debit
```

Only **9 transfers** can succeed.

Final balance:

```text
₹1,000 - (9 × ₹101) = ₹91
```

The system must never allow the balance to become negative.

---

# 11. Transaction History

Users can view their transaction history.

A user can see only transactions belonging to their own wallet/account.

Transaction history supports pagination.

Financial transactions must accurately represent successful money movements and their current state.

---

# 12. Withdrawal

A user can request a withdrawal from their wallet.

The withdrawal amount is held when the request is created.

The held amount cannot be spent or withdrawn again while the request is pending.

### Withdrawal limits

| Rule | Value |
|---|---:|
| Minimum withdrawal | ₹100 |
| Maximum withdrawal | ₹25,000 |

These values are configurable through environment configuration.

### Withdrawal lifecycle

```text
PENDING
   ├── APPROVED
   └── REJECTED
```

### Pending

When a withdrawal is requested:

- The requested amount is held.
- The user's available balance is reduced accordingly.
- No completed withdrawal transaction is created yet.

### Approved

When an admin approves the withdrawal:

- The held amount is permanently deducted.
- The withdrawal becomes `APPROVED`.
- The corresponding financial transaction is completed.

### Rejected

When an admin rejects the withdrawal:

- The held amount is released back to the available balance.
- No financial withdrawal transaction is created.
- A rejection reason may be recorded.

---

# 13. Withdrawal Administration

Admins can view pending withdrawal requests.

An admin can:

- Approve a pending withdrawal.
- Reject a pending withdrawal.

A withdrawal that has already been approved or rejected cannot be processed again.

All admins currently have the same withdrawal permissions.

---

# 14. Transfer Reversal

An admin can reverse a completed transfer.

A reversal returns the transferred amount to the original sender.

The original receiver is debited accordingly.

The original transfer remains unchanged.

A reversal creates a separate financial operation representing the correction.

### Reversal rules

- Only completed transfers can be reversed.
- A failed transfer cannot be reversed.
- A pending transfer cannot be reversed.
- A reversed transfer can never be reversed again.
- The original transaction must remain unchanged.
- The reversal must create its own financial records.
- The reversal must preserve ledger balance correctness.

---

# 15. Financial Records

Every completed money movement must have corresponding financial records.

For each transaction, the financial entries must balance to zero.

Examples:

### Deposit

```text
User wallet:       +₹1,000
Funding/source:    -₹1,000
Total:                  ₹0
```

### Transfer

```text
Sender wallet:     -₹1,010
Receiver wallet:   +₹1,000
System fee wallet:    +₹10
Total:                  ₹0
```

### Reversal

A reversal creates new entries that compensate for the original transfer.

The original financial records are never edited or deleted.

---

# 16. Financial Integrity

The following rules are mandatory:

- Money is represented as whole paise.
- Wallet balances cannot become negative.
- Held amounts cannot exceed wallet balance.
- Financial operations must be all-or-nothing.
- Duplicate requests must not create duplicate financial movements.
- Concurrent operations must maintain correct balances.
- Every transaction must have balanced financial entries.
- Financial history must remain immutable.

---

# 17. Payment Webhook Safety

The payment gateway sends a webhook to PayLedger after payment processing.

The webhook must be authenticated using its signature.

Invalid webhook signatures must not modify financial data.

If the same webhook is delivered multiple times, it must affect the wallet only once.

For example:

```text
Same webhook received 5 times
        ↓
Only one wallet credit
```

---

# 18. Blocked Wallet

A blocked wallet cannot perform financial operations.

A blocked wallet cannot:

- Send money.
- Receive money.
- Add money.
- Request a withdrawal.

The wallet must remain blocked until its status is changed through the appropriate administrative process.

---

# 19. Privacy

Users can access only their own financial information.

A user must not be able to:

- View another user's wallet balance.
- View another user's transaction history.
- Access another user's withdrawal details.
- Modify another user's financial records.

Administrative access is separate from user access.

---

# 20. Configurable Business Rules

Business limits that may change should be configurable through environment configuration rather than hardcoded throughout the application.

This includes, at minimum:

- Minimum deposit
- Maximum deposit
- Maximum transfer amount
- Daily transfer limit
- Transfer fee percentage
- Minimum transfer fee
- Maximum transfer fee
- Minimum withdrawal
- Maximum withdrawal
- Payment expiration window

The current default values are documented in this BRD.

Changing a configuration value must not require rewriting the financial business logic.

---

# 21. Required Financial States

### Payment

```text
CREATED
PROCESSING
SUCCESS
FAILED
CANCELLED
EXPIRED
```

### Transfer

```text
PENDING
COMPLETED
FAILED
REVERSED
```

### Withdrawal

```text
PENDING
APPROVED
REJECTED
```

A state transition must follow the defined business lifecycle and must not allow invalid repeated processing.

---

# 22. Acceptance Criteria

PayLedger is considered functionally complete when:

### Authentication
- A user can register with a mandatory mobile number and password.
- Email can be omitted.
- A registered user can log in without mobile/email verification.
- Blocked users cannot perform wallet operations.

### Wallet
- A user can view their wallet balance.
- Wallet balance never becomes negative.
- Held withdrawal funds cannot be spent again.

### Deposit
- Deposits respect the configured ₹100–₹25,000 limits.
- Multiple pending payment orders are supported.
- Expired payment orders cannot be completed.
- Successful payment credits the wallet exactly once.
- Repeated webhooks do not create duplicate credits.
- Invalid webhook signatures do not modify the wallet.

### Transfer
- Users can transfer only to registered users.
- Recipient is selected by mobile number.
- Self-transfer is rejected.
- Maximum transfer is ₹25,000.
- Daily transfer limit is ₹50,000.
- Fee is 1%, minimum ₹1 and maximum ₹20.
- Sender pays the fee.
- Sender cannot go below zero.
- Duplicate requests do not duplicate the transfer.
- Concurrent transfers maintain correct balances.
- A transfer is all-or-nothing.

### Withdrawal
- Withdrawal respects the configured ₹100–₹25,000 limits.
- Requested money is held while pending.
- Admin can approve or reject a pending withdrawal.
- Approval completes the financial withdrawal.
- Rejection releases the held amount.
- A withdrawal cannot be processed twice.

### Reversal
- Admin can reverse a completed transfer.
- A transfer cannot be reversed more than once.
- Reversal creates a new financial operation.
- Original financial records remain unchanged.

### Privacy
- Users can access only their own wallet and transactions.

### Financial integrity
- Every completed financial movement has balanced ledger entries.
- Ledger history cannot be edited or deleted.
- No financial operation can leave partially completed changes.