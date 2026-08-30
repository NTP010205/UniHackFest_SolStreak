# SolStreak operational monitoring contract

The backend writes one-line JSON operational events to the hosting runtime's standard output. A future monitoring provider may ingest these lines without changing application code. Events contain exactly: `event`, ISO-8601 `timestamp`, `severity`, safe `requestId`, `routeKey`, `networkProfile`, coarse `status`, and integer `durationMs`. Never enrich events with identity tokens, cookies, full wallet/user identifiers, signatures, database or RPC endpoints, or raw exceptions.

## Event catalog and staging alerts

| Event | Suggested staging alert |
| --- | --- |
| `api.rate_limit.denied` | Dashboard/trend; alert when one route exceeds 50 events in 5 minutes. |
| `api.rate_limit.unavailable` | Alert on the first event; page if 3 occur in 5 minutes. |
| `database.unavailable` | Alert on the first event; page if 3 occur in 5 minutes. |
| `reconciliation.started` / `reconciliation.completed` | Alert if starts have no matching completion/failure within 30 seconds. |
| `reconciliation.failed` | Alert on any 503; page at 3 in 10 minutes. |
| `reconciliation.timeout` | Alert on any event; page at 2 consecutive invocations. |
| `reconciliation.stale_claim` | Alert above 3 per invocation or 10 in 15 minutes. |
| `rpc.request.failed` | Alert at 5 in 5 minutes per network/route. |
| `rpc.rate_limited` | Alert on any event; page at 3 in 5 minutes. |
| `rpc.genesis_mismatch` | Page immediately and disable the affected reconciliation profile. |

Thresholds are initial staging values and should be tuned from observed baselines. Correlate by `requestId`; do not use high-cardinality wallet, user, or signature labels.

## Maintenance

The authenticated reconciliation invocation runs rate-limit maintenance after reconciliation. It deletes at most 500 buckets per invocation where `window_start` is strictly older than 24 hours. The query orders by `window_start`, uses the expiration index, and claims candidates with `FOR UPDATE SKIP LOCKED`. Cleanup is idempotent and independent of the reconciliation database transaction; failure emits `database.unavailable` but does not replace a successful reconciliation summary. It never touches users, deposits, streaks, spins, or transaction submissions.
