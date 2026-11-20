import {
  createNoiseColor,
  createNoiseRandom,
  createNoiseSource,
  noiseColorBetween,
  noiseColorGains,
  noiseNext,
  randomNext,
  randomNextSigned,
  Tuning,
} from '../index';
import type { NoiseGains, NoiseRandom } from '../index';
import { bandLevel, decibels, rms } from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/NoiseTests.swift.
// One test here per Swift test function, with the same name.

interface Colors {
  white: Float64Array;
  pink: Float64Array;
  brown: Float64Array;
}

function makeColors(seed: number = 1, count: number = 480_000): Colors {
  const source = createNoiseSource(seed);
  const w = new Float64Array(count);
  const p = new Float64Array(count);
  const b = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    noiseNext(source);
    w[i] = source.white;
    p[i] = source.pink;
    b[i] = source.brown;
  }
  return { white: w, pink: p, brown: b };
}

/// The next raw 64-bit number, as text. Swift compared two UInt64 values
/// directly. Here the number arrives as two 32-bit halves, so the halves are
/// joined into one string: two strings match exactly when both halves match.
function nextRaw(random: NoiseRandom): string {
  randomNext(random);
  return `${random.outHi}:${random.outLo}`;
}

/// Somewhere for noiseColorGains to write its three answers.
function emptyGains(): NoiseGains {
  return { white: 0, pink: 0, brown: 0 };
}

describe('NoiseTests', () => {
  // MARK: The random numbers

  test('testSameSeedSameSequence', () => {
    const a = createNoiseRandom(99);
    const b = createNoiseRandom(99);
    for (let i = 0; i < 1_000; i += 1) {
      expect(nextRaw(a)).toBe(nextRaw(b));
    }
  });

  test('testNearbySeedsGiveUnrelatedSequences', () => {
    const a = createNoiseRandom(1);
    const b = createNoiseRandom(2);
    let matches = 0;
    for (let i = 0; i < 1_000; i += 1) {
      if (nextRaw(a) === nextRaw(b)) {
        matches += 1;
      }
    }
    expect(matches).toBe(0);
  });

  test('testSeedZeroStillMakesNoise', () => {
    const r = createNoiseRandom(0);
    const values = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      values.add(nextRaw(r));
    }
    expect(values.size).toBeGreaterThan(95);
  });

  test('testSignedValuesStayBetweenMinusOneAndOne', () => {
    const r = createNoiseRandom(5);
    for (let i = 0; i < 100_000; i += 1) {
      const v = randomNextSigned(r);
      expect(v >= -1 && v < 1).toBe(true);
    }
  });

  // MARK: The three colors

  test('testEachColorIsAboutEquallyLoud', () => {
    const c = makeColors();
    // In order: white, pink, brown.
    for (const s of [c.white, c.pink, c.brown]) {
      expect(Math.abs(rms(s) - 0.3)).toBeLessThanOrEqual(0.04);
    }
  });

  test('testNoColorDriftsOffCenter', () => {
    const c = makeColors();
    // In order: white, pink, brown.
    for (const s of [c.white, c.pink, c.brown]) {
      let sum = 0;
      for (let i = 0; i < s.length; i += 1) {
        sum += s[i];
      }
      const mean = sum / s.length;
      expect(Math.abs(mean - 0)).toBeLessThanOrEqual(0.03);
    }
  });

  /// Measured in octave-wide bands three octaves apart (500 Hz vs 4 kHz):
  /// white gets ~9 dB louder going up, pink stays level, brown gets ~9 dB quieter.
  test('testColorsHaveTheRightTilt', () => {
    const c = makeColors();
    function tilt(s: Float64Array): number {
      return decibels(bandLevel(s, 4_000) / bandLevel(s, 500));
    }
    expect(Math.abs(tilt(c.white) - 9)).toBeLessThanOrEqual(2); // white
    expect(Math.abs(tilt(c.pink) - 0)).toBeLessThanOrEqual(2); // pink
    expect(Math.abs(tilt(c.brown) - -9)).toBeLessThanOrEqual(2); // brown
  });

  // MARK: Temperature (NoiseColor)

  test('testGainsDependOnlyOnTheRatioOfWeights', () => {
    const a = emptyGains();
    const b = emptyGains();
    noiseColorGains(createNoiseColor(0.5, 0.5, 0, 1), a);
    noiseColorGains(createNoiseColor(1, 1, 0, 1), b);
    expect(Math.abs(a.white - b.white)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(a.pink - b.pink)).toBeLessThanOrEqual(1e-12);
  });

  /// Mix real noise with the gains and measure it: whatever the weights, the
  /// result is about as loud as one color at `level` (RMS 0.3 x level).
  test('testLevelAloneSetsLoudness', () => {
    const c = makeColors(1, 240_000);
    const allWeights: [number, number, number][] = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 1.0],
      [3.0, 1.0, 2.0],
      [0.06, 0.3, 0.7],
    ];
    for (const weights of allWeights) {
      const g = emptyGains();
      noiseColorGains(createNoiseColor(weights[0], weights[1], weights[2], 0.5), g);
      const mix = new Float64Array(c.white.length);
      for (let i = 0; i < mix.length; i += 1) {
        mix[i] = g.white * c.white[i] + g.pink * c.pink[i] + g.brown * c.brown[i];
      }
      expect(Math.abs(decibels(rms(mix) / (0.3 * 0.5)) - 0)).toBeLessThanOrEqual(0.6);
    }
  });

  test('testTheColorsAreIndependent', () => {
    const c = makeColors(1, 240_000);
    function correlation(a: Float64Array, b: Float64Array): number {
      let sum = 0;
      for (let i = 0; i < a.length; i += 1) {
        sum += a[i] * b[i];
      }
      return sum / (rms(a) * rms(b) * a.length);
    }
    expect(Math.abs(correlation(c.white, c.pink) - 0)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(correlation(c.pink, c.brown) - 0)).toBeLessThanOrEqual(0.05);
  });

  test('testAllZeroWeightsIsSilence', () => {
    // Starts at 1, 1, 1 (not zeros) so the test shows the gains really were
    // written as zero. In Swift the gains came back as a brand new value.
    const g: NoiseGains = { white: 1, pink: 1, brown: 1 };
    noiseColorGains(createNoiseColor(0, 0, 0, 1), g);
    expect([g.white, g.pink, g.brown]).toEqual([0, 0, 0]);
  });

  test('testBetweenGoesFromColdToHot', () => {
    const cold = createNoiseColor(0, 0, 1, 0.5);
    const hot = createNoiseColor(1, 0, 0, 1);
    // Starts as an unrelated color, so every field has to be written.
    const atCold = createNoiseColor(9, 9, 9, 9);
    const atHot = createNoiseColor(9, 9, 9, 9);
    const halfway = createNoiseColor(9, 9, 9, 9);
    noiseColorBetween(atCold, cold, hot, 0);
    noiseColorBetween(atHot, cold, hot, 1);
    noiseColorBetween(halfway, cold, hot, 0.5);
    expect(atCold).toEqual(cold);
    expect(atHot).toEqual(hot);
    expect(Math.abs(halfway.level - 0.75)).toBeLessThanOrEqual(1e-12);
  });

  test('testHotStaticIsBrighterAndLouderThanCold', () => {
    expect(Tuning.hotStatic.level).toBeGreaterThan(Tuning.coldStatic.level);
    expect(Tuning.hotStatic.white / Tuning.hotStatic.brown).toBeGreaterThan(
      Tuning.coldStatic.white / Tuning.coldStatic.brown,
    );
  });
});
