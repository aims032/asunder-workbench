// THE SWIFT APP'S RANDOM NUMBERS, kept for the Swift comparison test only.
//
// The app used to make the static from this generator (xorshift64*, Vigna
// 2014), done in two 32-bit halves so it matched the Swift app bit for bit.
// It was slow on the phone (about half the sound loop's time), so on Nov 20
// the app switched to a 32-bit generator (xoshiro128**, see Noise.ts). The
// hiss was never meant to match between phones, only everything that shapes
// it.
//
// This copy stays so SwiftParity.test.ts can still check the rest of the
// chain against the Swift app: it feeds the chain these exact numbers
// (through chainRenderWith) and compares every sample. It is checked
// against the Swift app's own numbers too (the noiseRandom section).
// Never use it in the app.

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
export interface SwiftRandom {
  /** Internal. The generator's 64-bit memory, as two 32-bit halves. */
  hi: number;
  lo: number;
  /** The raw 64-bit number made by the latest swiftRandomNext, as two 32-bit halves. */
  outHi: number;
  outLo: number;
}

/** `seed` is a whole number from 0 up to 2^53 (9007199254740992). */
export function createSwiftRandom(seed: number): SwiftRandom {
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
export function swiftRandomNext(random: SwiftRandom): void {
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
export function swiftRandomNextSigned(random: SwiftRandom): number {
  swiftRandomNext(random);
  // The top 53 bits make a number in 0..<1, then stretch to -1..<1.
  // (All 32 bits of the high half, then the top 21 bits of the low half.
  // 2097152 is 2^21 and 9007199254740992 is 2^53.)
  const top53 = random.outHi * 2097152 + (random.outLo >>> 11);
  return (top53 / 9007199254740992) * 2 - 1;
}

/**
 * Fills the first `count` places of `out` with numbers between -1 and 1, the
 * same ones `count` calls to swiftRandomNextSigned would give, in the same order.
 * chainRender asks for a whole stretch at once (three per sample: white,
 * pink, brown) instead of one at a time, so the sound loop itself only reads
 * from a list. Creates nothing new in memory.
 */
export function swiftFillRandoms(random: SwiftRandom, out: Float64Array, count: number): void {
  for (let i = 0; i < count; i += 1) {
    out[i] = swiftRandomNextSigned(random);
  }
}
