BEGIN;

-- Migration 002 created wallet/day uniqueness and migration 005 removed one
-- historical name. Existing databases can still carry the same constraint
-- under any of these names (or another PostgreSQL-generated name):
--   spins_wallet_address_spin_day_key
--   spins_network_profile_wallet_day_key
--   spins_network_profile_wallet_address_spin_day_key
-- Admin Lab spins use request/entitlement identities instead, so remove only a
-- UNIQUE constraint whose catalog definition is exactly this three-column set.
DO $migration$
DECLARE
  spins_table REGCLASS := 'public.spins'::regclass;
  expected_columns SMALLINT[];
  legacy_constraint RECORD;
BEGIN
  SELECT array_agg(attribute.attnum::smallint ORDER BY names.ordinality)
  INTO expected_columns
  FROM unnest(ARRAY[
    'network_profile', 'wallet_address', 'spin_day'
  ]::text[]) WITH ORDINALITY names(attname, ordinality)
  JOIN pg_attribute attribute
    ON attribute.attrelid = spins_table
   AND attribute.attname = names.attname
   AND NOT attribute.attisdropped;

  IF cardinality(expected_columns) <> 3 THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: required spins wallet/day columns are missing';
  END IF;

  FOR legacy_constraint IN
    SELECT constraint_catalog.conname
    FROM pg_constraint constraint_catalog
    WHERE constraint_catalog.conrelid = spins_table
      AND constraint_catalog.contype = 'u'
      AND cardinality(constraint_catalog.conkey) = 3
      AND ARRAY(
        SELECT key_attribute
        FROM unnest(constraint_catalog.conkey) key_attribute
        ORDER BY key_attribute
      ) = ARRAY(
        SELECT expected_attribute
        FROM unnest(expected_columns) expected_attribute
        ORDER BY expected_attribute
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.spins DROP CONSTRAINT %I',
      legacy_constraint.conname
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_catalog
    WHERE constraint_catalog.conrelid = spins_table
      AND constraint_catalog.contype = 'u'
      AND cardinality(constraint_catalog.conkey) = 3
      AND ARRAY(
        SELECT key_attribute
        FROM unnest(constraint_catalog.conkey) key_attribute
        ORDER BY key_attribute
      ) = ARRAY(
        SELECT expected_attribute
        FROM unnest(expected_columns) expected_attribute
        ORDER BY expected_attribute
      )
  ) THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: spins wallet/day uniqueness remains after cleanup';
  END IF;
END
$migration$;

DO $$
DECLARE
  definition TEXT;
  source_attribute SMALLINT;
BEGIN
  SELECT attnum::smallint INTO source_attribute FROM pg_attribute
  WHERE attrelid = 'public.spin_entitlements'::regclass AND attname = 'source' AND NOT attisdropped;
  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g')) INTO definition
  FROM pg_constraint WHERE conrelid = 'public.spin_entitlements'::regclass
    AND conname = 'spin_entitlements_source_check' AND contype = 'c' AND convalidated
    AND conkey = ARRAY[source_attribute];
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: spin entitlement source constraint missing or invalid';
  ELSIF definition = 'check((source=any(array[''welcome_demo''::text,''streak''::text,''admin_test''::text])))' THEN
    NULL;
  ELSIF definition = 'check((source=any(array[''welcome_demo''::text,''streak''::text])))' THEN
    ALTER TABLE spin_entitlements DROP CONSTRAINT spin_entitlements_source_check;
    ALTER TABLE spin_entitlements ADD CONSTRAINT spin_entitlements_source_check
      CHECK (source IN ('welcome_demo', 'streak', 'admin_test'));
  ELSE
    RAISE EXCEPTION 'Devnet Admin Lab migration: spin entitlement source constraint has an unexpected definition';
  END IF;
END $$;

DO $$
DECLARE
  definition TEXT;
  source_attribute SMALLINT;
BEGIN
  SELECT attnum::smallint INTO source_attribute FROM pg_attribute
  WHERE attrelid = 'public.spins'::regclass AND attname = 'source' AND NOT attisdropped;
  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g')) INTO definition
  FROM pg_constraint WHERE conrelid = 'public.spins'::regclass
    AND conname = 'spins_source_check' AND contype = 'c' AND convalidated
    AND conkey = ARRAY[source_attribute];
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: spin source constraint missing or invalid';
  ELSIF definition = 'check((source=any(array[''welcome_demo''::text,''streak''::text,''admin_test''::text])))' THEN
    NULL;
  ELSIF definition = 'check((source=any(array[''welcome_demo''::text,''streak''::text])))' THEN
    ALTER TABLE spins DROP CONSTRAINT spins_source_check;
    ALTER TABLE spins ADD CONSTRAINT spins_source_check
      CHECK (source IN ('welcome_demo', 'streak', 'admin_test'));
  ELSE
    RAISE EXCEPTION 'Devnet Admin Lab migration: spin source constraint has an unexpected definition';
  END IF;
END $$;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g')) INTO definition
  FROM pg_constraint WHERE conrelid = 'public.spin_entitlements'::regclass
    AND conname = 'spin_entitlements_admin_test_devnet_check';
  IF definition IS NULL THEN
    ALTER TABLE spin_entitlements ADD CONSTRAINT spin_entitlements_admin_test_devnet_check
      CHECK (source <> 'admin_test' OR network_profile = 'devnet');
  ELSIF definition <> 'check(((source<>''admin_test''::text)or(network_profile=''devnet''::text)))' THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: entitlement Devnet-only constraint has an unexpected definition';
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g')) INTO definition
  FROM pg_constraint WHERE conrelid = 'public.spins'::regclass
    AND conname = 'spins_admin_test_devnet_check';
  IF definition IS NULL THEN
    ALTER TABLE spins ADD CONSTRAINT spins_admin_test_devnet_check
      CHECK (source <> 'admin_test' OR network_profile = 'devnet');
  ELSIF definition <> 'check(((source<>''admin_test''::text)or(network_profile=''devnet''::text)))' THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: spin Devnet-only constraint has an unexpected definition';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.spin_entitlements'::regclass
      AND conname = 'spin_entitlements_source_check' AND contype = 'c' AND convalidated
      AND pg_get_constraintdef(oid) LIKE '%admin_test%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.spins'::regclass
      AND conname = 'spins_source_check' AND contype = 'c' AND convalidated
      AND pg_get_constraintdef(oid) LIKE '%admin_test%'
  ) THEN
    RAISE EXCEPTION 'Devnet Admin Lab migration: admin_test source enforcement is incomplete';
  END IF;
END $$;

COMMIT;
