BEGIN;

ALTER TABLE deposits ADD COLUMN IF NOT EXISTS network_profile TEXT;
UPDATE deposits SET network_profile = 'mainnet' WHERE network_profile IS NULL;
ALTER TABLE deposits ALTER COLUMN network_profile SET NOT NULL;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_pkey;
ALTER TABLE deposits ADD CONSTRAINT deposits_pkey PRIMARY KEY (network_profile, signature);
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_network_profile_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_network_profile_check CHECK (network_profile IN ('mainnet', 'devnet'));

ALTER TABLE streaks ADD COLUMN IF NOT EXISTS network_profile TEXT;
UPDATE streaks SET network_profile = 'mainnet' WHERE network_profile IS NULL;
ALTER TABLE streaks ALTER COLUMN network_profile SET NOT NULL;
ALTER TABLE streaks DROP CONSTRAINT IF EXISTS streaks_pkey;
ALTER TABLE streaks ADD CONSTRAINT streaks_pkey PRIMARY KEY (network_profile, wallet_address);
ALTER TABLE streaks DROP CONSTRAINT IF EXISTS streaks_network_profile_check;
ALTER TABLE streaks ADD CONSTRAINT streaks_network_profile_check CHECK (network_profile IN ('mainnet', 'devnet'));

ALTER TABLE spins ADD COLUMN IF NOT EXISTS network_profile TEXT;
UPDATE spins SET network_profile = 'mainnet' WHERE network_profile IS NULL;
ALTER TABLE spins ALTER COLUMN network_profile SET NOT NULL;
ALTER TABLE spins DROP CONSTRAINT IF EXISTS spins_wallet_address_spin_day_key;
DO $migration$
DECLARE
  spins_table REGCLASS := 'public.spins'::regclass;
  expected_columns SMALLINT[];
  named_constraint RECORD;
  named_index RECORD;
  existing_constraint RECORD;
  existing_index RECORD;
BEGIN
  SELECT array_agg(attnum::smallint ORDER BY array_position(
    ARRAY['network_profile', 'wallet_address', 'spin_day']::text[], attname
  ))
  INTO expected_columns
  FROM pg_attribute
  WHERE attrelid = spins_table
    AND attname = ANY(ARRAY['network_profile', 'wallet_address', 'spin_day']::text[])
    AND NOT attisdropped;

  IF cardinality(expected_columns) <> 3 THEN
    RAISE EXCEPTION 'spins uniqueness migration: required columns are missing';
  END IF;

  SELECT c.contype, c.conrelid, c.conkey, c.conindid
  INTO named_constraint
  FROM pg_constraint c
  WHERE c.conname = 'spins_network_profile_wallet_day_key'
    AND c.connamespace = 'public'::regnamespace;

  IF FOUND THEN
    IF named_constraint.contype <> 'u'
       OR named_constraint.conrelid <> spins_table
       OR named_constraint.conkey <> expected_columns
       OR NOT EXISTS (
         SELECT 1 FROM pg_index i
         WHERE i.indexrelid = named_constraint.conindid
           AND i.indisunique AND i.indisvalid
           AND i.indpred IS NULL AND i.indexprs IS NULL
       ) THEN
      RAISE EXCEPTION
        'spins uniqueness migration: constraint spins_network_profile_wallet_day_key has an unexpected definition';
    END IF;
    RETURN;
  END IF;

  SELECT i.indexrelid, i.indrelid, i.indisunique, i.indisvalid,
         i.indpred, i.indexprs, i.indnkeyatts, i.indnatts,
         ARRAY(SELECT unnest(i.indkey::smallint[])) AS columns
  INTO named_index
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  WHERE ns.nspname = 'public'
    AND idx.relname = 'spins_network_profile_wallet_day_key';

  IF FOUND THEN
    IF named_index.indrelid <> spins_table
       OR NOT named_index.indisunique OR NOT named_index.indisvalid
       OR named_index.indpred IS NOT NULL OR named_index.indexprs IS NOT NULL
       OR named_index.indnkeyatts <> 3 OR named_index.indnatts <> 3
       OR named_index.columns <> expected_columns THEN
      RAISE EXCEPTION
        'spins uniqueness migration: index spins_network_profile_wallet_day_key has an unexpected definition';
    END IF;
    ALTER TABLE public.spins
      ADD CONSTRAINT spins_network_profile_wallet_day_key
      UNIQUE USING INDEX spins_network_profile_wallet_day_key;
    RETURN;
  END IF;

  IF to_regclass('public.spins_network_profile_wallet_day_key') IS NOT NULL THEN
    RAISE EXCEPTION
      'spins uniqueness migration: object spins_network_profile_wallet_day_key exists but is not a valid unique index';
  END IF;

  SELECT c.oid
  INTO existing_constraint
  FROM pg_constraint c
  WHERE c.conrelid = spins_table
    AND c.contype = 'u'
    AND c.conkey = expected_columns
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  SELECT i.indexrelid, quote_ident(ns.nspname) || '.' || quote_ident(idx.relname) AS qualified_name
  INTO existing_index
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid
  WHERE i.indrelid = spins_table
    AND i.indisunique AND i.indisvalid
    AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts = 3 AND i.indnatts = 3
    AND ARRAY(SELECT unnest(i.indkey::smallint[])) = expected_columns
    AND c.oid IS NULL
  LIMIT 1;
  IF FOUND THEN
    EXECUTE format(
      'ALTER TABLE public.spins ADD CONSTRAINT spins_network_profile_wallet_day_key UNIQUE USING INDEX %s',
      existing_index.qualified_name
    );
    RETURN;
  END IF;

  ALTER TABLE public.spins
    ADD CONSTRAINT spins_network_profile_wallet_day_key
    UNIQUE (network_profile, wallet_address, spin_day);
END
$migration$;
ALTER TABLE spins DROP CONSTRAINT IF EXISTS spins_network_profile_check;
ALTER TABLE spins ADD CONSTRAINT spins_network_profile_check CHECK (network_profile IN ('mainnet', 'devnet'));

COMMIT;
