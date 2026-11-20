// The "centered on a feature" pulse logic. It runs on the screen's animation
// thread alongside DialPhysics (see src/dial/DialModel.ts), not on the audio
// thread. The 'worklet' line below marks these functions as allowed to run there.
'worklet';

import { Tuning } from './Tuning';

// RULE: a helper function (or a constant) has to be written ABOVE the first
// place it is used. If the order is wrong the code still works on a computer
// but the phone app breaks, because the build step that prepares worklet code
// needs it. (One test, DeclarationOrder, checks the order for you.)
//
// lockUpdate changes the LockDetector object you hand it, in place, rather
// than returning a new one.

/**
 * Decides when to play the "centered on a feature" pulse.
 *
 * It fires once when the wheel arrives on a feature's center, or spins
 * straight across it, and not again until the wheel has moved away
 * (Tuning.lockRelease) and come back. Sitting on the center doesn't repeat it.
 */
export interface LockDetector {
  /**
   * True from the pulse until the wheel moves away again.
   * (Read it freely; only lockUpdate changes it.)
   */
  isLocked: boolean;
  /** Internal. Last frame's distance, to notice a fast spin jumping across the center. */
  previous: number | null;
}

/** Makes a detector that is not locked and has seen no distance yet. */
export function createLockDetector(): LockDetector {
  return { isLocked: false, previous: null };
}

/**
 * Any jump bigger than this between two frames is the distance wrapping
 * round the far side of the loop, not a crossing. A quarter of the band in
 * detents is far more than one frame of the fastest flick covers.
 * (Internal. It sits above lockUpdate because of the RULE at the top.)
 */
const farSideOfTheLoop = 0.25 / Tuning.detentSpacing;

/**
 * Feed it the distance from the wheel to the feature, in detents, once a frame.
 * Returns true on the frame the pulse should play.
 * It fires when the wheel is within Tuning.lockDistance of the center, or when
 * the sign of the distance flips by a small jump (the wheel spun across the
 * center). While locked it returns false.
 */
export function lockUpdate(lock: LockDetector, detentsAway: number): boolean {
  const distance = detentsAway;

  // Remember this frame's distance for next time. The old one is copied out
  // first, because the rest of this function still needs last frame's value.
  const previous = lock.previous;
  lock.previous = distance;

  if (lock.isLocked) {
    if (Math.abs(distance) > Tuning.lockRelease) {
      lock.isLocked = false;
    }
    return false;
  }

  // A fast spin can jump from one side to the other between frames without
  // ever landing near the center. A change of sign means it crossed.
  // (Small jumps only: the distance also flips sign on the far side of the loop.)
  const crossed =
    previous !== null &&
    (previous < 0) !== (distance < 0) &&
    Math.abs(previous - distance) < farSideOfTheLoop;

  if (Math.abs(distance) <= Tuning.lockDistance || crossed) {
    lock.isLocked = true;
    return true;
  }
  return false;
}
