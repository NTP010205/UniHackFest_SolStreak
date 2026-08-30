import postgres from 'postgres';

export class DatabaseConfigurationError extends Error {}

export const DATABASE_POOL_MAX_CONNECTIONS = 5;

interface BoundedPoolOptions {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  ssl: 'require' | undefined;
}

export function createBoundedClientFactory<T>(
  create: (url: string, options: BoundedPoolOptions) => T,
  maxConnections = DATABASE_POOL_MAX_CONNECTIONS,
) {
  let shared: T | undefined;
  return (url: string, production: boolean) => {
    if (!shared) {
      shared = create(url, {
        max: maxConnections,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: production ? 'require' : undefined,
      });
    }
    return shared;
  };
}

const sharedClient = createBoundedClientFactory((url, options) => postgres(url, options));

export function db() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new DatabaseConfigurationError('DATABASE_URL is not configured');
  return sharedClient(databaseUrl, process.env.NODE_ENV === 'production');
}
