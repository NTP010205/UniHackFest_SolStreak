export type WheelSpinPhase = 'idle' | 'requesting' | 'spinning' | 'revealing';

export function canStartManualSpin(phase: WheelSpinPhase, enabled: boolean) {
  return phase === 'idle' && enabled;
}

export function spinRequestFor(isDevnetAdmin: boolean, walletAddress: string, requestKey: string) {
  return isDevnetAdmin
    ? { path: '/api/admin/spin', requestKey, body: { wallet: walletAddress } }
    : { path: '/api/wheel/spin', requestKey, body: { wallet: walletAddress } };
}

export function nextWheelSpinPhase(
  phase: WheelSpinPhase,
  event: 'manual_request' | 'request_succeeded' | 'animation_completed' | 'reveal_closed' | 'failed',
): WheelSpinPhase {
  if (event === 'failed') return 'idle';
  if (phase === 'idle' && event === 'manual_request') return 'requesting';
  if (phase === 'requesting' && event === 'request_succeeded') return 'spinning';
  if (phase === 'spinning' && event === 'animation_completed') return 'revealing';
  if (phase === 'revealing' && event === 'reveal_closed') return 'idle';
  return phase;
}
