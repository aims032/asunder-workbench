// The wheel's physics. It runs on the screen's animation thread (see
// src/dial/DialModel.ts), so the dial can follow a finger smoothly. It is NOT
// used by the audio thread. The 'worklet' line below is what marks these
// functions as allowed to run on that thread.
'worklet';

import type { BandPosition } from './BandModel';
import { bandDistance, bandPosition } from './BandModel';
import { Tuning } from './Tuning';
import { roundHalfAwayFromZero, toInteger } from './Wrap';

// READING THIS FILE (TypeScript notes, explained once here)
//
// `export` in front of a function, type or constant means other files may
// import it. Without it, the thing is private to this file.
//
// An `interface` is a list of the named parts a thing has, and what kind of
// value each one holds. DialPhysics (below) lists the parts of the dial.
//
// `number | null` means "a number, or nothing". null is how a value says
// "not set yet". The code checks `!== null` before using such a value.
//
// The functions here change the dial object you hand them, in place. They
// don't return a new copy. (In JavaScript an object passed to a function is
// shared, not copied.)
//
// RULE: a helper function has to be written ABOVE the first place it is
// used. If the order is wrong the code still works on a computer but the
// phone app breaks, because the build step that prepares worklet code needs it.
// (One test, DeclarationOrder, checks the order for you.)
//
// NaN GUARDS: you will see `!(x > 0)` in two places below. NaN means "not a
// number" (what you get from, say, 0 / 0). Every comparison with NaN is
// false, so `x <= 0` would be false for NaN and let it through, while
// `!(x > 0)` is true for NaN and stops it. Don't tidy it into `x <= 0`.

/**
 * The physics of the tuning wheel: inertia, friction, notches, and the
 * lagging needle. No drawing and no touch handling here, just the motion,
 * so it can be tested anywhere and any dial form (wheel, knob) can share it.
 *
 * Positions are in band fractions and are NOT wrapped: spin forward forever
 * and `position` keeps climbing (3.25 means three laps plus a quarter).
 * That keeps the motion smooth across the seam. Use dialBand / dialNeedleBand
 * when you want the place on the loop.
 *
 * How it's driven, once per screen frame:
 *     dialGrab(dial)            finger down: the wheel stops dead under it
 *     dialDrag(dial, delta)     finger moved: the wheel follows it exactly
 *     dialRelease(dial)         finger up: the wheel keeps the finger's speed
 *     dialStep(dial, dt)        time passes: coast, slow down, settle into a notch
 *
 * Read the first four fields freely, but only change them through the
 * functions in this file. `snapPoints` is the one field the app sets itself.
 */
export interface DialPhysics {
  /** Where the wheel is (unwrapped band fraction). */
  position: number;
  /** How fast it's turning (band fractions per second). 0 when held still or stopped. */
  velocity: number;
  /** Where the needle/readout is. Chases `position` with a slight lag. */
  needle: number;
  /** True while a finger is on the wheel. */
  isHeld: boolean;

  /**
   * Places the wheel snaps onto when it comes to rest nearby (feature centers).
   * The app keeps this up to date; see Tuning.snapToFeature.
   */
  snapPoints: BandPosition[];

  /** Internal. The notch the wheel is easing into after it slowed down, if any. */
  settleTarget: number | null;
  /** Internal. Finger movement since the last step, used to measure flick speed. */
  pendingDrag: number;
}

/**
 * Makes a dial resting at `start` (an unwrapped band fraction): not held, not
 * moving, with no snap points yet.
 */
export function createDialPhysics(start: number): DialPhysics {
  return {
    position: start,
    velocity: 0,
    needle: start,
    isHeld: false,
    snapPoints: [],
    settleTarget: null,
    pendingDrag: 0,
  };
}

// MARK: Reading it

/** Where the wheel is on the loop (wrapped to 0..<1). */
export function dialBand(dial: DialPhysics): BandPosition {
  return bandPosition(dial.position);
}

/** Where the needle is on the loop (wrapped to 0..<1). */
export function dialNeedleBand(dial: DialPhysics): BandPosition {
  return bandPosition(dial.needle);
}

/** Which notch a position is nearest (see dialDetentIndex, just below). */
export function dialDetentIndexOf(position: number): number {
  return toInteger(roundHalfAwayFromZero(position / Tuning.detentSpacing));
}

/**
 * Which notch the wheel is nearest. Changes halfway between notches,
 * which is where a real detent clicks (going over the hump).
 */
export function dialDetentIndex(dial: DialPhysics): number {
  return dialDetentIndexOf(dial.position);
}

/**
 * Nothing is moving: no finger, no spin, no settling, needle caught up.
 * The app can stop redrawing until the next touch.
 */
export function dialIsAtRest(dial: DialPhysics): boolean {
  return (
    !dial.isHeld && dial.velocity === 0 && dial.settleTarget === null && dial.needle === dial.position
  );
}

// MARK: Helpers
// (Internal: only the functions in this file use these. They sit above
// "Driving it" because of the RULE at the top.)

/**
 * The nearest snap point to `place`, if one is within Tuning.snapToFeature.
 * Returned unwrapped, on the same lap as `place`, so the wheel doesn't spin round to it.
 */
function dialSnapPointNear(dial: DialPhysics, place: number): number | null {
  const reach = Tuning.snapToFeature * Tuning.detentSpacing;
  let best: number | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < dial.snapPoints.length; i += 1) {
    const gap = bandDistance(bandPosition(place), dial.snapPoints[i]); // the short way round
    if (Math.abs(gap) <= reach && Math.abs(gap) < bestGap) {
      best = place + gap;
      bestGap = Math.abs(gap);
    }
  }
  return best;
}

/**
 * Start easing into a notch. Moving forward, take the next notch ahead
 * (no backwards jerk); with no direction (null), take the nearest one.
 * But if a feature's center is close to where the wheel is, settle on the
 * feature instead (lock-on snap).
 * Does nothing when notches are turned off (settleRate = 0).
 */
function dialBeginSettle(dial: DialPhysics, direction: number | null): void {
  // (!(x > 0) also catches NaN; see the NaN GUARDS note at the top.)
  if (!(Tuning.settleRate > 0)) {
    return;
  }
  const feature = dialSnapPointNear(dial, dial.position);
  if (feature !== null) {
    dial.settleTarget = feature;
    return;
  }
  const inDetents = dial.position / Tuning.detentSpacing;
  let notch: number;
  if (direction !== null && direction > 0) {
    notch = Math.ceil(inDetents);
  } else if (direction !== null && direction < 0) {
    notch = Math.floor(inDetents);
  } else {
    notch = roundHalfAwayFromZero(inDetents);
  }
  dial.settleTarget = notch * Tuning.detentSpacing;
}

/**
 * The share (0..1) of the remaining gap to close in `dt` seconds, for a smooth
 * chase. `tau` is the chase's time constant: after `tau` seconds it has closed
 * about 63% of the gap. A bigger tau is lazier; tau of 0 or less jumps straight
 * there (returns 1). Gives the same feel at 60 or 120 frames a second.
 */
function ease(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
}

// MARK: Driving it

/** Finger down: the wheel stops dead and any settling is cancelled. */
export function dialGrab(dial: DialPhysics): void {
  dial.isHeld = true;
  dial.velocity = 0;
  dial.settleTarget = null;
  dial.pendingDrag = 0;
}

/** The finger moved the wheel by `delta` (band fraction). Tracks exactly. */
export function dialDrag(dial: DialPhysics, delta: number): void {
  dial.position += delta;
  dial.pendingDrag += delta;
}

/**
 * Finger up. The wheel keeps the speed the finger had (capped at
 * Tuning.maxFlickSpeed). If that is slow, it drops into a notch (or onto a
 * nearby feature) instead.
 */
export function dialRelease(dial: DialPhysics): void {
  dial.isHeld = false;
  dial.pendingDrag = 0;
  const limit = Tuning.maxFlickSpeed * Tuning.detentSpacing;
  dial.velocity = Math.min(Math.max(dial.velocity, -limit), limit);

  // Let go slowly (or not moving): drop into the nearest notch.
  if (Math.abs(dial.velocity) < Tuning.settleSpeed * Tuning.detentSpacing) {
    dial.velocity = 0;
    dialBeginSettle(dial, null);
  }
}

/**
 * Advance time by `rawDt` seconds. A long pause (say the app was busy) is cut
 * down to Tuning.maxFrameStep so the wheel doesn't leap.
 */
export function dialStep(dial: DialPhysics, rawDt: number): void {
  const dt = Math.min(rawDt, Tuning.maxFrameStep);
  // Skip zero, negative or NaN time (see the NaN GUARDS note at the top).
  if (!(dt > 0)) {
    return;
  }

  if (dial.isHeld) {
    // Measure how fast the finger is moving, smoothed, so that on
    // release the wheel carries on at that speed. A finger that stops
    // and then lifts reads ~0, so it doesn't flick.
    const instant = dial.pendingDrag / dt;
    dial.velocity += (instant - dial.velocity) * ease(dt, Tuning.flickSmoothing);
    dial.pendingDrag = 0;
  } else if (dial.settleTarget !== null) {
    // Seating into a notch.
    const target = dial.settleTarget;
    dial.position += (target - dial.position) * ease(dt, 1 / Tuning.settleRate);
    if (Math.abs(target - dial.position) < Tuning.detentSpacing * 0.001) {
      dial.position = target;
      dial.settleTarget = null;
    }
  } else if (dial.velocity !== 0) {
    // Coasting: friction takes away a fixed share of speed each second.
    dial.velocity *= Math.exp(-Tuning.coastFriction * dt);
    dial.position += dial.velocity * dt;
    if (Math.abs(dial.velocity) < Tuning.settleSpeed * Tuning.detentSpacing) {
      const direction = dial.velocity;
      dial.velocity = 0;
      dialBeginSettle(dial, direction);
    }
  }

  // The needle chases the wheel.
  dial.needle += (dial.position - dial.needle) * ease(dt, Tuning.needleLag);
  if (!dial.isHeld && Math.abs(dial.position - dial.needle) < Tuning.detentSpacing * 0.001) {
    dial.needle = dial.position;
  }
}
