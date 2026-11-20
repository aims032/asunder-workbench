// Small number helpers. The clock and band functions are built on them, and
// those run on the audio thread (see src/audio); the screen's dial and display
// code use them too. The 'worklet' line below marks these functions as allowed
// to run on a thread other than the main one.
'worklet';

// RULE: a helper function has to be written ABOVE the first place it is used.
// If the order is wrong the code still works on a computer but the phone app
// breaks, because the build step that prepares worklet code needs it. (One
// test, DeclarationOrder, checks the order for you. These helpers sit at the
// bottom of the code chain, so they use no other helpers.)

// The band is a loop: positions run 0..<1 and wrap around.
// This is the one function everything else uses to keep a position on the loop.

/**
 * Folds any number back onto the loop 0..<1.
 * 1.25 → 0.25, -0.1 → 0.9, 3.0 → 0.0.
 */
export function wrapUnit(x: number): number {
  const r = x - Math.floor(x); // fractional part, always 0..<1 for finite x
  return r >= 1 ? 0 : r; // guards a float edge case where r rounds up to exactly 1
}

// NUMBER HELPERS
//
// The Swift app this was ported from rounds numbers slightly
// differently from JavaScript. These two helpers keep the answers identical to
// the Swift ones. (JavaScript has one kind of number, so there is no separate
// "whole number" type here; a whole number is just a number with nothing after
// the point.)

/**
 * Rounds to the nearest whole number. A number exactly halfway (like 2.5 or
 * -2.5) goes AWAY from zero: 2.5 → 3, -2.5 → -3.
 * JavaScript's own Math.round sends halves upward instead (-2.5 → -2), which
 * would put the notches in slightly different places below zero.
 *
 * How: drop what's after the point (Math.trunc), then look at what was
 * dropped. If it was a half or more, step one further from zero.
 * (Written out by hand, not with Math.round, so it gives exactly the same
 * answer in every JavaScript engine: the phone's, the browser's, the tests'.)
 */
export function roundHalfAwayFromZero(x: number): number {
  const whole = Math.trunc(x);
  const dropped = Math.abs(x - whole);
  if (dropped < 0.5) {
    return whole;
  }
  return x < 0 ? whole - 1 : whole + 1;
}

/**
 * Turns a number into a whole number by dropping whatever is after the point
 * (3.9 → 3, -3.9 → -3). Used wherever a count or an index is needed.
 * The `+ 0` is for one JavaScript oddity: it has a "negative zero" (-0) that
 * prints as 0 but isn't quite the same thing. Adding 0 turns it into plain 0.
 */
export function toInteger(x: number): number {
  return Math.trunc(x) + 0;
}
