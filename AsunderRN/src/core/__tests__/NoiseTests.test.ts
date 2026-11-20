import {
  createNoiseColor,
  createNoiseRandom,
  createNoiseSource,
  noiseColorBetween,
  noiseColorGains,
  noiseFillRandoms,
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

/// The next raw 32-bit number, as text (kept as text so the tests below read
/// the same as they did when the number came in two halves).
function nextRaw(random: NoiseRandom): string {
  randomNext(random);
  return `${random.out}`;
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

  // These two are new with the Nov 20 generator (no Swift counterpart). The
  // expected numbers come from the published C code for SplitMix64 and
  // xoshiro128** (prng.di.unimi.it), compiled and run on Nov 20, 2026:
  // the seed goes through SplitMix64 twice, its two 64-bit answers become
  // the four 32-bit words (bottom half first), then xoshiro128** runs.
  const reference = [
    { seed: 0, state: [2065550767, 3793791033, 2713282036, 1853398634], next: [3737715805, 2584255861, 2876756834, 3286328325, 1553311962, 1625202774, 3260698944, 2754151956] },
    { seed: 1, state: [2298633409, 2433363436, 1703865447, 3203108257], next: [1695105466, 1423115009, 634581793, 1068227753, 716759206, 4186505319, 3777694425, 2710820970] },
    { seed: 2, state: [479680206, 2539140574, 201072194, 3217573392], next: [1086064458, 2256779072, 556893360, 1218312803, 4005656520, 1519932757, 2579561883, 839593612] },
    { seed: 99, state: [1279749091, 1123264822, 2275240356, 135969048], next: [1784627295, 697397638, 3796439119, 926223249, 2914072428, 2531196325, 91435098, 1171049374] },
    { seed: 1763650000000, state: [2286253491, 2826543512, 2975193490, 2445097005], next: [2964577613, 3149186627, 2055890330, 711398850, 3460159795, 390886369, 2918360666, 241314766] },
    { seed: 9007199254740991, state: [4021704095, 616124332, 3074421144, 818148089], next: [1233166643, 1287031142, 661813442, 2960669951, 2601079046, 1036114921, 2300589652, 2591400186] },
  ];

  test('testMatchesThePublishedReferenceCode', () => {
    for (const row of reference) {
      const r = createNoiseRandom(row.seed);
      expect([r.s0, r.s1, r.s2, r.s3]).toEqual(row.state);
      const got: number[] = [];
      for (let i = 0; i < row.next.length; i += 1) {
        randomNext(r);
        got.push(r.out);
      }
      expect(got).toEqual(row.next);
    }
    // And far along: the millionth number from seed 1.
    const far = createNoiseRandom(1);
    for (let i = 0; i < 1_000_000; i += 1) {
      randomNext(far);
    }
    expect(far.out).toBe(637055319);
  });

  test('testFillGivesExactlyWhatSignedGives', () => {
    // noiseFillRandoms is randomNextSigned written out in a loop; they must
    // agree number for number, including across several fills in a row.
    const one = createNoiseRandom(42);
    const many = createNoiseRandom(42);
    const list = new Float64Array(777);
    for (const size of [1, 2, 3, 128, 777, 500]) {
      noiseFillRandoms(many, list, size);
      for (let i = 0; i < size; i += 1) {
        expect(list[i]).toBe(randomNextSigned(one));
      }
    }
    expect([many.s0, many.s1, many.s2, many.s3, many.out]).toEqual([one.s0, one.s1, one.s2, one.s3, one.out]);
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
