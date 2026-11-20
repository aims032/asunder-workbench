// The static (white, pink and brown noise). These functions can run on the audio thread (see src/audio).
//
// RULE FOR THIS FILE: write a helper function ABOVE the first place it is used.
// A mistake in that order still works on a computer; it only breaks on the
// phone. (One test, DeclarationOrder, checks the order for you.)
// Why: the 'worklet' line below turns each function into a value that is
// created in order, top to bottom, so a function that is used before the line
// that creates it does not exist yet.
'worklet';

// THE STATIC: three colors of noise, made one sample at a time.
//
//   white  hiss     every frequency equally loud
//   pink   room     each octave equally loud (sounds even to the ear)
//   brown  rumble   lows much louder than highs
//
// How the three are mixed is the "noise temperature" (NoiseColor, below).
// Nothing here repeats: the random numbers come from a generator whose
// sequence is 2^128 numbers long (far longer than the universe is old, at
// 48 kHz).

// MARK: The random numbers
//
// BIT OPERATORS, used in the code below. They work on the
// individual bits of a number (think of a row of 32 on/off switches):
//   a ^ b    XOR: each bit comes out on if exactly one of the two was on.
//            It is how the generator stirs bits together.
//   a << n   shift left: slide every bit n places up (the top ones fall off).
//   a >>> n  shift right: slide every bit n places down, filling with zeros.
//   a | b    OR: each bit is on if either was on. Here it glues together two
//            pieces that were shifted into different places.
//   a & b    AND: each bit is on only if both were on. With 0xffff it keeps
//            just the bottom 16 bits.
//   0x...    a number written in hexadecimal (base 16), the usual way to write
//            bit patterns. 0xff is 255.
// `>>> 0` on its own means "read these 32 bits as a positive whole number",
// and Math.imul multiplies two 32-bit numbers and keeps the bottom 32 bits.
//
// WHY THIS GENERATOR (Nov 20). Until then the static used the Swift app's
// generator, which works on 64-bit numbers. A JavaScript number can't hold
// those, so each step was done on two 32-bit halves, and on the phone that
// took about half of the whole sound loop's time. This one (xoshiro128**,
// Blackman and Vigna, 2018) works on 32-bit numbers to begin with, so each
// step is a handful of operations. It is as good for audio: it never repeats
// in any useful sense (its sequence is 2^128 numbers long), and it passes the
// standard statistical tests for randomness.
//
// What changed for the sound: the hiss is a different (equally random)
// stream than the Swift app's, so the two apps no longer make the same hiss
// sample for sample. That was never the aim: the hiss doesn't match between
// phones either (each starts from its own seed). Everything that SHAPES it
// (the colors, the temperature, the Carrier, the filters) still matches the
// Swift app, and SwiftParity.test.ts still checks that, by feeding the chain
// the Swift app's random numbers (__tests__/SwiftRandom.ts).
//
// NoiseTests.test.ts checks this code against numbers from the generator's
// published C code, so don't change any of it.

/**
 * A fast random number generator that is safe to run on the audio thread
 * (no locks, no memory allocation). Same seed, same sequence, on every machine.
 * This is xoshiro128** (Blackman and Vigna, 2018).
 */
export interface NoiseRandom {
  /** Internal. The generator's memory: four 32-bit numbers. */
  s0: number;
  s1: number;
  s2: number;
  s3: number;
  /** The raw 32-bit number made by the latest randomNext (0 up to 2^32). */
  out: number;
}

/**
 * The top 32 bits of a 32-bit × 32-bit multiply (the full answer has 64 bits,
 * too many to hold at once). Each number is cut into two 16-bit pieces and
 * multiplied the long way, piece by piece, so nothing ever gets too big.
 * (Only used to scramble the seed, once, below.)
 */
function multiplyHigh32(a: number, b: number): number {
  const aLow = a & 0xffff;
  const aHigh = a >>> 16;
  const bLow = b & 0xffff;
  const bHigh = b >>> 16;
  const lowLow = aLow * bLow;
  const middle = aHigh * bLow + aLow * bHigh + (lowLow >>> 16);
  return aHigh * bHigh + Math.floor(middle / 65536);
}

/**
 * One SplitMix64 scramble (Vigna), the standard way to turn a seed into a
 * generator's starting memory. `hi` and `lo` are the top and bottom 32 bits
 * of a 64-bit number (the full number is hi * 2^32 + lo). Its scrambled
 * value goes into `into.s0` and `into.s1` when `first` is true, or into
 * `into.s2` and `into.s3` (the bottom half first each time).
 */
function splitMix64(hi: number, lo: number, into: NoiseRandom, first: boolean): void {
  // Each step is written first as the 64-bit sum it performs (z is the number
  // held in hi and lo), then as the same sum on the two halves.
  // z = (z ^ (z >> 30)) * 0xBF58_476D_1CE4_E5B9
  lo = (lo ^ ((lo >>> 30) | (hi << 2))) >>> 0;
  hi = (hi ^ (hi >>> 30)) >>> 0;
  let productHi =
    (multiplyHigh32(lo, 0x1ce4e5b9) + Math.imul(lo, 0xbf58476d) + Math.imul(hi, 0x1ce4e5b9)) >>> 0;
  lo = Math.imul(lo, 0x1ce4e5b9) >>> 0;
  hi = productHi;
  // z = (z ^ (z >> 27)) * 0x94D0_49BB_1331_11EB
  lo = (lo ^ ((lo >>> 27) | (hi << 5))) >>> 0;
  hi = (hi ^ (hi >>> 27)) >>> 0;
  productHi =
    (multiplyHigh32(lo, 0x133111eb) + Math.imul(lo, 0x94d049bb) + Math.imul(hi, 0x133111eb)) >>> 0;
  lo = Math.imul(lo, 0x133111eb) >>> 0;
  hi = productHi;
  // z ^= z >> 31
  lo = (lo ^ ((lo >>> 31) | (hi << 1))) >>> 0;
  hi = (hi ^ (hi >>> 31)) >>> 0;
  if (first) {
    into.s0 = lo;
    into.s1 = hi;
  } else {
    into.s2 = lo;
    into.s3 = hi;
  }
}

/** `seed` is a whole number from 0 up to 2^53 (9007199254740992). */
export function createNoiseRandom(seed: number): NoiseRandom {
  const random: NoiseRandom = { s0: 0, s1: 0, s2: 0, s3: 0, out: 0 };
  // Split the seed into its two halves.
  const hi = Math.floor(seed / 4294967296) >>> 0;
  const lo = seed >>> 0;

  // Scramble it (SplitMix64), so nearby seeds like 1 and 2 still give
  // unrelated sequences. SplitMix64 adds 0x9E37_79B9_7F4A_7C15 to its memory
  // before each scramble: once for the first two numbers, twice for the
  // other two.
  const lowSum1 = lo + 0x7f4a7c15;
  const carry1 = lowSum1 > 0xffffffff ? 1 : 0; // the low half overflowed: carry 1 up
  const lo1 = lowSum1 >>> 0;
  const hi1 = (hi + 0x9e3779b9 + carry1) >>> 0;
  splitMix64(hi1, lo1, random, true);
  const lowSum2 = lo1 + 0x7f4a7c15;
  const carry2 = lowSum2 > 0xffffffff ? 1 : 0;
  splitMix64((hi1 + 0x9e3779b9 + carry2) >>> 0, lowSum2 >>> 0, random, false);

  // The memory must never be all zero, or it gets stuck at zero. (SplitMix64
  // practically never gives that; this is a safety net.)
  if (random.s0 === 0 && random.s1 === 0 && random.s2 === 0 && random.s3 === 0) {
    random.s0 = 1;
  }
  return random;
}

/**
 * The next raw 32-bit number. It's left in random.out instead of being
 * handed back, the same way the static's other parts work.
 * noiseFillRandoms (below) does these same steps written out in its loop;
 * if you change this, change it to match.
 */
export function randomNext(random: NoiseRandom): void {
  const s1 = random.s1;
  // result = rotl(s1 * 5, 7) * 9   (rotl: shift left, and the bits that fall
  // off the top come back in at the bottom)
  const times5 = Math.imul(s1, 5);
  random.out = Math.imul((times5 << 7) | (times5 >>> 25), 9) >>> 0;
  // Stir the memory.
  const t = s1 << 9;
  let s0 = random.s0;
  let s2 = random.s2 ^ s0;
  let s3 = random.s3 ^ s1;
  const newS1 = s1 ^ s2;
  s0 ^= s3;
  s2 ^= t;
  s3 = (s3 << 11) | (s3 >>> 21); // rotl(s3, 11)
  random.s0 = s0 >>> 0;
  random.s1 = newS1 >>> 0;
  random.s2 = s2 >>> 0;
  random.s3 = s3 >>> 0;
}

/**
 * 2^-31: one step between neighbouring values of randomNextSigned.
 * (Internal. It sits up here because in these files a value has to be
 * written above the function that uses it.)
 */
const signedStep = 1 / 2147483648;

/**
 * The next number between -1 and 1, evenly spread. (-1 is possible,
 * 1 is not, in steps of 2^-31: far finer than a 32-bit audio sample.)
 */
export function randomNextSigned(random: NoiseRandom): number {
  randomNext(random);
  return random.out * signedStep - 1;
}

/**
 * Fills the first `count` places of `out` with numbers between -1 and 1, the
 * same ones `count` calls to randomNextSigned would give, in the same order.
 * chainRender asks for a whole stretch at once (three per sample: white,
 * pink, brown) instead of one at a time, so the sound loop itself only reads
 * from a list. Creates nothing new in memory.
 *
 * It is randomNext written out in a loop, with the generator's memory in
 * local variables (cheaper on the phone; see chainRender in ReceiverChain.ts).
 * A test checks it gives exactly what randomNextSigned gives.
 */
export function noiseFillRandoms(random: NoiseRandom, out: Float64Array, count: number): void {
  let s0 = random.s0;
  let s1 = random.s1;
  let s2 = random.s2;
  let s3 = random.s3;
  let raw = random.out;
  for (let i = 0; i < count; i += 1) {
    const times5 = Math.imul(s1, 5);
    raw = Math.imul((times5 << 7) | (times5 >>> 25), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = (s3 << 11) | (s3 >>> 21);
    out[i] = raw * signedStep - 1;
  }
  random.s0 = s0 >>> 0;
  random.s1 = s1 >>> 0;
  random.s2 = s2 >>> 0;
  random.s3 = s3 >>> 0;
  random.out = raw;
}

// MARK: The three colors

// LOCKED SOUND CONSTANTS: the three scale numbers just below, brownMemory, and
// the pink filter numbers inside noiseNext. They must match the Swift app
// exactly, and a test checks it. DO NOT TUNE HERE. To change the color or
// level of the static, use Tuning.hotStatic and Tuning.coldStatic (the mix of
// colors, and a level for each) and Tuning.staticVolume (the overall level) in
// Tuning.ts.

/** Loudness matching so white comes out about as loud as the others. Measured, not derived: see the noise tests. Locked. */
export const whiteScale = 0.52;
/** Same, for pink. Locked. */
export const pinkScale = 0.169;
/** Same, for brown. Locked. */
export const brownScale = 0.514;

/**
 * How much each brown sample remembers the last one. Just under 1 makes a
 * rumble that can't drift away; the "leak" sits at about 38 Hz at 48 kHz.
 * Locked, see above.
 */
export const brownMemory = 0.995;

/**
 * The state of the static generator: the latest sample of each color, plus
 * the memory the filters need between samples. Make one with createNoiseSource
 * and step it with noiseNext. (`interface` just lists the fields an object has.)
 */
export interface NoiseSource {
  /** The latest sample of each color. noiseNext refreshes these three. */
  white: number;
  pink: number;
  brown: number;

  /** Internal. Where the random numbers come from. */
  random: NoiseRandom;

  // Internal. Pink filter memory (Paul Kellet's "refined" pink filter: seven
  // gentle filters summed, accurate to within 0.05 dB across the audio band).
  // One memory slot per filter; b6 holds the previous sample's random number (scaled).
  b0: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
  b5: number;
  b6: number;
  // Internal. Brown filter memory.
  brownState: number;
}

export function createNoiseSource(seed: number): NoiseSource {
  return {
    white: 0,
    pink: 0,
    brown: 0,
    random: createNoiseRandom(seed),
    b0: 0,
    b1: 0,
    b2: 0,
    b3: 0,
    b4: 0,
    b5: 0,
    b6: 0,
    brownState: 0,
  };
}

/**
 * The filtering half of noiseNext: turns three random numbers (white, pink,
 * brown, each -1...1) into the next sample of each color, stored in
 * noise.white, noise.pink and noise.brown. chainRender does these same sums
 * written out in its loop; if you change this, change chainRender to match.
 *
 * The pink filter numbers below are locked (see "LOCKED SOUND CONSTANTS"
 * above): do not tune here.
 */
export function noiseShape(noise: NoiseSource, w: number, p: number, b: number): void {
  noise.b0 = 0.99886 * noise.b0 + p * 0.0555179;
  noise.b1 = 0.99332 * noise.b1 + p * 0.0750759;
  noise.b2 = 0.96900 * noise.b2 + p * 0.1538520;
  noise.b3 = 0.86650 * noise.b3 + p * 0.3104856;
  noise.b4 = 0.55000 * noise.b4 + p * 0.5329522;
  noise.b5 = -0.7616 * noise.b5 - p * 0.0168980;
  const pink =
    noise.b0 + noise.b1 + noise.b2 + noise.b3 + noise.b4 + noise.b5 + noise.b6 + p * 0.5362;
  noise.b6 = p * 0.115926;

  // Brown: each sample is mostly the last one plus a little new noise.
  noise.brownState = brownMemory * noise.brownState + b * 0.1;

  noise.white = w * whiteScale;
  noise.pink = pink * pinkScale;
  noise.brown = noise.brownState * brownScale;
}

/**
 * Makes all three colors at once, one sample of each. Each color is filtered
 * from its own fresh random numbers, so the three are independent of each
 * other (if they shared one stream they'd partly move together and the mix
 * would come out louder than its `level` says). Each comes out at about the
 * same loudness (RMS ~0.3), so the temperature weights alone decide the mix.
 * Afterwards read them from noise.white, noise.pink and noise.brown (nothing
 * is handed back, so nothing new is created in memory on the audio thread).
 */
export function noiseNext(noise: NoiseSource): void {
  const w = randomNextSigned(noise.random); // for white
  const p = randomNextSigned(noise.random); // for pink
  const b = randomNextSigned(noise.random); // for brown
  noiseShape(noise, w, p, b);
}

// MARK: Temperature

/**
 * A noise temperature: how much of each color, and how loud.
 * Tuning.ts holds the two presets (hot for moving days, cold for Still days).
 */
export interface NoiseColor {
  white: number;
  pink: number;
  brown: number;
  /** Overall loudness of this temperature. 1 = the reference level. */
  level: number;
}

export function createNoiseColor(
  white: number,
  pink: number,
  brown: number,
  level: number,
): NoiseColor {
  return { white: white, pink: pink, brown: brown, level: level };
}

/**
 * Somewhere to put three loudnesses, one per color. noiseColorGains writes
 * into one of these. Anything with these three fields will do (a
 * ReceiverTargets has them, and so does a NoiseColor).
 */
export interface NoiseGains {
  white: number;
  pink: number;
  brown: number;
}

/**
 * How loud each color plays, written into `out`. The weights only set the
 * color: they're rescaled so the mix is equally loud whatever they are, and
 * `level` alone sets how loud it is. (0.5, 0.5, 0) and (1, 1, 0) sound the same.
 * (Exact because the three colors are independent: independent noises
 * add by power, so dividing by the square root of the summed squares works.)
 */
export function noiseColorGains(color: NoiseColor, out: NoiseGains): void {
  const power = Math.sqrt(
    color.white * color.white + color.pink * color.pink + color.brown * color.brown,
  );
  // Written as !(power > 0), not power <= 0, on purpose: it is also true when
  // power is NaN ("not a number"), which `power <= 0` would let through.
  // Don't tidy it into `<= 0`.
  if (!(power > 0)) {
    out.white = 0;
    out.pink = 0;
    out.brown = 0;
    return;
  }
  const scale = color.level / power;
  // (Worked out first, then stored, so it's still right if `out` and `color`
  // are the same object.)
  const white = color.white * scale;
  const pink = color.pink * scale;
  const brown = color.brown * scale;
  out.white = white;
  out.pink = pink;
  out.brown = brown;
}

/** Part way from `cold` to `hot`, written into `out`. t = 0 is cold, 1 is hot. */
export function noiseColorBetween(
  out: NoiseColor,
  cold: NoiseColor,
  hot: NoiseColor,
  t: number,
): void {
  out.white = cold.white + (hot.white - cold.white) * t;
  out.pink = cold.pink + (hot.pink - cold.pink) * t;
  out.brown = cold.brown + (hot.brown - cold.brown) * t;
  out.level = cold.level + (hot.level - cold.level) * t;
}
