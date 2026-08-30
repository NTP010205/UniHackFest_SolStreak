/**
 * Next.js only exposes NEXT_PUBLIC values to browser bundles when each value is
 * referenced with a statically analyzable property access. Keep these accesses
 * literal; do not replace them with process.env[name] or object iteration.
 */
export const CLIENT_PUBLIC_CONFIG = Object.freeze({
  NEXT_PUBLIC_SOLANA_NETWORK_PROFILE:
    process.env.NEXT_PUBLIC_SOLANA_NETWORK_PROFILE,
  NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS:
    process.env.NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS,
  NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS:
    process.env.NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS,
  NEXT_PUBLIC_SOLANA_RPC_URL:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL:
    process.env.NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL,
  NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL:
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL,
  NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL:
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL,
});

export type ClientPublicConfig = Record<keyof typeof CLIENT_PUBLIC_CONFIG, string | undefined>;
