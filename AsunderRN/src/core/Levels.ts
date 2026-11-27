// LEVELS: two small tools the analyzer and the voiceprints both use. They
// live in their own file so those two can share them without importing each
// other (two files must never import each other).
//
// (Math.imul is 32-bit multiplication; `>>>` is a bit shift.)
'worklet';

/**
 * A whole number made from two whole numbers, well mixed: change either input
 * by 1 and the output changes completely. It's a "hash", not a random number
 * generator: the same two inputs always give the same output, which is what
 * keeps the grass identical on every phone.
 * (Math.imul is 32-bit multiplication; `>>>` is a bit shift.)
 */
export function analyzerHash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0; // 0 up to 2^32 - 1
}

/** dB to plain power, and back. */
export function dbToPower(db: number): number {
  return Math.pow(10, db / 10);
}

export function powerToDb(power: number): number {
  // A floor so silence is a very low number rather than minus infinity.
  return 10 * Math.log10(Math.max(power, 1e-30));
}

