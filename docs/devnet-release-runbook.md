# SolStreak Devnet release runbook

This runbook promotes a reviewed Devnet build through database rehearsal, local acceptance, Git, and Render. Never print or commit database URLs, Privy identity tokens, RPC credentials, admin allowlists, or reconciliation secrets.

## 1. Source gate

From `web_app`:

```bash
npm ci
npm test
npx --no-install tsc --noEmit
npm run build -- --webpack
git diff --check
```

Keep `.env.local`, `.next`, `node_modules`, and `tsconfig.tsbuildinfo` ignored and unstaged.

## 2. Rehearsal database first

Read `SOLSTREAK_REHEARSAL_DATABASE_URL` from `.env.local` into a shell variable without printing it. Confirm it differs from `DATABASE_URL`, then run the project migration runner with the rehearsal URL supplied as the process-level `DATABASE_URL`. Node's `--env-file` preserves an already-defined process variable.

After migration 007, verify on rehearsal:

```sql
select
  to_regclass('public.user_activity') is not null as table_exists,
  (select relrowsecurity from pg_class where oid = 'public.user_activity'::regclass) as rls_enabled,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'user_activity_profile_last_seen_idx'
  ) as activity_index_exists;
```

Expected: all three values are `true`. Migration 007 is transactional, rerunnable, creates no synthetic user activity, and does not delete application rows.

## 3. Main database promotion

Only after rehearsal verification and a backup/checkpoint:

1. Run the same migration runner against the normal `DATABASE_URL`.
2. Run the same read-only verification query.
3. Start the app normally.
4. Sign in as a normal test user and keep any page open for at least 30 seconds.
5. Sign in as Admin in a second browser profile.
6. Confirm the user becomes **Online now** and moves to the top within 15 seconds.
7. Close the normal user's page and confirm Online clears after approximately 75–90 seconds.
8. Confirm Deposit, Withdraw, message verification, wheel, badges, logout/login, and Admin authorization still work.

## 4. Git gate

Create a release branch from the current reviewed `main`. Review every staged path and scan staged content for configured credentials before committing. Push the branch, open a pull request, and merge only after the checks and manual Devnet acceptance pass. Keep the previous `main` commit and the last local archive as rollback points until Render acceptance completes.

## 5. Render web service

Deploy `web_app` as a **Node Web Service**, not a static site.

- Root Directory: `web_app`
- Build Command: `npm ci && npm run build -- --webpack`
- Start Command: `npm start`
- Health Check Path: `/`
- Auto-Deploy: disable for the first controlled release; enable later if desired

Copy environment variables from the private `.env.local` into Render's Environment page. Do not upload or commit `.env.local`. Public variables keep the `NEXT_PUBLIC_` prefix; database URLs, RPC server values, admin allowlists, and reconciliation secrets remain server-only.

Use the existing Supabase PostgreSQL database for durable state. Render's local filesystem is ephemeral and must not hold application state. A free Render web service can sleep after inactivity, so the first request after an idle period can take longer; this does not change Supabase data.

## 6. Post-deploy acceptance and rollback

Repeat the two-account presence test and the full Devnet smoke test on the Render URL. Check Render logs only for sanitized request IDs and operational events. If acceptance fails, roll back the Render deploy or redeploy the previous known-good commit; do not reverse migration 007 by dropping the table during an incident.

## 7. Local cleanup gate

Inventory candidates first. Safe candidates usually include old `.next` build output, reproducible `node_modules`, duplicate downloaded archives, and explicitly named obsolete extracted update folders. Never delete the repository, `.git`, `.env.local`, source, migrations, design assets, or the newest verified rollback archive. Generate an exact candidate list and approve each path before any deletion command is run.
