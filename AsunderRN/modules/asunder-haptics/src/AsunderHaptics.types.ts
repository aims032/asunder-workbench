/** What the native haptics module can do (see the Swift and Kotlin files next door). */
export type AsunderHapticsNative = {
  /**
   * Make a fresh haptic engine and start it. Call it each time the sound
   * starts (see Haptics.ts). False if this device has no haptic motor.
   */
  prepare(): boolean;
  /** A short click. Both numbers are 0...1. */
  tick(intensity: number, sharpness: number): void;
  /** A rounder, longer pulse. Intensity and sharpness are 0...1. */
  lock(intensity: number, sharpness: number, durationSeconds: number): void;
};
