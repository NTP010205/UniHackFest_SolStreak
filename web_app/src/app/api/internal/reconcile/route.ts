import { createSchedulerHandler } from '@/lib/reconciliationSchedulerHandler';

export async function POST(request: Request) {
  const { runConfiguredReconciliation } = await import('@/lib/reconciliationServer');
  const { ACTIVE_NETWORK } = await import('@/lib/networkProfile');
  const { API_RATE_LIMITS, enforceApiRateLimit, RateLimitExceededError } = await import('@/lib/rateLimit');
  return createSchedulerHandler({
    secret: process.env.RECONCILIATION_SECRET,
    run: runConfiguredReconciliation,
    networkProfile: ACTIVE_NETWORK.name,
    limitInvocation: async () => {
      try {
        const result = await enforceApiRateLimit({
          policy: API_RATE_LIMITS.scheduler,
          userId: 'scheduler',
          networkProfile: ACTIVE_NETWORK.name,
        });
        return { allowed: true, retryAfterSeconds: result.retryAfterSeconds };
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          return { allowed: false, retryAfterSeconds: error.retryAfterSeconds };
        }
        throw error;
      }
    },
  })(request);
}
