BEGIN;

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

COMMIT;
