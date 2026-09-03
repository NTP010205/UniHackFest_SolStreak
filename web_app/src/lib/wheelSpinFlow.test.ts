import { describe, expect, it } from 'vitest';
import { canStartManualSpin, nextWheelSpinPhase, spinRequestFor, type WheelSpinPhase } from './wheelSpinFlow';

describe('manual wheel spin flow', () => {
  it('only starts from an explicit manual action while idle', () => {
    expect(canStartManualSpin('idle', true)).toBe(true);
    for (const phase of ['requesting', 'spinning', 'revealing'] satisfies WheelSpinPhase[]) {
      expect(canStartManualSpin(phase, true)).toBe(false);
      expect(nextWheelSpinPhase(phase, 'manual_request')).toBe(phase);
    }
    expect(canStartManualSpin('idle', false)).toBe(false);
  });

  it('does not turn refresh or reveal completion into another request', () => {
    expect(nextWheelSpinPhase('spinning', 'animation_completed')).toBe('revealing');
    expect(nextWheelSpinPhase('revealing', 'reveal_closed')).toBe('idle');
    expect(nextWheelSpinPhase('idle', 'animation_completed')).toBe('idle');
    expect(nextWheelSpinPhase('idle', 'reveal_closed')).toBe('idle');
  });

  it('keeps normal and Devnet-admin request contracts isolated', () => {
    expect(spinRequestFor(false, 'wallet', 'uuid-1')).toEqual({
      path: '/api/wheel/spin', requestKey: 'uuid-1', body: { wallet: 'wallet' },
    });
    expect(spinRequestFor(true, 'wallet', 'uuid-2')).toEqual({
      path: '/api/admin/spin', requestKey: 'uuid-2', body: {},
    });
  });

  it('accepts a new UUID only after returning to idle', () => {
    const keys: string[] = [];
    const manualClick = (phase: WheelSpinPhase) => {
      if (!canStartManualSpin(phase, true)) return phase;
      keys.push(`uuid-${keys.length + 1}`);
      return nextWheelSpinPhase(phase, 'manual_request');
    };
    let phase: WheelSpinPhase = manualClick('idle');
    phase = manualClick(phase);
    expect(keys).toEqual(['uuid-1']);
    phase = nextWheelSpinPhase(phase, 'request_succeeded');
    phase = nextWheelSpinPhase(phase, 'animation_completed');
    phase = nextWheelSpinPhase(phase, 'reveal_closed');
    phase = manualClick(phase);
    expect(keys).toEqual(['uuid-1', 'uuid-2']);
    expect(phase).toBe('requesting');
  });
});
