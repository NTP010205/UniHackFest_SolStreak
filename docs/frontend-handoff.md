# Frontend handoff

## Architecture and ownership

SolStreak is a Next.js App Router application. Client components own presentation, Privy interaction, read-only balance refresh, transaction assembly/signing UX, and animation. Route handlers own authentication, wallet binding, request validation, rate limiting, on-chain report verification, streak state, spin eligibility/random selection, and badge persistence. PostgreSQL and verified Solana transactions are the durable sources of truth; React state is not.

The currently selected profile is Devnet. Mainnet constants and data namespaces remain present, but both transaction flags must stay `false` during redesign. Render the network from `ACTIVE_NETWORK`: use “Solana Devnet”, `DEVNET — TEST ASSETS`, and “No financial value” for Devnet; use “Solana Mainnet” for Mainnet. Never infer a profile from an RPC URL or let a user-controlled field switch profiles.

## Privy and embedded wallet lifecycle

`useSolStreakWallet` combines Privy authentication readiness and Solana wallet readiness. Wallet UI must wait for `ready`; signed-out users return to `/`; wallet actions additionally require `authenticated` and the selected Privy embedded Solana wallet. Do not select an extension or EVM wallet. The embedded address may be truncated for display, but copy actions copy the full address. Logout/login restores the same embedded wallet through Privy; durable backend records are keyed by Privy identity, wallet, and network where applicable.

The selected embedded wallet must also appear in the currently authenticated Privy user's Solana `linkedAccounts`. A `sessionKey` binds client state to that exact Privy user and wallet so an old wallet, verification result, balance, badge profile, admin response, or transaction state cannot survive an account switch.

Privy hook functions and refreshed identity-token values are not effect identity keys. Transaction lifecycles reset only when the transaction kind or authenticated `sessionKey` changes; the latest signing function, wallet object, success callback, and token are read through refs. Portfolio, badge, and Admin Lab loaders likewise react to wallet/token availability rather than a rotating token value. This prevents authenticated dashboard render loops from blocking navigation.

On Devnet, Deposit and Withdraw require a successful Privy message signature for the active `sessionKey`. This verification signature does not create, sign, or broadcast a transaction. It resets on logout, login as another user, or embedded-wallet change. Every real transaction still opens its own Privy transaction-signature prompt after all safety checks pass.

Authenticated API calls send the Privy identity token in `privy-id-token`. The server verifies issuer, audience, expiry, and that the requested Solana wallet appears in `linked_accounts`. Never log or render the token.

## Funding readiness

`FundingReadiness` and `useFundingReadiness` read the active embedded address through the configured profile RPC:

- SOL uses `getBalance` and 9 decimals.
- USDC uses token accounts for `ACTIVE_NETWORK.usdcMint`; Devnet is Circle Devnet USDC and always uses 6 decimals.
- No USDC token account is a normal `0 USDC` result. The app does not create an ATA during a balance read.
- Refresh starts a new read and updates `updatedAt` only after a successful result.
- RPC failure leaves the dashboard usable, shows a sanitized read-only error, and permits another refresh.

Faucets are external links only: [Solana faucet](https://faucet.solana.com/) and [Circle faucet](https://faucet.circle.com/). SolStreak must not request faucet assets on the user’s behalf.

## Deposit and withdraw lifecycle

The transaction surface must represent the phases from `transactionLifecycle.ts` exactly:

| Phase | UI meaning |
| --- | --- |
| `idle` / disabled | Show the gate reason: feature flag, Privy readiness, authentication, embedded wallet, RPC, amount, or unresolved transaction. |
| `preparing` | Fetch one blockhash lifetime and build the active-profile transaction. Disable another submission. |
| `awaiting_signature` | Privy prompt is active. A rejection is a recoverable failure, not success. |
| `submitted` | RPC returned a signature. Save/track the durable reference immediately. |
| `confirming` | Confirm using signature, blockhash, and last-valid block height from the same lifetime. |
| `confirmed` | RPC/on-chain confirmation succeeded. Deposit reporting also succeeded when applicable. |
| `report_pending` | Transaction is confirmed but deposit reporting failed. Offer report-only retry for the same signature. |
| `failed` | Signing/building failed before submission or RPC proved an on-chain error. |
| `expired` | The recorded lifetime expired without confirmation. |
| `unknown` | A submitted signature could not be reconciled. Require reconciliation and keep new transactions locked. |

There is one broadcast call with `maxRetries: 0`. After a signature exists, never rebuild, resign, resend, or “try another RPC”. Query signature status and retry only tracking/reporting with the same signature. UI messages are advisory; only RPC and backend verification establish success.

For an unresolved signature, the card exposes a kind-specific **Check transaction status** action. It calls the authenticated user reconciliation endpoint, which checks only the already-recorded signature. Pending/unknown stays locked; reconciled, failed, or expired becomes terminal and safely unlocks a fresh transaction. This status check does not open a wallet prompt or resend funds.

The Deposit Success video is presentation-only and is keyed by the newly confirmed on-chain signature, not by observing a transient React `confirmed` phase. A signature is registered once so an immediate transition to `report_pending` cannot suppress the animation and a later report retry cannot replay it.

Explorer links must use `transactionExplorerUrl(signature, ACTIVE_NETWORK)`. Devnet links include `?cluster=devnet`; Mainnet links omit a cluster query. Never build a Mainnet explorer link for a Devnet signature.

Before a Devnet deposit reaches the signing prompt, the client verifies that the active wallet has an initialized Circle Devnet USDC token account with enough balance. A missing account, insufficient balance, absent withdraw position, cancellation, or simulation failure is rendered as a short sanitized message; raw RPC logs and internal program details are not displayed.

## Wheel and cosmetic badges

Normal-user entitlement sources are `welcome_demo` and `streak`. The Devnet-only Admin Lab additionally persists `admin_test` as an already-consumed audit row; it never consumes or creates an available normal-user entitlement.

- `welcome_demo` is granted only on Devnet, once per Privy user. Reload, logout/login, or wallet recovery does not grant another. It creates no deposit or streak.
- `streak` retains backend streak eligibility and daily source-reference behavior.
- The frontend sends a UUID `Idempotency-Key`, retains it while a request is uncertain, and uses a new key only for a new intentional spin.
- The backend chooses the weighted outcome. The wheel only animates to the returned stable outcome ID.

The catalog is `BRONZE`, `SILVER`, `GOLD`, `DIAMOND`, `JACKPOT`. Every badge is cosmetic, has no financial value, and is not transferable or redeemable. Duplicate awards retain history and increment `awardCount`; they do not create duplicate ownership rows. A replay with the same request key returns the persisted canonical spin result and does not draw again.

Profile concepts map to the current API fields as follows: active profile → `networkProfile`; collection → `badges`; history → `recentHistory`; available entitlements → `availableSpinEntitlements`. Do not invent `activeProfile` or `collection` fields.

Badge collection, history, wheel results, and Admin Lab results share the client-safe artwork catalog in `src/lib/badgeArtwork.ts`. Jackpot wheel segments may show `Chest.png`, but persisted result and collection artwork use `Jackpot.png`. No probability or draw logic belongs in that client catalog.

## Devnet Admin Lab

The dashboard probes `GET /api/admin/metrics` with the active embedded wallet. It renders Admin Lab controls only after the backend authenticates the Privy user, proves that exact wallet linkage, exact-matches the server Privy-ID or wallet allowlist, and confirms the active profile is Devnet. The client never receives either allowlist. A temporary read-only user-table failure no longer hides an already-authorized Admin Lab. Admin streak updates target only the authenticated embedded wallet, and admin test spins remain server-random, persisted, atomic, rate-limited, and idempotent.

The Admin Lab also loads a read-only user table from `GET /api/admin/users`. It may show only the server-abbreviated wallet label, current and longest streak, verified Devnet deposit total, last activity time, and an approximate online flag. It provides no edit action and does not expose email, Privy ID, full wallet address, database details, or Mainnet data.

The authenticated application shell posts a best-effort heartbeat every 30 seconds while its tab is visible, including Home and Dashboard. Admin Lab refreshes its read-only metrics/table every 15 seconds only after server authorization. A heartbeat no older than 75 seconds is shown as online; online and most-recently-active wallets sort first. Wallets without recorded Devnet activity remain visible with zero deposit/streak values. Presence never unlocks a transaction and never bypasses Privy wallet verification.

Navigation calls the lightweight, database-free `GET /api/admin/access` capability check for the active embedded wallet. The Admin link is rendered only after a `200` server confirmation, so ordinary authenticated users do not see it. Authorization remains entirely server-side and non-admin users never receive metrics or user rows.

For authenticated admins, Admin Lab appears directly after the portfolio summary and exposes a shortcut to the dedicated `/admin` workspace. Opening `/admin` does not trust client configuration: its API calls repeat the same server authorization and show a clear denied/unavailable state. The only writable demo controls remain scoped to the admin's own authenticated wallet (demo streak and persisted cosmetic test spins); rows belonging to other Devnet users remain strictly read-only.

Admin users use the ordinary Deposit/Withdraw flow. They receive no balance, safety-flag, signature, RPC, or on-chain verification bypass.

## Persistence and resilience

Backend deposits, streaks, submissions, entitlements, spins, awards, and badge aggregates survive reload/logout/login. The client keeps only minimal unresolved submission references locally; it never stores a raw signed transaction. On login/reload, fetch unresolved submissions and badge/profile data again.

Every data surface needs loading, empty, stale/error, and retry rendering. A position RPC failure is represented by `currentPositionUsdc: null` plus `positionUnavailable: true`; it must not erase streak data. For API 429, preserve the current view and respect `Retry-After`. For sanitized 503 responses, show temporary service unavailability without exposing internal detail. Capture `x-request-id` for support diagnostics.

The dashboard reuses the landing page's editorial hierarchy and the existing SolStreak artwork only: a compact vault hero, portfolio summary, wallet-readiness step, daily transaction/streak/wheel loop, Admin Lab, and cosmetic collection. The Streak Tracker presents the same backend-provided seven-day history as a tiered command center with milestone progress, current-tier artwork, secured-day states, and a clear today status. The interactive particle background remains active, while motion respects `prefers-reduced-motion`.

## Backend invariants the frontend must not implement

Frontend code must not calculate or decide random outcomes, spin eligibility, streaks, deposit validity, award counts, report verification, wallet ownership, or network isolation. It must not treat an animation, optimistic state, transaction signature, or client-selected profile as proof of success. Layout, typography, colors, responsive structure, animations, skeletons, and component composition may be redesigned freely as long as these contracts and safety states remain intact.
