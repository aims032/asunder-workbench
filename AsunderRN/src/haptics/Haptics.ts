import AsunderHaptics from '../../modules/asunder-haptics';
import { Tuning } from '../core';

// The phone's vibration motor, used for two feels:
//   hapticTick(strength)  a short click each time the wheel passes a notch
//   hapticLock()          a rounder, longer pulse when you're centered on a feature
//
// Strength and sharpness live in Tuning.ts. If the phone has no haptic
// motor (or it fails to start), every call quietly does nothing.
//
// The actual buzzing is done by a small native module (modules/asunder-haptics),
// because React Native has no built-in haptic with a chosen strength.

/** Wake the haptic engine up, so the very first tick isn't late. */
export function prepareHaptics(): void {
  AsunderHaptics?.prepare();
}

/**
 * `strength` 0...1 is a share of the full tick. The tick comes in a few
 * strengths (Tuning.tickStrengthSteps), and the closest ready-made one plays.
 * Fast spins use the softer ones.
 */
export function hapticTick(strength: number = 1): void {
  const steps = Tuning.tickStrengthSteps;
  if (steps.length === 0) {
    return;
  }
  let best = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (Math.abs(steps[i] - strength) < Math.abs(steps[best] - strength)) {
      best = i;
    }
  }
  AsunderHaptics?.tick(Tuning.tickIntensity * steps[best], Tuning.tickSharpness);
}

export function hapticLock(): void {
  AsunderHaptics?.lock(Tuning.lockIntensity, Tuning.lockSharpness, Tuning.lockDuration);
}
