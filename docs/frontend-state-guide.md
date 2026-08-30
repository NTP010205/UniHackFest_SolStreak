# Frontend state guide

| Surface/state | Trigger | UI behavior | Retry/action | Backend source of truth |
| --- | --- | --- | --- | --- |
| Authentication: initializing | Privy auth or wallet list not ready | Full loader; no wallet/API action | Wait for Privy callbacks | Privy `ready` plus Solana wallet readiness |
| Authentication: signed out | Ready and not authenticated | Landing/login action; redirect away from dashboard | Invoke Privy login | Privy authenticated state |
| Authentication: wallet missing | Authenticated without embedded Solana wallet | Explain secure wallet is loading/unavailable; disable transactions | Reinitialize/login; never select extension/EVM as substitute | `useSolStreakWallet().wallet` |
| Funding: loading | Initial read or Refresh | Keep address visible; show balance placeholders and disable duplicate refresh | Await current read | Active-profile RPC |
| Funding: ready | Valid SOL and USDC reads | Show formatted balances and last-updated time | Manual Refresh | RPC balances and active USDC mint |
| Funding: missing USDC ATA | Empty token-account list | Show `0 USDC`, not an error | Refresh after external funding | RPC token accounts |
| Funding: error | RPC error/rate limit/invalid response | Sanitized read-only error; dashboard stays mounted | Refresh balances | Active-profile RPC |
| Portfolio: initial | Status fetch pending with no data | Stats/streak skeletons | Await request | `GET /api/streak/status` |
| Portfolio: stale/error | Status fetch fails after prior data | Preserve stale data and show Retry | Refetch status | Status API/PostgreSQL; Jupiter position is separately nullable |
| Jupiter position unavailable | Position read fails inside successful status call | Show unavailable position, retain totals/streak | Refresh status later | `positionUnavailable` and `currentPositionUsdc` |
| Deposit/Withdraw: disabled | Any transaction gate fails | Disable action and display exact reason | Resolve auth/RPC/amount/flag/unresolved state | Client gate plus active network config |
| Deposit/Withdraw: preparing | Execution begins | Lock both actions; progress label | No second click | Transaction lifecycle |
| Deposit/Withdraw: awaiting signature | Privy signing requested | Explain user approval is required | User approve/reject; rejection is failure | Privy signer result |
| Deposit/Withdraw: submitted/confirming | RPC returned signature | Show signature/explorer link and keep actions locked | Status lookup only; never resend | RPC plus durable submission API |
| Deposit/Withdraw: confirmed | On-chain confirmation succeeds | Success state; refresh portfolio/balances | Normal refresh | RPC confirmation and report verifier |
| Deposit: report pending | Confirmed but report failed | Show confirmed-on-chain distinction and report retry | Retry report with same signature | Submission record/report API |
| Transaction: failed/expired | Proven error or expired lifetime | Terminal explanation; permit a new intentional transaction per policy | Never blind retry old transaction | RPC status/block height |
| Transaction: unknown | Signature cannot be reconciled | Warn and lock new transactions | Recovery/reconciliation with same signature | Submission API and reconciliation worker |
| Streak tracker: loading/empty | Status pending or no verified deposit days | Skeleton or zero-state copy | Refresh status | Status API, never client date arithmetic |
| Streak tracker: active | Verified status payload | Render `last7Days`, current, longest | Refresh after confirmed report | PostgreSQL streak engine |
| Lucky Wheel: unavailable | `canSpin` false | Disabled cosmetic wheel; no local eligibility guess | Refresh status/profile | Status API and entitlement ledger |
| Lucky Wheel: requesting | POST in flight | Lock spin controls; retain current idempotency key | Retry uncertain request with same key | Spin API |
| Lucky Wheel: spinning/revealed | Successful server outcome | Animate to returned `result`; show returned badge metadata | New key only for next intentional entitlement | Persisted spin/award |
| Badge collection: loading/empty | Profile fetch pending/no awards | Skeleton or cosmetic empty state | Refetch profile | `GET /api/profile/badges` |
| Badge collection: duplicate | `isNewBadge` false or count > 1 | Reuse ownership card and display count/history | Refetch profile after spin | Badge ledger aggregate/history |
| Recovery: unresolved | Submission GET returns unresolved record | Restore report-pending/unknown UI and lock corresponding transaction | Track/report same signature | Durable submission record |
| API: rate limited | HTTP 429 | Preserve data; show temporary delay | Retry after `Retry-After` seconds | PostgreSQL rate limiter |
| API: unavailable | Sanitized HTTP 503 | Non-destructive outage message with request ID | User-triggered retry after delay | API/database/RPC health |
