import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in .env.local');
}

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const networkProfiles = await readFile(new URL('../db/migrations/002_network_profiles.sql', import.meta.url), 'utf8');
const transactionSubmissions = await readFile(new URL('../db/migrations/003_transaction_submissions.sql', import.meta.url), 'utf8');
const apiRateLimits = await readFile(new URL('../db/migrations/004_api_rate_limits.sql', import.meta.url), 'utf8');
const cosmeticBadges = await readFile(new URL('../db/migrations/005_cosmetic_badges.sql', import.meta.url), 'utf8');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });

try {
  const [{ deposits_exists: depositsExists }] = await sql`
    SELECT to_regclass('public.deposits') IS NOT NULL AS deposits_exists
  `;
  if (depositsExists) {
    await sql.unsafe(networkProfiles).simple();
  } else {
    await sql.unsafe(schema).simple();
  }
  await sql.unsafe(transactionSubmissions).simple();
  await sql.unsafe(apiRateLimits).simple();
  await sql.unsafe(cosmeticBadges).simple();
  console.log('SolStreak database schema is up to date.');
} finally {
  await sql.end();
}
