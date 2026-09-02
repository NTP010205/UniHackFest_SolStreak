# Backend readiness

## A. Backend code complete

- Privy identity-token authentication and linked Solana wallet binding.
- Explicit Mainnet/Devnet profiles, genesis verification, constants, and database namespaces.
- Transaction gates, single-broadcast lifecycle, durable submission recovery, expiration, unknown, and report-only retry states.
- On-chain deposit/withdraw verification and idempotent deposit/streak reporting.
- Reconciliation core, atomic claims, stale-claim recovery, backoff, scheduler-protected entry point, and maintenance cleanup.
- PostgreSQL-backed public API rate limiting and sanitized API errors/request IDs.
- Vendor-neutral structured operational events and monitoring contract.
- Cosmetic badge catalog, immutable award history, aggregate counts, canonical replay snapshots, and duplicate handling.
- Devnet-only welcome entitlement and existing streak entitlement semantics.
- Ordered migrations 002–005, unit/static coverage, and dedicated PostgreSQL integration harnesses.

These contracts are sufficient for frontend redesign without changing backend behavior.

## B. Operational work remaining

- Deploy a staging environment.
- Configure server-only database, RPC, Privy, and reconciliation credentials in the hosting platform.
- Configure an external scheduler for the internal reconciliation endpoint.
- Select a monitoring provider, ingest the documented events, and activate staging alert thresholds.
- Run staging soak tests for RPC throttling, database outages, reconciliation timeouts, stale claims, rate-limit cleanup, and concurrent badge replay.
- Add global SMS authentication support only if product requirements resume it; it is not part of the current gate.
- Perform a separate Mainnet activation/security review and supervised micro-test before changing either transaction flag.

Operational work does not block visual/component redesign, but it blocks a production launch. Devnet assets and cosmetic badges have no financial value. Neither transaction flag should be enabled as part of frontend work.
