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
// sequence is 2^64 samples long (millions of years at 48 kHz).

// MARK: 64-bit numbers in two halves
//
// The random generator works on whole numbers 64 bits long. A JavaScript
// number can only hold a whole number exactly up to 53 bits, so each 64-bit
// number is kept as TWO ordinary numbers of 32 bits each:
//
//     hi = the top 32 bits        lo = the bottom 32 bits
//     the full number = hi * 4294967296 + lo        (4294967296 is 2^32)
//
// It's like doing sums on paper with two-digit numbers when the numbers have
// four digits: do the low pair, carry into the high pair. In the code below,
// `>>> 0` means "keep only the bottom 32 bits, as a positive number", and
// Math.imul multiplies two 32-bit numbers and keeps the bottom 32 bits.
// Done this way the sequence is exactly the Swift app's, bit for bit, and
// nothing is created in memory while it runs (so it's safe on the audio thread).
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
// Why this file needs them: they are the exact steps of the Swift app's
// generator, which does them on one 64-bit number. Here each step is done on
// the two 32-bit halves. The SwiftParity test checks the result bit for bit
// against Swift, so don't change any of it.

/**
 * The top 32 bits of a 32-bit × 32-bit multiply (the full answer has 64 bits,
 * too many to hold at once). Each number is cut into two 16-bit pieces and
 * multiplied the long way, piece by piece, so nothing ever gets too big.
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
 * Multiplies two 64-bit numbers (each given as hi and lo halves) and returns
 * the HIGH half of the answer. Bits past the 64th are dropped, like a car's
 * mileage counter rolling over.
 */
function multiply64High(aHi: number, aLo: number, bHi: number, bLo: number): number {
  return (multiplyHigh32(aLo, bLo) + Math.imul(aLo, bHi) + Math.imul(aHi, bLo)) >>> 0;
}

/** The LOW half of the same multiply. It only depends on the two low halves. */
function multiply64Low(aLo: number, bLo: number): number {
  return Math.imul(aLo, bLo) >>> 0;
}

// MARK: The random numbers

/**
 * A fast random number generator that is safe to run on the audio thread
 * (no locks, no memory allocation). Same seed, same sequence, on every machine.
 * This is xorshift64* (Vigna, 2014).
 */
export interface NoiseRandom {
  /** Internal. The generator's 64-bit memory, as two 32-bit halves. */
  hi: number;
  lo: number;
  /** The raw 64-bit number made by the latest randomNext, as two 32-bit halves. */
  outHi: number;
  outLo: number;
}

/** `seed` is a whole number from 0 up to 2^53 (9007199254740992). */
export function createNoiseRandom(seed: number): NoiseRandom {
  // Split the seed into its two halves.
  let hi = Math.floor(seed / 4294967296) >>> 0;
  let lo = seed >>> 0;

  // Scramble the seed (SplitMix64), so nearby seeds like 1 and 2 still give
  // unrelated sequences. The state must never be zero, or it gets stuck at zero.
  // Each step is written first as the 64-bit sum it performs (z is the number
  // held in hi and lo), then as the same sum on the two halves.

  // z = seed + 0x9E37_79B9_7F4A_7C15
  const lowSum = lo + 0x7f4a7c15;
  const carry = lowSum > 0xffffffff ? 1 : 0; // the low half overflowed: carry 1 up
  lo = lowSum >>> 0;
  hi = (hi + 0x9e3779b9 + carry) >>> 0;

  // z = (z ^ (z >> 30)) * 0xBF58_476D_1CE4_E5B9
  lo = (lo ^ ((lo >>> 30) | (hi << 2))) >>> 0;
  hi = (hi ^ (hi >>> 30)) >>> 0;
  let productHi = multiply64High(hi, lo, 0xbf58476d, 0x1ce4e5b9);
  lo = multiply64Low(lo, 0x1ce4e5b9);
  hi = productHi;

  // z = (z ^ (z >> 27)) * 0x94D0_49BB_1331_11EB
  lo = (lo ^ ((lo >>> 27) | (hi << 5))) >>> 0;
  hi = (hi ^ (hi >>> 27)) >>> 0;
  productHi = multiply64High(hi, lo, 0x94d049bb, 0x133111eb);
  lo = multiply64Low(lo, 0x133111eb);
  hi = productHi;

  // z ^= z >> 31
  lo = (lo ^ ((lo >>> 31) | (hi << 1))) >>> 0;
  hi = (hi ^ (hi >>> 31)) >>> 0;

  // state = z == 0 ? 0x2545_F491_4F6C_DD1D : z
  if (hi === 0 && lo === 0) {
    hi = 0x2545f491;
    lo = 0x4f6cdd1d;
  }
  return { hi: hi, lo: lo, outHi: 0, outLo: 0 };
}

/**
 * The next raw 64-bit number. It's left in random.outHi and random.outLo
 * (two halves) instead of being handed back, because handing back two
 * numbers at once would create a new object on every call.
 */
export function randomNext(random: NoiseRandom): void {
  let hi = random.hi;
  let lo = random.lo;

  // state ^= state >> 12
  lo = (lo ^ ((lo >>> 12) | (hi << 20))) >>> 0;
  hi = (hi ^ (hi >>> 12)) >>> 0;
  // state ^= state << 25
  hi = (hi ^ ((hi << 25) | (lo >>> 7))) >>> 0;
  lo = (lo ^ (lo << 25)) >>> 0;
  // state ^= state >> 27
  lo = (lo ^ ((lo >>> 27) | (hi << 5))) >>> 0;
  hi = (hi ^ (hi >>> 27)) >>> 0;

  random.hi = hi;
  random.lo = lo;

  // return state * 0x2545_F491_4F6C_DD1D
  //
  // This is multiply64High and multiply64Low (above), written out in place
  // instead of called. This runs three times per sample on the audio thread,
  // and on the phone each function call costs time (see chainRender in
  // ReceiverChain.ts). The steps and their order are exactly the same, so the
  // numbers are the same bit for bit. The multiplier's two halves are
  // 0x2545f491 (high) and 0x4f6cdd1d (low); the low half is cut into its two
  // 16-bit pieces once, as the constants 0xdd1d and 0x4f6c.
  //   multiplyHigh32(lo, 0x4f6cdd1d):
  const loLow = lo & 0xffff;
  const loHigh = lo >>> 16;
  const lowLow = loLow * 0xdd1d;
  const middle = loHigh * 0xdd1d + loLow * 0x4f6c + (lowLow >>> 16);
  const high32 = loHigh * 0x4f6c + Math.floor(middle / 65536);
  //   multiply64High(hi, lo, 0x2545f491, 0x4f6cdd1d) and multiply64Low(lo, 0x4f6cdd1d):
  random.outHi = (high32 + Math.imul(lo, 0x2545f491) + Math.imul(hi, 0x4f6cdd1d)) >>> 0;
  random.outLo = Math.imul(lo, 0x4f6cdd1d) >>> 0;
}

/** The next number between -1 and 1, evenly spread. */
export function randomNextSigned(random: NoiseRandom): number {
  randomNext(random);
  // The top 53 bits make a number in 0..<1, then stretch to -1..<1.
  // (All 32 bits of the high half, then the top 21 bits of the low half.
  // 2097152 is 2^21 and 9007199254740992 is 2^53.)
  const top53 = random.outHi * 2097152 + (random.outLo >>> 11);
  return (top53 / 9007199254740992) * 2 - 1;
}

/**
 * Fills the first `count` places of `out` with numbers between -1 and 1, the
 * same ones `count` calls to randomNextSigned would give, in the same order.
 * chainRender asks for a whole stretch at once (three per sample: white,
 * pink, brown) instead of one at a time, so the sound loop itself only reads
 * from a list. Creates nothing new in memory.
 */
export function noiseFillRandoms(random: NoiseRandom, out: Float64Array, count: number): void {
  for (let i = 0; i < count; i += 1) {
    out[i] = randomNextSigned(random);
  }
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
