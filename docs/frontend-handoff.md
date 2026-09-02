# Frontend handoff

## Architecture and ownership

SolStreak is a Next.js App Router application. Client components own presentation, Privy interaction, read-only balance refresh, transaction assembly/signing UX, and animation. Route handlers own authentication, wallet binding, request validation, rate limiting, on-chain report verification, streak state, spin eligibility/random selection, and badge persistence. PostgreSQL and verified Solana transactions are the durable sources of truth; React state is not.

The currently selected profile is Devnet. Mainnet constants and data namespaces remain present, but both transaction flags must stay `false` during redesign. Render the network from `ACTIVE_NETWORK`: use “Solana Devnet”, `DEVNET — TEST ASSETS`, and “No financial value” for Devnet; use “Solana Mainnet” for Mainnet. Never infer a profile from an RPC URL or let a user-controlled field switch profiles.

## Privy and embedded wallet lifecycle

`useSolStreakWallet` combines Privy authentication readiness and Solana wallet readiness. Wallet UI must wait for `ready`; signed-out users return to `/`; wallet actions additionally require `authenticated` and the selected Privy embedded Solana wallet. Do not select an extension or EVM wallet. The embedded address may be truncated for display, but copy actions copy the full address. Logout/login restores the same embedded wallet through Privy; durable backend records are keyed by Privy identity, wallet, and network where applicable.

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

Explorer links must use `transactionExplorerUrl(signature, ACTIVE_NETWORK)`. Devnet links include `?cluster=devnet`; Mainnet links omit a cluster query. Never build a Mainnet explorer link for a Devnet signature.

## Wheel and cosmetic badges

Entitlement sources are `welcome_demo` and `streak`.

- `welcome_demo` is granted only on Devnet, once per Privy user. Reload, logout/login, or wallet recovery does not grant another. It creates no deposit or streak.
- `streak` retains backend streak eligibility and daily source-reference behavior.
- The frontend sends a UUID `Idempotency-Key`, retains it while a request is uncertain, and uses a new key only for a new intentional spin.
- The backend chooses the weighted outcome. The wheel only animates to the returned stable outcome ID.

The catalog is `BRONZE`, `SILVER`, `GOLD`, `DIAMOND`, `JACKPOT`. Every badge is cosmetic, has no financial value, and is not transferable or redeemable. Duplicate awards retain history and increment `awardCount`; they do not create duplicate ownership rows. A replay with the same request key returns the persisted canonical spin result and does not draw again.

Profile concepts map to the current API fields as follows: active profile → `networkProfile`; collection → `badges`; history → `recentHistory`; available entitlements → `availableSpinEntitlements`. Do not invent `activeProfile` or `collection` fields.

## Persistence and resilience

Backend deposits, streaks, submissions, entitlements, spins, awards, and badge aggregates survive reload/logout/login. The client keeps only minimal unresolved submission references locally; it never stores a raw signed transaction. On login/reload, fetch unresolved submissions and badge/profile data again.

Every data surface needs loading, empty, stale/error, and retry rendering. A position RPC failure is represented by `currentPositionUsdc: null` plus `positionUnavailable: true`; it must not erase streak data. For API 429, preserve the current view and respect `Retry-After`. For sanitized 503 responses, show temporary service unavailability without exposing internal detail. Capture `x-request-id` for support diagnostics.

## Backend invariants the frontend must not implement

Frontend code must not calculate or decide random outcomes, spin eligibility, streaks, deposit validity, award counts, report verification, wallet ownership, or network isolation. It must not treat an animation, optimistic state, transaction signature, or client-selected profile as proof of success. Layout, typography, colors, responsive structure, animations, skeletons, and component composition may be redesigned freely as long as these contracts and safety states remain intact.
