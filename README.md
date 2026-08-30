# SOLSTREAK

> Build a consistent USDC saving habit on Solana, with verified streaks and cosmetic rewards.

SolStreak is a full-stack Next.js application combining Privy embedded Solana wallets, Jupiter Earn, verified transaction recovery, PostgreSQL-backed streak tracking, and a backend-controlled cosmetic badge wheel. Active development uses Solana Devnet and test assets with no financial value.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup from GitHub](#setup-from-github)
- [Setup from ZIP](#setup-from-zip)
- [Environment Configuration](#environment-configuration)
- [Development Commands](#development-commands)
- [Test Commands](#test-commands)
- [Devnet Testing](#devnet-testing)
- [Frontend Handoff](#frontend-handoff)
- [Backend Invariants](#backend-invariants)
- [Deployment Notes](#deployment-notes)
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

Badges are cosmetic only. They cannot be transferred or redeemed and provide no points, payout, token, NFT, discount, financial value, or streak boost.

## Tech Stack

- Next.js 16 App Router and React 19
- TypeScript and Tailwind CSS
- Privy React SDK
- Solana Kit/Web3.js and Jupiter Earn
- PostgreSQL via postgres.js
- Vitest

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

Copy `web_app/.env.local.example` to `web_app/.env.local`; never commit the resulting file. Client-visible values include the Privy app ID, active Solana profile, profile-specific HTTP/WSS RPC endpoints, and transaction gates. Server-only values cover PostgreSQL, server RPC, reconciliation authorization, and any server program override.

Both transaction gates are fail-closed and false by default:

```text
NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS=false
NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS=false
```

Never enable both profiles simultaneously. Browser-visible RPC credentials must use domain restrictions, rate limits, and quotas. See the example file for exact variable names; it contains no secrets.

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

## Deployment Notes

Deploy `web_app` as the application root. Configure environment variables in the hosting platform, apply reviewed migrations separately, and connect scheduler/monitoring only after their authorization and rehearsal gates pass. Do not expose server-only variables to client bundles.

Mainnet activation is intentionally separate from ordinary deployment and must follow security review and operational readiness checks.

## Current Readiness

Source tests, TypeScript, production build, Devnet transaction simulations/E2E flows, reconciliation harnesses, API perimeter, and cosmetic badge behavior have been developed and rehearsed in controlled environments. Production migration rollout, hosting configuration, external scheduler, monitoring provider, and Mainnet activation remain separate operational steps.

## Contributing

Create a focused branch, preserve backend and transaction invariants, avoid committing generated artifacts or secrets, and run source verification from `web_app/` before requesting review. Frontend contributors should also read the handoff and API contract documents before changing UI behavior.
