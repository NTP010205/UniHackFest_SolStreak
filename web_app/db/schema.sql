CREATE TABLE IF NOT EXISTS users (
  privy_user_id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deposits (
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  signature TEXT NOT NULL,
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  amount_base_units BIGINT NOT NULL CHECK (amount_base_units > 0),
  block_time TIMESTAMPTZ NOT NULL,
  streak_day DATE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network_profile, signature)
);
CREATE INDEX IF NOT EXISTS deposits_wallet_day_idx ON deposits (wallet_address, streak_day);
CREATE INDEX IF NOT EXISTS deposits_profile_wallet_day_idx ON deposits (network_profile, wallet_address, streak_day);

CREATE TABLE IF NOT EXISTS streaks (
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_counted_day DATE,
  PRIMARY KEY (network_profile, wallet_address)
);

CREATE TABLE IF NOT EXISTS spins (
  id BIGSERIAL PRIMARY KEY,
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  spin_day DATE NOT NULL,
  prize_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network_profile, wallet_address, spin_day)
);

CREATE TABLE IF NOT EXISTS transaction_submissions (
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  signature TEXT NOT NULL,
  privy_user_id TEXT NOT NULL REFERENCES users(privy_user_id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  transaction_kind TEXT NOT NULL CHECK (transaction_kind IN ('deposit', 'withdraw')),
  blockhash TEXT NOT NULL,
  last_valid_block_height BIGINT NOT NULL CHECK (last_valid_block_height > 0),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN (
    'submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending',
    'processing', 'reconciled', 'failed', 'expired'
  )),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code TEXT,
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network_profile, signature)
);
CREATE INDEX IF NOT EXISTS transaction_submissions_user_unresolved_idx
  ON transaction_submissions (privy_user_id, network_profile, lifecycle_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS transaction_submissions_reconcile_idx
  ON transaction_submissions (network_profile, lifecycle_status, next_attempt_at, submitted_at);

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  route_key TEXT NOT NULL,
  privy_user_id TEXT NOT NULL,
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_key, privy_user_id, network_profile, window_start)
);
CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_expiration_idx
  ON api_rate_limit_buckets (window_start);

-- Cosmetic badge ledger is created and validated by migration 005.
