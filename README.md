# SolStreak

SolStreak is a Next.js application for tracking verified USDC deposit streaks, interacting with Jupiter Earn through an embedded Privy Solana wallet, recovering submitted transactions, and earning cosmetic profile badges from backend-controlled wheel entitlements.

The active development profile is Solana Devnet. All Devnet SOL/USDC are test assets. Badges (`BRONZE`, `SILVER`, `GOLD`, `DIAMOND`, `JACKPOT`) are cosmetic only: no financial value, not transferable, and not redeemable. The product has no token, NFT, payout, discount, or streak-boost entitlement.

## Frontend handoff

- [Frontend architecture and invariants](docs/frontend-handoff.md)
- [Exact API contract](docs/api-contract.md)
- [Frontend state guide](docs/frontend-state-guide.md)
- [Backend readiness and operational blockers](docs/backend-readiness.md)

## Local setup

Requirements: Node.js 20.9 or newer and PostgreSQL for backend persistence.

```bash
cd /home/binnho/web
npm install
cp .env.local.example .env.local
npm run db:migrate
npm run dev
```

Do not commit secrets. Browser-visible RPC keys must be domain-restricted, rate-limited, and quota-limited.

## Environment variable names

Client-visible:

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_SOLANA_NETWORK_PROFILE`
- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL`
- `NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL`
- `NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL`
- `NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS`
- `NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS`

Server-only:

- `DATABASE_URL`
- `RPC_URL`
- `SOLANA_DEVNET_RPC_URL`
- `RECONCILIATION_SECRET`
- `JUPITER_LENDING_PROGRAM_ID`

Integration rehearsal only:

- `SOLSTREAK_REHEARSAL_DATABASE_URL`
- `SOLSTREAK_REHEARSAL_CRON_SECRET`
- `SOLSTREAK_DEVNET_DEPOSIT_SIGNATURE` (optional confirmed fixture)
- `SOLSTREAK_DEVNET_WITHDRAW_SIGNATURE` (optional confirmed fixture)

Both transaction gates are fail-closed and must remain false by default:

```text
NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS=false
NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS=false
```

Never enable both flags simultaneously.

## Database migrations

`npm run db:migrate` applies the schema/migrations in dependency order. The relevant durable migrations are:

1. `002_network_profiles.sql`
2. `003_transaction_submissions.sql`
3. `004_api_rate_limits.sql`
4. `005_cosmetic_badges.sql`

Use a separate rehearsal database for integration tests. Never point a rehearsal command at the application database.

## Verification

Source verification:

```bash
npm test
npx tsc --noEmit
npm run build
```

Database/RPC integration harnesses require their documented rehearsal variables and do not run under normal `npm test`:

```bash
npm run test:reconciliation:integration
npm run test:scheduler:integration
npm run test:api-perimeter:integration
npm run test:cosmetic-badges:integration
```

## Safety boundaries

- Only the Privy embedded Solana wallet is used for application signing.
- The frontend never chooses wheel outcomes, calculates eligibility/streaks, verifies reports, or changes network namespaces.
- A transaction is broadcast at most once. After a signature exists, recovery uses that signature and never blindly rebuilds or resends it.
- `/api/internal/reconcile` is scheduler-only and must never be called by frontend code.
- Faucet acquisition is user-operated through external sites; the application does not request faucet assets.
