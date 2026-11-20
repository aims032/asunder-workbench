import type { ReceiverTargets } from '../index';
import {
  carrierIsOnAir,
  clockSecondsIntoDay,
  createClock,
  createReceiverTargets,
  noiseTemperatureAt,
  receptionBlendHz,
  receptionTargets,
  Tuning,
  World,
} from '../index';
import { movingMidday, movingToStillTurn, stillMidday, utc } from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/ReceptionTests.swift.
// One test here per Swift test function, with the same name, inputs and tolerances.

describe('ReceptionTests', () => {
  const clock = createClock();
  const center = World.carrierPosition;
  const farAway = World.carrierPosition + 0.4;

  // (Swift handed back a fresh ReceiverTargets each time. Here receptionTargets
  // fills in one it's given, so this makes a new one per call: a test can then
  // hold two sets of targets side by side, as the Swift tests do.)
  function targets(dial: number, date: number = movingMidday): ReceiverTargets {
    const out = createReceiverTargets();
    receptionTargets(out, dial, date, clock);
    return out;
  }

  function staticLoudness(t: ReceiverTargets): number {
    return Math.sqrt(t.white * t.white + t.pink * t.pink + t.brown * t.brown);
  }

  // MARK: Temperature follows the clock

  test('testHotOnMovingDaysColdOnStillDays', () => {
    expect(noiseTemperatureAt(movingMidday, clock)).toBe(1);
    expect(noiseTemperatureAt(stillMidday, clock)).toBe(0);
  });

  test('testTemperatureGlidesAfterTheTurn', () => {
    const turn = movingToStillTurn;
    expect(noiseTemperatureAt(turn - 1, clock)).toBe(1); // still hot before the turn
    // The glide starts at yesterday's.
    expect(Math.abs(noiseTemperatureAt(turn, clock) - 1)).toBeLessThanOrEqual(1e-9);
    expect(
      Math.abs(noiseTemperatureAt(turn + World.temperatureGlideSeconds / 2, clock) - 0.5),
    ).toBeLessThanOrEqual(1e-9);
    expect(noiseTemperatureAt(turn + World.temperatureGlideSeconds, clock)).toBe(0);
  });

  test('testStillDayStaticIsQuieterAndDarker', () => {
    const hot = targets(farAway, movingMidday);
    const cold = targets(farAway, stillMidday);
    expect(staticLoudness(cold)).toBeLessThan(staticLoudness(hot));
    expect(hot.white / hot.brown).toBeGreaterThan(cold.white / cold.brown);
  });

  // MARK: The dial

  test('testFarFromTheCarrierItsSilentAndTheEQIsClosed', () => {
    const t = targets(farAway);
    expect(Math.abs(t.carrierLevel - 0)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(t.highpassHz - Tuning.closedHighpassHz)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(t.lowpassHz - Tuning.closedLowpassHz)).toBeLessThanOrEqual(0.01);
  });

  test('testDeadOnTheCarrierTheEQOpensAndTheHissQuiets', () => {
    const on = targets(center);
    const off = targets(farAway);
    expect(
      Math.abs(on.carrierLevel - Tuning.carrierVolume * (1 + Tuning.humBoost)),
    ).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(on.carrierPitch - Tuning.humHz)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(on.highpassHz - Tuning.openHighpassHz)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(on.lowpassHz - Tuning.openLowpassHz)).toBeLessThanOrEqual(0.01);
    expect(
      Math.abs(staticLoudness(on) / staticLoudness(off) - (1 - Tuning.carrierQuieting)),
    ).toBeLessThanOrEqual(1e-9);
  });

  test('testOneNotchOffIsHeardButNotClear', () => {
    const t = targets(center + Tuning.detentSpacing);
    expect(t.carrierLevel).toBeGreaterThan(0.5 * Tuning.carrierVolume);
    expect(t.lowpassHz).toBeLessThan(
      receptionBlendHz(Tuning.closedLowpassHz, Tuning.openLowpassHz, 0.5),
    );
    expect(
      Math.abs(t.carrierPitch - (Tuning.humHz + Tuning.whistleHzPerDetent)),
    ).toBeLessThanOrEqual(1e-6);
  });

  test('testTheLoopHasNoSeam', () => {
    // An unwrapped dial (laps on, or laps back) hears the same thing,
    // give or take floating-point rounding.
    const pairs: [number, number][] = [
      [center + 3, center],
      [center - 2 + 0.01, center + 0.01],
    ];
    for (const [a, b] of pairs) {
      const ta = targets(a);
      const tb = targets(b);
      expect(Math.abs(ta.carrierLevel - tb.carrierLevel)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(ta.carrierPitch - tb.carrierPitch)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(ta.lowpassHz - tb.lowpassHz)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(ta.white - tb.white)).toBeLessThanOrEqual(1e-9);
    }
  });

  // MARK: The day-turn dropout

  test('testDuringTheDropoutTheCarrierIsGoneAndTheEQCloses', () => {
    const turn = utc('2026-11-18 00:00:00');
    const during = targets(center, turn + 0.5);
    expect(during.carrierLevel).toBe(0);
    expect(Math.abs(during.lowpassHz - Tuning.closedLowpassHz)).toBeLessThanOrEqual(0.01);
    const after = targets(center, turn + (World.carrierDropoutSeconds + 0.5));
    expect(
      Math.abs(after.carrierLevel - Tuning.carrierVolume * (1 + Tuning.humBoost)),
    ).toBeLessThanOrEqual(1e-9);
  });

  /// The day-turn hour is Open. If it moves, the dropout and the glide must
  /// follow the turn, not UTC midnight.
  test('testDropoutAndGlideFollowAMovedDayTurn', () => {
    const late = createClock(undefined, 5);
    const midnight = utc('2026-11-18 00:00:00');
    const turn = utc('2026-11-18 05:00:00');
    expect(Math.abs(clockSecondsIntoDay(late, turn) - 0)).toBeLessThanOrEqual(1e-6);
    expect(carrierIsOnAir(midnight + 0.5, late)).toBe(true); // midnight is nothing special
    expect(carrierIsOnAir(turn + 0.5, late)).toBe(false);

    // Monday (L) into Tuesday (S), at 05:00 instead of 00:00.
    const stillTurn = utc('2026-11-03 05:00:00');
    expect(noiseTemperatureAt(stillTurn - 1, late)).toBe(1);
    expect(
      Math.abs(noiseTemperatureAt(stillTurn + World.temperatureGlideSeconds / 2, late) - 0.5),
    ).toBeLessThanOrEqual(1e-9);
  });

  // MARK: Helpers

  test('testBlendHzIsHalfwayInOctaves', () => {
    expect(Math.abs(receptionBlendHz(100, 400, 0.5) - 200)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(receptionBlendHz(100, 400, 0) - 100)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(receptionBlendHz(100, 400, 1) - 400)).toBeLessThanOrEqual(1e-9);
  });
});
