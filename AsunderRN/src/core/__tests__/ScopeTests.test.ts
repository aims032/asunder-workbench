import {
  carrierPosition,
  SCOPE_JACK,
  SWITCHBOARD_LAYOUT,
  scopeClarity,
  scopeLook,
  scopeOverrideAmount,
  scopeOverrideAt,
  scopeRoll,
  ScopeTuning,
} from '../index';
import type { ScopeOverride } from '../index';

// The scope's numbers (Scope.ts). There's no Swift version, so these are new.

describe('scope clarity', () => {
  test('is highest dead on the Carrier and falls off away from it', () => {
    const on = scopeClarity(carrierPosition());
    const off = scopeClarity((carrierPosition() + 0.25) % 1);
    expect(on).toBeCloseTo(1, 5);
    expect(off).toBeLessThan(0.01);
  });
});

describe('scope look', () => {
  test('nothing patched in: only snow, whatever the tuning', () => {
    const look = scopeLook(1, false);
    expect(look.picture).toBe(0);
    expect(look.snow).toBe(ScopeTuning.snowLost);
    expect(look.color).toBe(0);
  });

  test('dead on: the full picture, in color, steady', () => {
    const look = scopeLook(1, true);
    expect(look.picture).toBe(1);
    expect(look.color).toBe(1);
    expect(look.snow).toBeCloseTo(ScopeTuning.snowClear, 10);
    expect(look.rollSpeed).toBe(0);
    expect(look.smear).toBe(0);
  });

  test('below the threshold the picture has not started', () => {
    expect(scopeLook(ScopeTuning.pictureFrom * 0.5, true).picture).toBe(0);
  });

  test('tuning in never makes the picture worse', () => {
    let last = scopeLook(0, true);
    for (let c = 0.05; c <= 1.0001; c += 0.05) {
      const look = scopeLook(c, true);
      expect(look.picture).toBeGreaterThanOrEqual(last.picture);
      expect(look.snow).toBeLessThanOrEqual(last.snow);
      expect(look.rollSpeed).toBeLessThanOrEqual(last.rollSpeed);
      last = look;
    }
  });

  test('lost in the static, the roll wraps round and never goes negative', () => {
    const lost = { ...scopeLook(0, true), rollSpeed: 0.5 };
    expect(scopeRoll(0.9, lost, 0.4)).toBeCloseTo(0.1, 10);
    expect(scopeRoll(0.1, { ...lost, rollSpeed: -0.5 }, 0.4)).toBeCloseTo(0.9, 10);
  });

  test('tuned in, the vertical hold brings a rolled picture back upright', () => {
    const clear = scopeLook(1, true);
    let roll = 0.3;
    for (let i = 0; i < 120; i += 1) {
      roll = scopeRoll(roll, clear, 1 / 60);
    }
    expect(roll).toBeLessThan(0.001);
    roll = 0.8;
    for (let i = 0; i < 120; i += 1) {
      roll = scopeRoll(roll, clear, 1 / 60);
    }
    expect(Math.min(roll, 1 - roll)).toBeLessThan(0.001);
  });
});

describe("Asunder's override", () => {
  const o: ScopeOverride = { startsAt: 1000, seconds: 10, picture: 'placeholder' };

  test('is off before it starts and after it ends', () => {
    expect(scopeOverrideAmount(o, 999)).toBe(0);
    expect(scopeOverrideAmount(o, 1010)).toBe(0);
  });

  test('snaps in, holds, then lets go', () => {
    expect(scopeOverrideAmount(o, 1000 + ScopeTuning.overrideInSeconds / 2)).toBeCloseTo(0.5, 5);
    expect(scopeOverrideAmount(o, 1005)).toBe(1);
    expect(scopeOverrideAmount(o, 1010 - ScopeTuning.overrideOutSeconds / 2)).toBeCloseTo(0.5, 5);
  });

  test('picks the picture of the one on screen, and none when the list is empty', () => {
    expect(scopeOverrideAt(1005, [o])).toEqual({ amount: 1, picture: 'placeholder' });
    expect(scopeOverrideAt(1005, [])).toEqual({ amount: 0, picture: null });
  });
});

test('the switchboard has a jack for the scope', () => {
  expect(SWITCHBOARD_LAYOUT.inputs).toContain(SCOPE_JACK);
});
