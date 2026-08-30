BEGIN;

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

COMMIT;

-- Cleanup strategy (run from a controlled maintenance job after rollout):
-- DELETE FROM api_rate_limit_buckets WHERE window_start < now() - interval '24 hours';
