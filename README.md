# SOLSTREAK

> Build a consistent USDC saving habit on Solana, with verified streaks and cosmetic rewards.

SolStreak is a full-stack Next.js application combining Privy embedded Solana wallets, Jupiter Earn, verified transaction recovery, PostgreSQL-backed streak tracking, and a backend-controlled cosmetic badge wheel. Active development uses Solana Devnet and test assets with no financial value.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How SolStreak Works](#how-solstreak-works)
- [Infrastructure](#infrastructure)
- [Database Model](#database-model)
- [Project Structure](#project-structure)
- [Setup from GitHub](#setup-from-github)
- [Setup from ZIP](#setup-from-zip)
- [Environment Configuration](#environment-configuration)
- [Development Commands](#development-commands)
- [Test Commands](#test-commands)
- [Devnet Testing](#devnet-testing)
- [Frontend Handoff](#frontend-handoff)
- [Backend Invariants](#backend-invariants)
- [Deploying to Render](#deploying-to-render)
- [Current Readiness](#current-readiness)
- [Contributing](#contributing)

## Overview

`web_app` is the independent Next.js full-stack application—not a frontend-only package. UI and React hooks live alongside authenticated API routes, domain logic, migrations, and operational scripts. Repository-level documentation and design source assets remain outside the deployable app.

The current active environment is Devnet. Devnet SOL and Circle Devnet USDC are test assets. The application does not request faucet funds; each tester obtains them directly from the Solana and Circle faucets.

## Features

- Privy authentication with a stable embedded Solana wallet.
- Read-only SOL and Circle USDC funding readiness.
- Safety-gated Jupiter Earn deposit and withdraw lifecycle.
- Durable transaction submission recovery and reconciliation.
- Backend-verified deposit streaks isolated by network profile.
- One-time Devnet welcome spin and streak-based spin entitlements.
- Cosmetic badges: `BRONZE`, `SILVER`, `GOLD`, `DIAMOND`, and `JACKPOT`.
- PostgreSQL-backed API rate limiting and structured operational events.
- A Devnet-only Admin Lab for persisted cosmetic test spins, self streak demos, aggregate metrics, and read-only recent-user presence.

Badges are cosmetic only. They cannot be transferred or redeemed and provide no points, payout, token, NFT, discount, financial value, or streak boost.

## How SolStreak Works

1. A user signs in with email or SMS through Privy. Privy creates or restores the user's embedded Solana wallet; SolStreak never asks for a seed phrase.
2. The user signs a verification message for the active browser session before Deposit or Withdraw is enabled. The backend also verifies the Privy identity token and that the requested wallet belongs to that identity.
3. The browser reads Devnet SOL, Circle Devnet USDC, and the Jupiter position through the configured Solana RPC endpoints.
4. Deposit and Withdraw transactions are constructed for the active Devnet Jupiter Earn market and signed by the user's embedded wallet. SolStreak does not custody the user's signing key.
5. A submitted signature is recorded in PostgreSQL before recovery or reconciliation continues. The backend verifies the confirmed on-chain instruction before a deposit can update a streak.
6. A verified deposit updates the streak and creates a spin entitlement. The backend chooses and persists the cosmetic badge result; the wheel only animates that saved result.
7. Authenticated clients send a lightweight activity heartbeat. The Devnet Admin Lab shows recent users, online state, streaks, deposits, and aggregate metrics without exposing email addresses or full Privy identifiers, and without granting the administrator control over another user's account.

Devnet SOL and Devnet USDC have no financial value. Mainnet transactions remain disabled and are outside the current demo release.

## Infrastructure

| Layer | Service or technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS | Landing page, dashboard, server-rendered application shell, and API routes |
| Authentication and wallet | Privy React SDK | Email/SMS login, identity tokens, and user-owned embedded Solana wallets |
| Blockchain | Solana Devnet | Test SOL fees, transaction settlement, and on-chain verification |
| RPC | Configurable Solana HTTP/WSS provider | Browser balance reads, transaction submission, and server-side verification |
| Savings integration | Jupiter Earn/Lend Devnet market | Non-custodial test-USDC deposit and withdrawal instructions |
| Test asset | Circle Devnet USDC | Demo deposit asset with no financial value |
| Persistent data | Supabase PostgreSQL, accessed server-side with `postgres.js` | Users, verified deposits, streaks, transaction recovery, rate limits, spins, badges, and activity presence |
| Authentication boundary | Privy identity token plus linked-wallet verification | Prevents one signed-in identity from operating another wallet |
| Hosting | Render Node Web Service | Runs the full Next.js application and API routes from `web_app` |
| Explorer | Solana Explorer on Devnet | Public transaction inspection |
| Verification | Vitest, TypeScript, Next.js webpack production build | Regression, type, route, and production-build checks |

Supabase is the durable system of record. Render's filesystem is not used for application state, and browser code never receives `DATABASE_URL`, admin allowlists, or reconciliation secrets.

## Database Model

| Table | Purpose |
| --- | --- |
| `users` | Stable Privy-user-to-wallet binding |
| `deposits` | Backend-verified on-chain deposits |
| `streaks` | Current and longest streak per network profile and wallet |
| `transaction_submissions` | At-most-once submission lifecycle and reconciliation state |
| `api_rate_limit_buckets` | Shared PostgreSQL-backed API rate limiting |
| `spin_entitlements` | Persisted rights to perform a cosmetic spin |
| `spins` | Idempotent, backend-selected spin outcomes |
| `badge_awards` | Immutable badge award history and snapshots |
| `user_badges` | Aggregated badge inventory counts |
| `user_activity` | Authenticated heartbeat used by the read-only Devnet Admin Lab |

Schema changes live in `web_app/db/migrations` and are applied with the project's ordered migration runner. Rehearsal and application databases must use different URLs; every migration is tested on rehearsal before promotion.

## Project Structure

```text
UniHackFest_SolStreak/
├── web_app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/          # Backend API routes
│   │   │   └── dashboard/    # Frontend dashboard
│   │   ├── components/       # Frontend UI
│   │   ├── hooks/            # React hooks
│   │   └── lib/              # Domain, backend, and shared logic
│   ├── db/                    # Schema, migrations, and database tests
│   ├── scripts/               # Migration/report utilities
│   ├── package.json
│   └── Next.js, TypeScript, Tailwind, and Vitest configs
├── design_assets/
│   ├── badges/
│   ├── logo/
│   └── wheel/
├── docs/
├── .gitignore
├── .gitattributes
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

Frontend paths are `web_app/src/app`, `web_app/src/components`, and `web_app/src/hooks`. Backend paths are `web_app/src/app/api`, `web_app/src/lib`, `web_app/db`, and `web_app/scripts`.

## Setup from GitHub

Requirements: Node.js 20.9 or newer and npm.

```bash
git clone https://github.com/NTP010205/UniHackFest_SolStreak.git
cd UniHackFest_SolStreak/web_app
npm ci
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

## Setup from ZIP

The shared ZIP must not contain `node_modules`, `.next`, or `.env.local`. Extract the entire repository, open a terminal or WSL, then run:

```bash
cd UniHackFest_SolStreak/web_app
npm ci
cp .env.local.example .env.local
npm run dev
```

The project owner must provide suitable environment values separately. A frontend developer does not need to run migrations against the application database and should create a separate working branch. See [ZIP usage](docs/ZIP_USAGE.md) for Windows/WSL instructions and troubleshooting.

## Environment Configuration

Copy `web_app/.env.local.example` to `web_app/.env.local`; never commit the resulting file. Client-visible values include the Privy app ID, active Solana profile, profile-specific HTTP/WSS RPC endpoints, and transaction gates. Server-only values cover PostgreSQL, server RPC, reconciliation authorization, and any server program override. `SOLSTREAK_ADMIN_PRIVY_USER_IDS` is a comma-separated allowlist of exact Privy user IDs for the Devnet Admin Lab. Missing or empty means nobody is an admin; never expose this value through `NEXT_PUBLIC_*`.

`SOLSTREAK_ADMIN_WALLET_ADDRESSES` is an optional second server-side allowlist. When configured, the caller must satisfy the Privy identity check and prove ownership of a linked allowlisted wallet. It does not grant transaction authority over other users.

Both transaction gates are fail-closed and false by default:

```text
NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS=false
NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS=false
```

Never enable both profiles simultaneously. The hosted Devnet demo requires `NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS=true` only after the reviewed Devnet smoke test has passed; Mainnet stays `false`. Browser-visible RPC credentials must use domain restrictions, rate limits, and quotas. See the example file for exact variable names; it contains no secrets.

## Development Commands

Run all application commands from `web_app/`:

```bash
npm run dev
npm run build
npm run start
```

Database migration is an explicit backend operation. Do not run `npm run db:migrate` merely to work on frontend presentation, and never point rehearsal work at the application database.

## Test Commands

Source verification:

```bash
npm test
npx tsc --noEmit
npm run build
```

Optional PostgreSQL/RPC rehearsal harnesses require dedicated rehearsal variables and do not run under normal `npm test`:

```bash
npm run test:reconciliation:integration
npm run test:scheduler:integration
npm run test:api-perimeter:integration
npm run test:cosmetic-badges:integration
```

## Devnet Testing

The active development profile is Solana Devnet. Testers supply their own Devnet SOL and Circle Devnet USDC through the official faucets; SolStreak never requests faucet assets automatically. Devnet balances and yields are test infrastructure and have no financial value.

Deposit and withdraw remain disabled while `NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS=false`. Mainnet activation is a separate phase requiring security review, production RPC controls, migration rollout, monitoring, and a controlled micro-test.

## Frontend Handoff

- [Frontend architecture and invariants](docs/frontend-handoff.md)
- [Exact API contract](docs/api-contract.md)
- [Frontend state guide](docs/frontend-state-guide.md)
- [Backend readiness](docs/backend-readiness.md)
- [Design asset contract](design_assets/README.md)

Frontend work may change layout, typography, responsive behavior, artwork mapping, and animations. It must preserve wallet selection, safety gates, transaction states, API contracts, and backend authority.

## Backend Invariants

- Privy identity and linked embedded-wallet ownership are verified server-side.
- The active network profile is authoritative and Mainnet/Devnet records remain isolated.
- A signature is broadcast at most once; recovery never blindly rebuilds or resends it.
- Deposits are verified on-chain before streak state changes.
- Wheel eligibility and random badge selection are backend-controlled and idempotent.
- Badge codes are stable persisted identifiers; artwork is a frontend mapping.
- `/api/internal/reconcile` is server/scheduler-only.
- Secrets, cookies, raw transactions, full wallet identifiers, and RPC/database credentials must not be logged.

## Deploying to Render

The repository includes [`render.yaml`](render.yaml). Deploy it as a Render **Node Web Service**, not a Static Site, because the Next.js API routes, Privy verification, database access, admin authorization, and reconciliation logic must run on the server.

Render settings:

| Setting | Value |
| --- | --- |
| Root Directory | `web_app` |
| Build Command | `npm ci && npm run build -- --webpack` |
| Start Command | `npm start` |
| Health Check Path | `/` |
| Initial auto-deploy | Disabled until hosted acceptance passes |

Set these production variables in Render's private Environment page. Do not paste values into Git or `render.yaml`.

| Variable | Visibility | Devnet release value or purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Browser-visible | Production/deployment Privy application ID |
| `NEXT_PUBLIC_SOLANA_NETWORK_PROFILE` | Browser-visible | `devnet` |
| `NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS` | Browser-visible | `true` for the approved interactive demo |
| `NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS` | Browser-visible | `false` |
| `NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL` | Browser-visible | Domain-restricted Devnet HTTP RPC |
| `NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL` | Browser-visible | Domain-restricted Devnet WSS RPC |
| `SOLANA_DEVNET_RPC_URL` | Server-only | Devnet HTTP RPC used for authoritative verification |
| `DATABASE_URL` | Server-only | Supabase PostgreSQL connection string with SSL |
| `SOLSTREAK_ADMIN_PRIVY_USER_IDS` | Server-only | Comma-separated exact Privy admin IDs |
| `SOLSTREAK_ADMIN_WALLET_ADDRESSES` | Server-only | Optional comma-separated linked Solana admin wallets |
| `RECONCILIATION_SECRET` | Server-only | Strong random secret for the internal reconciliation endpoint |

Do not add `SOLSTREAK_REHEARSAL_DATABASE_URL`, fixture signatures, or rehearsal cron secrets to the production Render service. `NEXT_PUBLIC_*` variables are embedded during the build, so changing one requires a new deploy. Apply reviewed database migrations separately before deploying application code.

After Render assigns the public `https://…onrender.com` URL, add that exact origin to the Privy application's allowed origins and to the browser RPC key's domain allowlist. Then redeploy once and run the two-account Devnet acceptance test: login, message verification, Deposit, Withdraw, wheel, badge refresh, logout/login, Admin visibility, read-only user presence, and navigation.

Use the ordered [Devnet release runbook](docs/devnet-release-runbook.md) for rehearsal migration, main-database promotion, Git review, Render configuration, acceptance, rollback, and local-cleanup gates.

Mainnet activation is intentionally separate from ordinary deployment and must follow security review and operational readiness checks.

The Admin Lab is restricted to authenticated allowlisted users on Devnet. It never bypasses wallet funding, transaction flags, signing, on-chain verification, or Mainnet safety boundaries.

## Current Readiness

Source tests, TypeScript, production build, Devnet transaction simulations/E2E flows, reconciliation harnesses, API perimeter, cosmetic badges, and authenticated user presence have been developed and rehearsed in controlled environments. Render configuration and hosted acceptance remain release steps. External scheduler/monitoring integration and Mainnet activation remain separate future work.

## Contributing

Create a focused branch, preserve backend and transaction invariants, avoid committing generated artifacts or secrets, and run source verification from `web_app/` before requesting review. Frontend contributors should also read the handoff and API contract documents before changing UI behavior.
