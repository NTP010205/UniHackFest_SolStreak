BEGIN;

CREATE TABLE IF NOT EXISTS user_activity (
  network_profile TEXT NOT NULL
    CHECK (network_profile IN ('mainnet', 'devnet')),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network_profile, wallet_address)
);

CREATE INDEX IF NOT EXISTS user_activity_profile_last_seen_idx
  ON user_activity (network_profile, last_seen_at DESC);

-- Presence is written and read only by server-side routes through DATABASE_URL.
-- It is not a browser-facing Supabase Data API table.
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_activity FROM PUBLIC;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_activity'
      AND column_name = 'last_seen_at'
      AND data_type = 'timestamp with time zone'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'User activity migration: last_seen_at is missing or invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_activity'::regclass
      AND contype = 'p'
  ) THEN
    RAISE EXCEPTION 'User activity migration: primary key is missing';
  END IF;
END
$migration$;

COMMIT;
