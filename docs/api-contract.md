# API contract

## Shared perimeter

All frontend-safe routes authenticate a Privy identity token from the `privy-id-token` header (the server also understands its Privy cookie) and verify that the requested wallet is a linked Solana wallet. POST routes require `Content-Type: application/json`, enforce a 4,096-byte body limit, and reject malformed JSON, unknown fields, and invalid values. Every response carries `x-request-id`; a safe incoming `x-request-id` may be propagated.

Common errors are: `400 INVALID_REQUEST` (or the more specific request code described below), `401 UNAUTHORIZED`, `403 WALLET_FORBIDDEN`/business-specific denial, `409 SUBMISSION_CONFLICT`, `413 BODY_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED` with integer `Retry-After`, sanitized `503 RATE_LIMIT_UNAVAILABLE` or `SERVICE_UNAVAILABLE`, and sanitized `500 INTERNAL_ERROR`. Not every route can emit every common error.

The active server profile is authoritative. Public routes never accept a profile switch except where the body profile is checked for exact equality with the active profile.

## Frontend-safe endpoints

### `GET /api/streak/status?wallet=<Solana address>`

- Auth: Privy plus linked-wallet verification.
- Success: `200`.

```ts
{
  wallet: string;
  totalDepositedUsdc: number;
  currentStreak: number;
  longestStreak: number;
  last7Days: Array<{ date: string; deposited: boolean }>;
  canSpin: boolean;
  currentPositionUsdc: number | null;
  positionUnavailable: boolean;
  networkProfile: 'mainnet' | 'devnet';
}
```

The query permits exactly one `wallet` parameter. Jupiter position failure still returns `200`, with `currentPositionUsdc: null` and `positionUnavailable: true`. On Devnet the status load may idempotently grant the one-time welcome entitlement. All totals, streaks, spins, and position reads use the active profile.

### `POST /api/streak/report`

```ts
{ wallet: string; signature: string; networkProfile: 'mainnet' | 'devnet' }
```

- Auth: Privy plus linked-wallet verification.
- Success: `200 { inserted: boolean; currentStreak: number }`.
- Route errors: `409 NETWORK_MISMATCH`; `422 INVALID_DEPOSIT`.

The backend re-verifies the transaction for the authenticated wallet, active program, mint/vault path, and balance delta. `(network_profile, signature)` is idempotent: replay returns `inserted: false` and does not advance the streak twice.

### `POST /api/wheel/spin`

Headers include a valid UUID `Idempotency-Key` and the Privy token. Body:

```ts
{ wallet: string }
```

Success is `200`:

```ts
{
  spinId: string;
  result: 'badge_bronze' | 'badge_silver' | 'badge_flame' | 'discount_fee' |
          'badge_gold' | 'streak_boost' | 'badge_diamond' | 'jackpot_usdc';
  badgeCode: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'JACKPOT';
  label: string;
  isNewBadge: boolean;
  awardCount: number;
  source: 'welcome_demo' | 'streak';
  remainingSpins: number;
}
```

Route errors include `400 INVALID_IDEMPOTENCY_KEY` and `403 SPIN_NOT_ELIGIBLE`. The strict body rejects client-supplied outcome, badge, entitlement, or profile. The same `(active profile, Privy user, request key)` returns the persisted result, does not draw again, and does not insert another spin/award. `isNewBadge`, `awardCount`, and `remainingSpins` are persisted award snapshots for canonical replay.

### `GET /api/profile/badges?wallet=<Solana address>`

- Auth: Privy plus linked-wallet verification.
- Success: `200`.

```ts
{
  networkProfile: 'mainnet' | 'devnet';
  badges: Array<{
    badgeCode: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'JACKPOT';
    displayLabel: string;
    awardCount: number;
    firstEarnedAt: string;
    lastEarnedAt: string;
  }>;
  recentHistory: Array<{
    spinId: string;
    badgeCode: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'JACKPOT';
    displayLabel: string;
    awardedAt: string;
  }>;
  availableSpinEntitlements: Array<{
    entitlementId: string;
    source: 'welcome_demo' | 'streak';
    createdAt: string;
  }>;
}
```

Dates are JSON-serialized ISO timestamps. History is newest-first and limited to 20. This route may idempotently grant the Devnet welcome entitlement. The exact fields are `networkProfile`, `badges`, `recentHistory`, and `availableSpinEntitlements`; `activeProfile` and `collection` do not currently exist.

### `POST /api/transactions/submissions`

```ts
{
  wallet: string;
  signature: string;
  networkProfile: 'mainnet' | 'devnet';
  kind: 'deposit' | 'withdraw';
  blockhash: string;
  lastValidBlockHeight: number;
}
```

- Auth: Privy plus linked-wallet verification.
- Success: `200` with the public submission record below.
- Route errors: `409 NETWORK_MISMATCH`, `409 SUBMISSION_CONFLICT`.

The route registers a signature after RPC submission. It does not trust a client confirmation claim and does not update streaks. Repeating an identical `(networkProfile, signature)` is idempotent; conflicting immutable fields are rejected.

### `GET /api/transactions/submissions?wallet=<Solana address>`

- Auth: Privy plus linked-wallet verification.
- Success: `200 { submissions: SubmissionRecord[] }` for the authenticated user/wallet and active profile.

```ts
type SubmissionRecord = {
  networkProfile: 'mainnet' | 'devnet'; signature: string; wallet: string;
  kind: 'deposit' | 'withdraw'; blockhash: string; lastValidBlockHeight: number;
  status: 'submitted' | 'pending' | 'unknown' | 'confirmed_unreported' |
          'report_pending' | 'processing' | 'reconciled' | 'failed' | 'expired';
  submittedAt: string; confirmedAt: string | null; reportedAt: string | null;
  attemptCount: number; nextAttemptAt: string; lastErrorCode: string | null;
};
```

The recovery query returns only unresolved statuses from storage, even though the public type above lists all lifecycle values that a tracked record can carry.

## Internal-only endpoint

### `POST /api/internal/reconcile` — server/scheduler only

Frontend code must never call this route. It requires `Authorization: Bearer <server-only secret>`, checks authorization before limiter/database work, accepts optional `?limit=<integer>` clamped to 1–100 (default 25), and has a 20-second execution timeout.

Success `200`:

```ts
{
  claimed: number; pending: number; reconciled: number; reportPending: number;
  failed: number; expired: number; unknown: number; skipped: number;
}
```

Errors: `401 UNAUTHORIZED`, `405 METHOD_NOT_ALLOWED` with `Allow: POST`, `429 RATE_LIMITED` with `Retry-After`, or sanitized `503 RECONCILIATION_UNAVAILABLE`. Repeated invocations are protected by database claims and business idempotency; they never broadcast a transaction.
