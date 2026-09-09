# API contract

## Shared perimeter

All frontend-safe routes authenticate a Privy identity token from the `privy-id-token` header (the server also understands its Privy cookie) and verify that the requested wallet is a linked Solana wallet. POST routes require `Content-Type: application/json`, enforce a 4,096-byte body limit, and reject malformed JSON, unknown fields, and invalid values. Every response carries `x-request-id`; a safe incoming `x-request-id` may be propagated.

Common errors are: `400 INVALID_REQUEST` (or the more specific request code described below), `401 UNAUTHORIZED`, `403 WALLET_FORBIDDEN`/business-specific denial, `409 SUBMISSION_CONFLICT`, `413 BODY_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED` with integer `Retry-After`, sanitized `503 RATE_LIMIT_UNAVAILABLE` or `SERVICE_UNAVAILABLE`, and sanitized `500 INTERNAL_ERROR`. Not every route can emit every common error.

The active server profile is authoritative. Public routes never accept a profile switch except where the body profile is checked for exact equality with the active profile.

## Frontend-safe endpoints

### `POST /api/activity/heartbeat`

Strict body: `{ wallet: string }`. The route authenticates the Privy identity, proves that the requested Solana wallet is linked to it, rate-limits the request, and records only the active network profile, wallet, and server timestamp. It never accepts a client-supplied user ID or timestamp. Success is `200 { networkProfile; status: 'active'; lastSeenAt }`.

The authenticated application shell sends this best-effort heartbeat every 30 seconds only while the tab is visible. It does not sign, build, broadcast, reconcile, or unlock a transaction. Failure never blocks Deposit/Withdraw.

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

### `POST /api/transactions/submissions/reconcile`

Strict body:

```ts
{ wallet: string; kind: 'deposit' | 'withdraw' }
```

The route first authenticates the Privy identity and proves that `wallet` is linked to it, then rate-limits and claims at most five unresolved records matching that exact user, wallet, transaction kind, and active network profile. It queries existing signatures and may update their lifecycle/report state; it never builds, signs, or broadcasts a transaction and never processes another user's row. The Transaction Card explicitly runs the owned Deposit and Withdraw checks together so one unresolved kind cannot remain hidden while locking the other.

Success returns sanitized counters: `claimed`, `pending`, `reconciled`, `reportPending`, `failed`, `expired`, and `unknown`. The client refetches unresolved records after the check. Only a terminal result unlocks a new transaction; a still-pending or unknown signature remains locked against accidental resubmission.

## Devnet Admin Lab endpoints

All Admin Lab routes authenticate through the normal Privy identity-token flow, require the client-selected wallet in the query or strict JSON body, prove that exact wallet is linked to the identity, then exact-match either the server-only `SOLSTREAK_ADMIN_PRIVY_USER_IDS` or `SOLSTREAK_ADMIN_WALLET_ADDRESSES` allowlist. This avoids accidentally authorizing against another linked wallet when a Privy account contains more than one. They reject any active profile other than Devnet. Missing/empty allowlists, non-admin identity, and Mainnet all return `403 ADMIN_FORBIDDEN` before rate-limit or business database mutation. Allowlists are never returned to clients. A valid wallet placed in the legacy Privy-ID variable is accepted for local-config compatibility, but new deployments should use the dedicated wallet variable.

### `GET /api/admin/access`

Requires a canonical active wallet as `?wallet=<base58-address>`. This lightweight capability check verifies the Privy token, exact linked wallet, Devnet profile, and server allowlist without querying application tables. It returns `200 { isAdmin: true; networkProfile: 'devnet' }` only when the Admin navigation may be revealed; other users receive `403` and never see the Admin menu item.

### `GET /api/admin/metrics`

Requires a canonical active wallet as `?wallet=<base58-address>`.

Returns `200` only for an authenticated Devnet admin:

```ts
{
  isAdmin: true;
  networkProfile: 'devnet';
  totalUsers: number;
  devnetProfiles: number;
  activeProfiles7d: number;
  activeStreaks: number;
  streakDistribution: { days1to6: number; days7to14: number; days15to29: number; days30Plus: number };
  totalSpins: number;
  totalBadgeAwards: number;
  uniqueBadgeOwnerships: number;
}
```

Only aggregate Devnet values are returned. Wallet addresses, Privy IDs, allowlists, secrets, and Mainnet data are excluded.

### `GET /api/admin/users`

Requires a canonical active wallet as `?wallet=<base58-address>`.

Returns `200` only for an authenticated Devnet admin:

```ts
{
  isAdmin: true;
  networkProfile: 'devnet';
  users: Array<{
    walletLabel: string;
    currentStreak: number;
    longestStreak: number;
    totalDepositedUsdc: number;
    lastActiveAt: string;
    isOnline: boolean;
  }>;
}
```

This endpoint is read-only and limited to at most 100 registered application users in the current Devnet deployment. It returns an abbreviated wallet label plus Devnet-only activity/streak summaries; accounts without Devnet activity appear with zero values. A server-recorded heartbeat within the last 75 seconds produces `isOnline: true`. Online users sort first, followed by most recent activity and then streak. It never returns email addresses, Privy IDs, full wallet addresses, allowlists, database details, secrets, or Mainnet activity. Admins cannot update another user's streak or identity through this route.

### `POST /api/admin/spin`

Strict body: `{ wallet }` for the active linked wallet.

Also requires a UUID `Idempotency-Key`. Success uses the ordinary public badge-spin result contract, with `source: 'admin_test'`. The server uses cosmetic weights Bronze 40%, Silver 27%, Gold 23%, Diamond 5%, Jackpot 5%. A replay returns the same persisted result; the operation creates one consumed audit entitlement, one spin, one award, and updates badge ownership atomically without consuming `welcome_demo` or `streak` entitlements.

### `POST /api/admin/streak`

Strict body: `{ wallet, currentStreak }` for the active linked wallet.

`currentStreak` must be an integer from 0–365. Success: `200 { currentStreak: number; longestStreak: number }`. The server derives the Privy user from the verified token and accepts the wallet only after proving that exact address is linked to that identity; arbitrary user or extra fields are rejected. This changes only the authenticated admin's Devnet demo streak and does not change normal streak calculation behavior.

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
