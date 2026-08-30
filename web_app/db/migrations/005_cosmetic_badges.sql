BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_identity_pair_key
  ON users (privy_user_id, wallet_address);

DO $$
DECLARE expected_columns SMALLINT[];
BEGIN
  SELECT array_agg(attnum::smallint ORDER BY ordinality) INTO expected_columns
  FROM unnest(ARRAY['privy_user_id', 'wallet_address']) WITH ORDINALITY names(attname, ordinality)
  JOIN pg_attribute ON attrelid = 'public.users'::regclass AND pg_attribute.attname = names.attname;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class object
    JOIN pg_index index_catalog ON index_catalog.indexrelid = object.oid
    WHERE object.relnamespace = 'public'::regnamespace
      AND object.relname = 'users_identity_pair_key'
      AND index_catalog.indrelid = 'public.users'::regclass
      AND index_catalog.indisunique AND index_catalog.indisvalid
      AND index_catalog.indpred IS NULL
      AND index_catalog.indkey::text = array_to_string(expected_columns, ' ')
  ) THEN
    RAISE EXCEPTION 'cosmetic badge migration: users identity pair index has an unexpected definition';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS spin_entitlements (
  id BIGSERIAL PRIMARY KEY,
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  privy_user_id TEXT NOT NULL REFERENCES users(privy_user_id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  source TEXT NOT NULL CHECK (source IN ('welcome_demo', 'streak')),
  source_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  CONSTRAINT spin_entitlements_consumption_check CHECK (
    (status = 'available' AND consumed_at IS NULL) OR
    (status = 'consumed' AND consumed_at IS NOT NULL)
  ),
  CONSTRAINT spin_entitlements_welcome_devnet_check CHECK (
    source <> 'welcome_demo' OR network_profile = 'devnet'
  ),
  CONSTRAINT spin_entitlements_source_key UNIQUE
    (network_profile, privy_user_id, source, source_reference),
  CONSTRAINT spin_entitlements_profile_id_key UNIQUE (network_profile, id),
  CONSTRAINT spin_entitlements_identity_fk
    FOREIGN KEY (privy_user_id, wallet_address)
    REFERENCES users(privy_user_id, wallet_address)
);

CREATE UNIQUE INDEX IF NOT EXISTS spin_entitlements_welcome_user_key
  ON spin_entitlements (network_profile, privy_user_id, source)
  WHERE source = 'welcome_demo';
CREATE INDEX IF NOT EXISTS spin_entitlements_profile_collection_idx
  ON spin_entitlements (network_profile, privy_user_id, status, created_at);

ALTER TABLE spins ADD COLUMN IF NOT EXISTS privy_user_id TEXT REFERENCES users(privy_user_id);
ALTER TABLE spins ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE spins ADD COLUMN IF NOT EXISTS entitlement_id BIGINT REFERENCES spin_entitlements(id);
ALTER TABLE spins ADD COLUMN IF NOT EXISTS request_key TEXT;

INSERT INTO spin_entitlements (
  network_profile, privy_user_id, wallet_address, source, source_reference,
  status, created_at, consumed_at
)
SELECT spin.network_profile, app_user.privy_user_id, spin.wallet_address,
  'streak', spin.spin_day::text, 'consumed', spin.created_at, spin.created_at
FROM spins spin
JOIN users app_user ON app_user.wallet_address = spin.wallet_address
WHERE spin.entitlement_id IS NULL
ON CONFLICT (network_profile, privy_user_id, source, source_reference) DO NOTHING;

UPDATE spins spin
SET privy_user_id = app_user.privy_user_id,
    source = 'streak',
    entitlement_id = entitlement.id
FROM users app_user, spin_entitlements entitlement
WHERE spin.wallet_address = app_user.wallet_address
  AND entitlement.privy_user_id = app_user.privy_user_id
  AND entitlement.source = 'streak'
  AND entitlement.network_profile = spin.network_profile
  AND entitlement.source_reference = spin.spin_day::text
  AND spin.entitlement_id IS NULL;

UPDATE spins SET request_key = 'legacy:' || id::text WHERE request_key IS NULL;

ALTER TABLE spins ALTER COLUMN privy_user_id SET NOT NULL;
ALTER TABLE spins ALTER COLUMN source SET NOT NULL;
ALTER TABLE spins ALTER COLUMN entitlement_id SET NOT NULL;
ALTER TABLE spins ALTER COLUMN request_key SET NOT NULL;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
  WHERE conrelid = 'public.spins'::regclass AND conname = 'spins_source_check';
  IF definition IS NULL THEN
    ALTER TABLE spins ADD CONSTRAINT spins_source_check CHECK (source IN ('welcome_demo', 'streak'));
  ELSIF definition NOT LIKE '%welcome_demo%' OR definition NOT LIKE '%streak%' THEN
    RAISE EXCEPTION 'cosmetic badge migration: spins source constraint has an unexpected definition';
  END IF;
END $$;

ALTER TABLE spins DROP CONSTRAINT IF EXISTS spins_network_profile_wallet_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS spins_entitlement_key ON spins (network_profile, entitlement_id);
CREATE UNIQUE INDEX IF NOT EXISTS spins_profile_id_key ON spins (network_profile, id);
CREATE UNIQUE INDEX IF NOT EXISTS spins_request_key
  ON spins (network_profile, privy_user_id, request_key);

CREATE TABLE IF NOT EXISTS badge_awards (
  id BIGSERIAL PRIMARY KEY,
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  privy_user_id TEXT NOT NULL REFERENCES users(privy_user_id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  spin_id BIGINT NOT NULL,
  entitlement_id BIGINT NOT NULL,
  badge_code TEXT NOT NULL CHECK (badge_code IN ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT')),
  catalog_version INTEGER NOT NULL CHECK (catalog_version > 0),
  is_new_badge BOOLEAN NOT NULL,
  award_count_snapshot INTEGER NOT NULL CHECK (award_count_snapshot > 0),
  remaining_spins_snapshot INTEGER NOT NULL CHECK (remaining_spins_snapshot >= 0),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT badge_awards_profile_spin_key UNIQUE (network_profile, spin_id),
  CONSTRAINT badge_awards_profile_entitlement_key UNIQUE (network_profile, entitlement_id),
  CONSTRAINT badge_awards_spin_fk FOREIGN KEY (network_profile, spin_id)
    REFERENCES spins(network_profile, id),
  CONSTRAINT badge_awards_entitlement_fk FOREIGN KEY (network_profile, entitlement_id)
    REFERENCES spin_entitlements(network_profile, id),
  CONSTRAINT badge_awards_identity_fk
    FOREIGN KEY (privy_user_id, wallet_address)
    REFERENCES users(privy_user_id, wallet_address)
);
ALTER TABLE badge_awards ADD COLUMN IF NOT EXISTS award_count_snapshot INTEGER;
ALTER TABLE badge_awards ADD COLUMN IF NOT EXISTS remaining_spins_snapshot INTEGER;
CREATE INDEX IF NOT EXISTS badge_awards_profile_history_idx
  ON badge_awards (network_profile, privy_user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS user_badges (
  network_profile TEXT NOT NULL CHECK (network_profile IN ('mainnet', 'devnet')),
  privy_user_id TEXT NOT NULL REFERENCES users(privy_user_id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  badge_code TEXT NOT NULL CHECK (badge_code IN ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT')),
  first_earned_at TIMESTAMPTZ NOT NULL,
  last_earned_at TIMESTAMPTZ NOT NULL,
  award_count INTEGER NOT NULL CHECK (award_count > 0),
  PRIMARY KEY (network_profile, privy_user_id, badge_code),
  CONSTRAINT user_badges_time_order_check CHECK (last_earned_at >= first_earned_at),
  CONSTRAINT user_badges_identity_fk
    FOREIGN KEY (privy_user_id, wallet_address)
    REFERENCES users(privy_user_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS user_badges_profile_collection_idx
  ON user_badges (network_profile, privy_user_id, first_earned_at);

WITH legacy_awards AS (
  SELECT spin.network_profile, spin.privy_user_id, spin.wallet_address,
    spin.id AS spin_id, spin.entitlement_id,
    CASE spin.prize_id
      WHEN 'badge_bronze' THEN 'BRONZE'
      WHEN 'badge_silver' THEN 'SILVER'
      WHEN 'badge_flame' THEN 'GOLD'
      WHEN 'discount_fee' THEN 'BRONZE'
      WHEN 'badge_gold' THEN 'GOLD'
      WHEN 'streak_boost' THEN 'DIAMOND'
      WHEN 'badge_diamond' THEN 'DIAMOND'
      WHEN 'jackpot_usdc' THEN 'JACKPOT'
      ELSE NULL
    END AS badge_code,
    spin.created_at AS awarded_at,
    row_number() OVER (
      PARTITION BY spin.network_profile, spin.privy_user_id,
        CASE spin.prize_id
          WHEN 'badge_bronze' THEN 'BRONZE' WHEN 'discount_fee' THEN 'BRONZE'
          WHEN 'badge_silver' THEN 'SILVER'
          WHEN 'badge_flame' THEN 'GOLD' WHEN 'badge_gold' THEN 'GOLD'
          WHEN 'streak_boost' THEN 'DIAMOND' WHEN 'badge_diamond' THEN 'DIAMOND'
          WHEN 'jackpot_usdc' THEN 'JACKPOT' ELSE NULL END
      ORDER BY spin.created_at, spin.id
    ) = 1 AS is_new_badge,
    row_number() OVER (
      PARTITION BY spin.network_profile, spin.privy_user_id,
        CASE spin.prize_id
          WHEN 'badge_bronze' THEN 'BRONZE' WHEN 'discount_fee' THEN 'BRONZE'
          WHEN 'badge_silver' THEN 'SILVER'
          WHEN 'badge_flame' THEN 'GOLD' WHEN 'badge_gold' THEN 'GOLD'
          WHEN 'streak_boost' THEN 'DIAMOND' WHEN 'badge_diamond' THEN 'DIAMOND'
          WHEN 'jackpot_usdc' THEN 'JACKPOT' ELSE NULL END
      ORDER BY spin.created_at, spin.id
    )::int AS award_count_snapshot
  FROM spins spin
)
INSERT INTO badge_awards (
  network_profile, privy_user_id, wallet_address, spin_id, entitlement_id,
  badge_code, catalog_version, is_new_badge, award_count_snapshot,
  remaining_spins_snapshot, awarded_at
)
SELECT network_profile, privy_user_id, wallet_address, spin_id, entitlement_id,
  badge_code, 1, is_new_badge, award_count_snapshot, 0, awarded_at
FROM legacy_awards WHERE badge_code IS NOT NULL
ON CONFLICT (network_profile, spin_id) DO NOTHING;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY network_profile, privy_user_id, badge_code
    ORDER BY awarded_at, id
  )::int AS award_count_snapshot
  FROM badge_awards
)
UPDATE badge_awards award
SET award_count_snapshot = ranked.award_count_snapshot
FROM ranked
WHERE award.id = ranked.id AND award.award_count_snapshot IS NULL;
UPDATE badge_awards SET remaining_spins_snapshot = 0
WHERE remaining_spins_snapshot IS NULL;
ALTER TABLE badge_awards ALTER COLUMN award_count_snapshot SET NOT NULL;
ALTER TABLE badge_awards ALTER COLUMN remaining_spins_snapshot SET NOT NULL;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
  WHERE conrelid = 'public.badge_awards'::regclass
    AND conname = 'badge_awards_award_count_snapshot_check';
  IF definition IS NULL THEN
    ALTER TABLE badge_awards ADD CONSTRAINT badge_awards_award_count_snapshot_check
      CHECK (award_count_snapshot > 0);
  ELSIF definition NOT LIKE '%award_count_snapshot%' OR definition NOT LIKE '%> 0%' THEN
    RAISE EXCEPTION 'cosmetic badge migration: award count snapshot constraint has an unexpected definition';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
  WHERE conrelid = 'public.badge_awards'::regclass
    AND conname = 'badge_awards_remaining_spins_snapshot_check';
  IF definition IS NULL THEN
    ALTER TABLE badge_awards ADD CONSTRAINT badge_awards_remaining_spins_snapshot_check
      CHECK (remaining_spins_snapshot >= 0);
  ELSIF definition NOT LIKE '%remaining_spins_snapshot%' OR definition NOT LIKE '%>= 0%' THEN
    RAISE EXCEPTION 'cosmetic badge migration: remaining spins snapshot constraint has an unexpected definition';
  END IF;
END $$;

INSERT INTO user_badges (
  network_profile, privy_user_id, wallet_address, badge_code,
  first_earned_at, last_earned_at, award_count
)
SELECT network_profile, privy_user_id, min(wallet_address), badge_code,
  min(awarded_at), max(awarded_at), count(*)::int
FROM badge_awards
GROUP BY network_profile, privy_user_id, badge_code
ON CONFLICT (network_profile, privy_user_id, badge_code)
DO UPDATE SET first_earned_at = LEAST(user_badges.first_earned_at, EXCLUDED.first_earned_at),
  last_earned_at = GREATEST(user_badges.last_earned_at, EXCLUDED.last_earned_at),
  award_count = EXCLUDED.award_count;

DO $$
DECLARE
  constraint_oid OID;
  expression TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM spin_entitlements child
    LEFT JOIN users owner ON owner.privy_user_id = child.privy_user_id
      AND owner.wallet_address = child.wallet_address
    WHERE owner.privy_user_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM spins child
    LEFT JOIN users owner ON owner.privy_user_id = child.privy_user_id
      AND owner.wallet_address = child.wallet_address
    WHERE owner.privy_user_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM badge_awards child
    LEFT JOIN users owner ON owner.privy_user_id = child.privy_user_id
      AND owner.wallet_address = child.wallet_address
    WHERE owner.privy_user_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM user_badges child
    LEFT JOIN users owner ON owner.privy_user_id = child.privy_user_id
      AND owner.wallet_address = child.wallet_address
    WHERE owner.privy_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'cosmetic badge migration: legacy Privy user and wallet ownership mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM spins spin
    JOIN spin_entitlements entitlement ON entitlement.id = spin.entitlement_id
    WHERE spin.network_profile <> entitlement.network_profile
  ) THEN
    RAISE EXCEPTION 'cosmetic badge migration: legacy spin and entitlement network profile mismatch';
  END IF;

  SELECT oid, lower(regexp_replace(pg_get_expr(conbin, conrelid), '\s+', '', 'g'))
    INTO constraint_oid, expression
  FROM pg_constraint
  WHERE conrelid = 'public.spin_entitlements'::regclass
    AND conname = 'spin_entitlements_welcome_devnet_check';
  IF constraint_oid IS NULL THEN
    ALTER TABLE spin_entitlements
      ADD CONSTRAINT spin_entitlements_welcome_devnet_check
      CHECK (source <> 'welcome_demo' OR network_profile = 'devnet');
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE oid = constraint_oid AND contype = 'c' AND convalidated
      AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'source'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'network_profile')
      ]::smallint[]
  ) OR expression NOT LIKE '%source<>''welcome_demo''::text%'
       OR expression NOT LIKE '%or%network_profile=''devnet''::text%' THEN
    RAISE EXCEPTION 'cosmetic badge migration: welcome Devnet-only constraint has an unexpected definition';
  END IF;

  SELECT oid INTO constraint_oid FROM pg_constraint
  WHERE conrelid = 'public.spin_entitlements'::regclass
    AND conname = 'spin_entitlements_identity_fk';
  IF constraint_oid IS NULL THEN
    ALTER TABLE spin_entitlements ADD CONSTRAINT spin_entitlements_identity_fk
      FOREIGN KEY (privy_user_id, wallet_address)
      REFERENCES users(privy_user_id, wallet_address);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE oid = constraint_oid AND contype = 'f' AND convalidated
      AND confrelid = 'public.users'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'wallet_address')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'wallet_address')
      ]::smallint[]
  ) THEN RAISE EXCEPTION 'cosmetic badge migration: spin entitlement identity FK has an unexpected definition';
  END IF;

  SELECT oid INTO constraint_oid FROM pg_constraint
  WHERE conrelid = 'public.spins'::regclass AND conname = 'spins_identity_fk';
  IF constraint_oid IS NULL THEN
    ALTER TABLE spins ADD CONSTRAINT spins_identity_fk
      FOREIGN KEY (privy_user_id, wallet_address)
      REFERENCES users(privy_user_id, wallet_address);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE oid = constraint_oid AND contype = 'f' AND convalidated
      AND confrelid = 'public.users'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'wallet_address')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'wallet_address')
      ]::smallint[]
  ) THEN RAISE EXCEPTION 'cosmetic badge migration: spin identity FK has an unexpected definition';
  END IF;

  SELECT oid INTO constraint_oid FROM pg_constraint
  WHERE conrelid = 'public.spins'::regclass AND conname = 'spins_profile_entitlement_fk';
  IF constraint_oid IS NULL THEN
    ALTER TABLE spins ADD CONSTRAINT spins_profile_entitlement_fk
      FOREIGN KEY (network_profile, entitlement_id)
      REFERENCES spin_entitlements(network_profile, id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE oid = constraint_oid AND contype = 'f' AND convalidated
      AND confrelid = 'public.spin_entitlements'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'network_profile'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'entitlement_id')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'network_profile'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'id')
      ]::smallint[]
  ) THEN RAISE EXCEPTION 'cosmetic badge migration: spin profile entitlement FK has an unexpected definition';
  END IF;

  SELECT oid INTO constraint_oid FROM pg_constraint
  WHERE conrelid = 'public.badge_awards'::regclass AND conname = 'badge_awards_identity_fk';
  IF constraint_oid IS NULL THEN
    ALTER TABLE badge_awards ADD CONSTRAINT badge_awards_identity_fk
      FOREIGN KEY (privy_user_id, wallet_address)
      REFERENCES users(privy_user_id, wallet_address);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE oid = constraint_oid AND contype = 'f' AND convalidated
      AND confrelid = 'public.users'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'wallet_address')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'wallet_address')
      ]::smallint[]
  ) THEN RAISE EXCEPTION 'cosmetic badge migration: badge award identity FK has an unexpected definition';
  END IF;

  SELECT oid INTO constraint_oid FROM pg_constraint
  WHERE conrelid = 'public.user_badges'::regclass AND conname = 'user_badges_identity_fk';
  IF constraint_oid IS NULL THEN
    ALTER TABLE user_badges ADD CONSTRAINT user_badges_identity_fk
      FOREIGN KEY (privy_user_id, wallet_address)
      REFERENCES users(privy_user_id, wallet_address);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE oid = constraint_oid AND contype = 'f' AND convalidated
      AND confrelid = 'public.users'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'wallet_address')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'privy_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'wallet_address')
      ]::smallint[]
  ) THEN RAISE EXCEPTION 'cosmetic badge migration: user badge identity FK has an unexpected definition';
  END IF;
END $$;

DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(required.name, ', ' ORDER BY required.name) INTO missing
  FROM (VALUES
    ('spin_entitlements'), ('badge_awards'), ('user_badges')
  ) AS required(name)
  WHERE to_regclass('public.' || required.name) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'cosmetic badge migration: required relations missing: %', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'spin_entitlements'
      AND indexname = 'spin_entitlements_welcome_user_key'
      AND indexdef LIKE '%UNIQUE INDEX%'
      AND indexdef LIKE '%(network_profile, privy_user_id, source)%'
      AND indexdef LIKE '%welcome_demo%'
  ) THEN
    RAISE EXCEPTION 'cosmetic badge migration: welcome entitlement uniqueness has an unexpected definition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.badge_awards'::regclass
      AND conname = 'badge_awards_profile_spin_key' AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'cosmetic badge migration: badge award spin uniqueness has an unexpected definition';
  END IF;
END $$;

COMMIT;
