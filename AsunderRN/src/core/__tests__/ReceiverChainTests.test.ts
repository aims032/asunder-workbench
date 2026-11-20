import type { ReceiverTargets } from '../index';
import {
  chainRenderToNewArray,
  chainRestartFade,
  createClock,
  createReceiverChain,
  createReceiverTargets,
  receptionTargets,
  Tuning,
  World,
} from '../index';
import {
  bandLevel,
  brightness,
  decibels,
  movingMidday,
  peak,
  rms,
  speaker,
  stillMidday,
  testSampleRate,
} from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/ReceiverChainTests.swift.
// One test here per Swift test function, with the same name, inputs and tolerances.

// These tests make many seconds of sound, one sample at a time. That takes
// JavaScript a few seconds (the slowest took 3.7 s here), close to Jest's usual
// 5-second limit, so each test gets a minute before it's called stuck.
// This changes how long a test may run, never what it checks.
jest.setTimeout(60_000);

/// Where two runs of samples first differ, or -1 if they're the same, sample
/// for sample. (Swift compared two [Float] arrays with ==. This does the same
/// job, and when it fails it says WHERE rather than printing 96,000 numbers.
/// A different length counts as differing at the shorter one's end.)
function firstDifference(a: Float32Array, b: Float32Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) {
      return i;
    }
  }
  return a.length === b.length ? -1 : shared;
}

describe('ReceiverChainTests', () => {
  const clock = createClock();
  const center = World.carrierPosition;
  const farAway = World.carrierPosition + 0.4;

  /// The targets for a dial position at a moment, in a fresh ReceiverTargets
  /// (Swift's Reception.targets handed back a new value each time).
  function targetsAt(dial: number, date: number): ReceiverTargets {
    const t = createReceiverTargets();
    receptionTargets(t, dial, date, clock);
    return t;
  }

  /// Two seconds of the radio at a dial position and moment, after it has
  /// warmed up (fade-in done, every control settled).
  function listen(dial: number, date: number = movingMidday, seed: number = 11): Float32Array {
    const chain = createReceiverChain(testSampleRate, seed);
    const t = targetsAt(dial, date);
    chainRenderToNewArray(chain, Math.trunc(testSampleRate), t);
    return chainRenderToNewArray(chain, Math.trunc(2 * testSampleRate), t);
  }

  /// The same, with the Carrier muted: the static alone, still through the
  /// EQ path exactly as it's set at that dial position.
  function listenToStatic(dial: number, date: number = movingMidday): Float32Array {
    const chain = createReceiverChain(testSampleRate, 11);
    const t = targetsAt(dial, date);
    t.carrierLevel = 0;
    chainRenderToNewArray(chain, Math.trunc(testSampleRate), t);
    return chainRenderToNewArray(chain, Math.trunc(2 * testSampleRate), t);
  }

  // MARK: Deterministic

  test('testSameSeedSameSound', () => {
    expect(firstDifference(listen(farAway, movingMidday, 4), listen(farAway, movingMidday, 4))).toBe(
      -1,
    );
    expect(
      firstDifference(listen(farAway, movingMidday, 4), listen(farAway, movingMidday, 5)),
    ).not.toBe(-1);
  });

  /// The phone hands the engine buffers of whatever size it likes. The sound
  /// must not depend on how it's cut up.
  test('testBufferSizeDoesntChangeTheSound', () => {
    const t = targetsAt(center, movingMidday);
    const whole = createReceiverChain(testSampleRate, 9);
    const pieces = createReceiverChain(testSampleRate, 9);
    const a = chainRenderToNewArray(whole, 4_096, t);
    // The four pieces, joined end to end into one run.
    const b = new Float32Array(4_096);
    let filled = 0;
    for (const count of [100, 1_000, 7, 2_989]) {
      b.set(chainRenderToNewArray(pieces, count, t), filled);
      filled += count;
    }
    expect(filled).toBe(a.length);
    expect(firstDifference(a, b)).toBe(-1);
  });

  // MARK: Turning on

  test('testFadesInFromSilence', () => {
    const chain = createReceiverChain(testSampleRate, 2);
    const t = targetsAt(farAway, movingMidday);
    const start = chainRenderToNewArray(chain, 480, t); // first 10 ms
    expect(peak(start)).toBeLessThan(0.02);
    chainRenderToNewArray(chain, Math.trunc(2 * testSampleRate), t);
    expect(rms(chainRenderToNewArray(chain, 48_000, t))).toBeGreaterThan(0.05);
  });

  test('testRestartFadeFadesInAgain', () => {
    const chain = createReceiverChain(testSampleRate, 2);
    const t = targetsAt(farAway, movingMidday);
    chainRenderToNewArray(chain, Math.trunc(2 * testSampleRate), t);
    chainRestartFade(chain);
    expect(peak(chainRenderToNewArray(chain, 480, t))).toBeLessThan(0.02);
  });

  // MARK: Levels

  test('testNeverClipsAtTheDefaultSettings', () => {
    for (const date of [movingMidday, stillMidday]) {
      for (const dial of [
        farAway,
        center,
        center + Tuning.detentSpacing,
        center + 4 * Tuning.detentSpacing,
      ]) {
        // (If this fails, `dial` and `date` say which position and day clipped.)
        const out = listen(dial, date);
        expect(peak(out)).toBeLessThan(0.9);
        expect(out.every((sample) => Number.isFinite(sample))).toBe(true);
      }
    }
  });

  test('testStillDaysAreQuieterAndDarker', () => {
    const hot = listen(farAway, movingMidday);
    const cold = listen(farAway, stillMidday);
    expect(rms(cold)).toBeLessThan(rms(hot) * 0.7); // at least ~3 dB quieter
    expect(brightness(cold)).toBeLessThan(brightness(hot));
  });

  // MARK: Tuning in

  test('testTheHumIsHeardDeadOn', () => {
    const on = listen(center);
    const off = listen(farAway);
    expect(bandLevel(on, Tuning.humHz, 8)).toBeGreaterThan(3 * bandLevel(off, Tuning.humHz, 8));
  });

  /// Through a phone speaker (which drops everything below ~250 Hz), dead on
  /// must not sound quieter than one notch off: the arrival is a peak, not a dip.
  test('testOnAPhoneSpeakerTheCenterIsNotADip', () => {
    function carrierOnSpeaker(dial: number): number {
      const chain = createReceiverChain(testSampleRate, 1);
      const t = targetsAt(dial, movingMidday);
      t.white = 0;
      t.pink = 0;
      t.brown = 0; // the tone alone
      chainRenderToNewArray(chain, 24_000, t);
      return rms(speaker(chainRenderToNewArray(chain, 96_000, t)));
    }
    // WATCH OUT: this is ported exactly as the Swift test RUNS, and the Swift
    // test doesn't check what its comment says. In Swift the first line reads
    //     let center = carrierOnSpeaker(center)
    // which makes a new `center` holding a LOUDNESS (about 0.051) that hides
    // the dial position of the same name. The next line then adds one notch to
    // that loudness and uses it as a dial position (about 0.0514), which is
    // nowhere near the Carrier. Out there the Carrier is silent, so `oneOff` is
    // exactly 0, the ratio is infinite, and the check always passes.
    //
    // Written the way it was meant (one notch off the Carrier's position) the
    // answer is -1.5827 dB in BOTH the Swift core and this port, which is just
    // past the -1.5 dB allowed. So the port matches Swift; it's the Swift test
    // (and maybe Tuning.humBoost) that needs Evan's eye. See the test.todo below.
    const atCenter = carrierOnSpeaker(center);
    const oneOff = carrierOnSpeaker(atCenter + Tuning.detentSpacing);
    expect(decibels(atCenter / oneOff)).toBeGreaterThan(-1.5);
  });

  // Not in the Swift tests. A reminder that shows up in the test report without
  // failing it: the check above is the one Swift really runs, not the one it
  // describes. Meant version: carrierOnSpeaker(center) against
  // carrierOnSpeaker(center + Tuning.detentSpacing), which gives -1.58 dB today.
  test.todo(
    'testOnAPhoneSpeakerTheCenterIsNotADip as intended: one notch off the Carrier (-1.58 dB today, limit -1.5)',
  );

  test('testTheWhistleIsHeardOneNotchOff', () => {
    const whistle = Tuning.humHz + Tuning.whistleHzPerDetent;
    const near = listen(center + Tuning.detentSpacing);
    const off = listen(farAway);
    expect(bandLevel(near, whistle, 8)).toBeGreaterThan(3 * bandLevel(off, whistle, 8));
  });

  /// Off-station the EQ path is closed, so the static is dull up top.
  /// Dead on, it opens: the highs (8 kHz) come up against the mids (1 kHz).
  test('testStaticIsDullOffStationAndOpensOnTheCarrier', () => {
    function highsOverMids(s: Float32Array): number {
      return bandLevel(s, 8_000) / bandLevel(s, 1_000);
    }
    expect(highsOverMids(listenToStatic(center))).toBeGreaterThan(
      2 * highsOverMids(listenToStatic(farAway)),
    );
  });

  /// The high-pass half: off-station the lows are cut (thin, on headphones).
  test('testStaticIsThinOffStationAndOpensOnTheCarrier', () => {
    function lowsOverMids(s: Float32Array): number {
      return bandLevel(s, 70) / bandLevel(s, 1_000);
    }
    expect(lowsOverMids(listenToStatic(center, stillMidday))).toBeGreaterThan(
      2 * lowsOverMids(listenToStatic(farAway, stillMidday)),
    );
  });

  test('testExtremeTargetsStayFinite', () => {
    const chain = createReceiverChain(testSampleRate, 1);
    // (Swift built these with ReceiverTargets(white: 5, ...). Here a blank
    // ReceiverTargets is made and each control is set by hand.)
    const wild = createReceiverTargets();
    wild.white = 5;
    wild.pink = 5;
    wild.brown = 5;
    wild.carrierLevel = 5;
    wild.carrierPitch = 30_000;
    wild.highpassHz = 0;
    wild.lowpassHz = 1e9;
    const out = chainRenderToNewArray(chain, 48_000, wild);
    expect(out.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true);
  });
});
