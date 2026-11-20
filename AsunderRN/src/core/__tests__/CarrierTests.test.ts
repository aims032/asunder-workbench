import {
  bandMoved,
  carrierClarity,
  carrierDetentsAway,
  carrierIsOnAir,
  carrierPitch,
  carrierStrength,
  clockIsStill,
  createCarrierOscillator,
  createClock,
  createDialPhysics,
  createSpectrumDisplay,
  dialBand,
  dialGrab,
  dialRelease,
  dialStep,
  oscillatorNext,
  Tuning,
  World,
} from '../index';
import { testSampleRate, utc } from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/CarrierTests.swift.
// One test here per Swift test function, with the same name, inputs and tolerances.

describe('CarrierTests', () => {
  const clock = createClock();
  const center = World.carrierPosition;

  // MARK: Where it is

  /// The Carrier doesn't sit on a notch, but the wheel snaps onto it when it
  /// comes to rest nearby, so you can land dead on it.
  test('testTheWheelSettlesDeadOnTheCarrier', () => {
    for (const offset of [-0.6, -0.3, 0.2, 0.6]) {
      // (If this fails, `offset` is how many notches off the wheel started.)
      const dial = createDialPhysics(center + offset * Tuning.detentSpacing);
      dial.snapPoints = [center];
      dialGrab(dial);
      dialRelease(dial);
      for (let i = 0; i < 600; i += 1) {
        dialStep(dial, 1.0 / 60);
      }
      expect(Math.abs(carrierDetentsAway(dialBand(dial)) - 0)).toBeLessThanOrEqual(0.01);
    }
  });

  test('testReadsAsShortwaveOnTheWideBand', () => {
    expect(createSpectrumDisplay().unitAt(center)).toBe('MHz');
    expect(createSpectrumDisplay().labelAt(center)).toBe('19.92');
  });

  test('testDistanceInDetents', () => {
    expect(Math.abs(carrierDetentsAway(center) - 0)).toBeLessThanOrEqual(1e-9);
    expect(
      Math.abs(carrierDetentsAway(bandMoved(center, -3 * Tuning.detentSpacing)) - 3),
    ).toBeLessThanOrEqual(1e-9);
    expect(
      Math.abs(carrierDetentsAway(bandMoved(center, 2 * Tuning.detentSpacing)) - -2),
    ).toBeLessThanOrEqual(1e-9);
  });

  // MARK: How it sounds from a distance

  test('testStrongestDeadOn', () => {
    expect(Math.abs(carrierStrength(0) - 1)).toBeLessThanOrEqual(1e-12);
    expect(carrierStrength(2)).toBeLessThan(carrierStrength(1));
    expect(carrierStrength(3 * Tuning.carrierWidth)).toBeLessThan(0.02);
  });

  test('testClarityIsNarrowerThanStrength', () => {
    expect(carrierClarity(1)).toBeLessThan(carrierStrength(1));
    expect(Math.abs(carrierClarity(0) - 1)).toBeLessThanOrEqual(1e-12);
  });

  /// Zero-beat: dead on, it's the hum; off to either side the same whistle, rising.
  test('testWhistleSlidesDownToTheHum', () => {
    expect(Math.abs(carrierPitch(0) - Tuning.humHz)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(carrierPitch(3) - carrierPitch(-3))).toBeLessThanOrEqual(1e-9);
    expect(carrierPitch(3)).toBeGreaterThan(carrierPitch(2));
    expect(
      Math.abs(carrierPitch(1) - (Tuning.humHz + Tuning.whistleHzPerDetent)),
    ).toBeLessThanOrEqual(1e-9);
  });

  // MARK: The day-turn dropout

  test('testDropsOutRightAfterTheDayTurn', () => {
    const turn = utc('2026-11-18 00:00:00');
    expect(carrierIsOnAir(turn - 1, clock)).toBe(true); // on before the turn
    expect(carrierIsOnAir(turn, clock)).toBe(false); // gone at the turn
    expect(carrierIsOnAir(turn + (World.carrierDropoutSeconds - 0.01), clock)).toBe(false);
    expect(carrierIsOnAir(turn + World.carrierDropoutSeconds, clock)).toBe(true); // back after
    expect(carrierIsOnAir(turn + 3_600, clock)).toBe(true);
  });

  test('testDropsOutOnStillDaysToo', () => {
    const stillTurn = utc('2026-11-03 00:00:00'); // into Tuesday, a Still day
    expect(clockIsStill(clock, stillTurn)).toBe(true);
    expect(carrierIsOnAir(stillTurn + 0.5, clock)).toBe(false);
  });

  // MARK: The oscillator

  test('testOscillatorPlaysTheRightPitch', () => {
    const osc = createCarrierOscillator();
    let crossings = 0;
    let last = oscillatorNext(osc, 440, testSampleRate);
    for (let i = 1; i < Math.trunc(testSampleRate); i += 1) {
      const s = oscillatorNext(osc, 440, testSampleRate);
      if (last < 0 !== s < 0) {
        crossings += 1;
      }
      last = s;
    }
    // A 440 Hz wave crosses zero 880 times a second.
    expect(Math.abs(crossings - 880)).toBeLessThanOrEqual(2);
  });

  test('testOscillatorStaysInRange', () => {
    const osc = createCarrierOscillator();
    // (Counted up and checked once at the end, rather than 100,000 separate
    // expect() calls. It's the same check: no sample may be outside -1...1.)
    let outOfRange = 0;
    for (let i = 0; i < 100_000; i += 1) {
      const s = oscillatorNext(osc, 50 + (i % 9_000), testSampleRate);
      if (!(s >= -1 && s <= 1)) {
        outOfRange += 1;
      }
    }
    expect(outOfRange).toBe(0);
  });

  /// Changing pitch mid-wave must not jump: the wave carries on from where it was.
  test('testPitchChangesDontClick', () => {
    const osc = createCarrierOscillator();
    let last = oscillatorNext(osc, 110, testSampleRate);
    let biggestStep = 0.0;
    for (let i = 1; i < 9_600; i += 1) {
      const s = oscillatorNext(osc, i < 4_800 ? 110 : 1_200, testSampleRate);
      biggestStep = Math.max(biggestStep, Math.abs(s - last));
      last = s;
    }
    // At 1,200 Hz a wave moves at most ~0.2 per sample; a click would be far bigger.
    expect(biggestStep).toBeLessThan(0.3);
  });
});
