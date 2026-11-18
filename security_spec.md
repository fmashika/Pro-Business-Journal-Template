# Security Specification & Threat Model — Amani Ledger

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: All user PII (`email`, `displayName`) lives exclusively in `/users/{userId}/private/profile` and is readable/writable only by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Owner-Scoped Ledger**: Every `JournalEntry`, `DebtAccount`, and `UserPreferences` document must carry `userId == request.auth.uid`. Cross-user reads, lists, writes, or deletes are unconditionally denied.
3. **Immutable Identity & Timestamps**: `userId`, `id`, and `createdAt` cannot be modified after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. **Relational Debt Integrity**: A `JournalEntry` with `type == 'debt'` and a `debtId` can only be created or updated if the referenced `/users/{userId}/debts/{debtId}` document exists.
5. **Terminal Debt State Locking**: Once a `DebtAccount` reaches `status == 'paid_off'`, further payment updates are blocked.
6. **Volumetric & Type Bounds**: Every string has explicit `.size()` bounds; numeric amounts and exchange rates must be strictly positive within valid numeric ranges; IDs match `^[a-zA-Z0-9_-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection**: Creating a `JournalEntry` with extra ghost field `isAdmin: true` or `verified: true` -> Rejected by `keys().hasOnly(...)`.
2. **Identity Spoofing**: Creating a `JournalEntry` under `/users/victimUid/entries/e1` or setting `userId: "victimUid"` -> Rejected by `isOwner(userId)` and `data.userId == request.auth.uid`.
3. **Unverified Email Write**: Writing with `request.auth.token.email_verified == false` -> Rejected by `isVerifiedUser()`.
4. **Path ID Poisoning**: Creating `/users/{uid}/entries/../../etc/passwd` or a 500-char ID -> Rejected by `isValidId(entryId)`.
5. **Timestamp Forgery**: Setting `createdAt` or `updatedAt` to a past/future client timestamp -> Rejected by `== request.time`.
6. **CreatedAt Mutation on Update**: Changing `createdAt` during an entry update -> Rejected by `incoming().createdAt == existing().createdAt`.
7. **Negative / Zero Amount Poisoning**: Logging `amount: -500` or `exchangeRate: 0` -> Rejected by `data.amount > 0` and `data.exchangeRate > 0`.
8. **Orphaned Debt Reference**: Creating a `debt` entry pointing to a non-existent `debtId: "ghost_debt_999"` -> Rejected by `exists(...)`.
9. **Paid-Off Debt Tampering**: Updating `amountPaid` on a `DebtAccount` whose `existing().status == 'paid_off'` -> Rejected by terminal state lock.
10. **String Resource Exhaustion**: Injecting a 50KB `notes` or `title` string -> Rejected by `.size()` bounds.
11. **Invalid Enum Poisoning**: Setting `type: "crypto_scam"` or `currency: "EUR"` -> Rejected by enum allowlists.
12. **Blanket List Query Bypass**: Attempting `list` without `where('userId', '==', uid)` or querying another user's subcollection -> Rejected by `resource.data.userId == request.auth.uid`.
