// Works out what the receiver should sound like at a given dial position and time.
// receptionTargets runs on the audio thread (see src/audio), once per block of
// samples (not once per sample).
//
// The `'worklet';` line below marks every function in this file as safe to copy
// over to the audio thread, which runs its own separate copy of the code.
// It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used. Put it below and the code still works on a computer, but it
// breaks on the phone. (One test, DeclarationOrder, checks the order for you.)
'worklet';

import type { AsunderClock, DayRule } from './AsunderClock';
import { clockRule, clockSecondsIntoDay, dayRuleIsStill, SECONDS_PER_DAY } from './AsunderClock';
import { bandPosition } from './BandModel';
import {
  carrierClarity,
  carrierDetentsAway,
  carrierIsOnAir,
  carrierPitch,
  carrierStrength,
} from './Carrier';
import type { NoiseColor } from './Noise';
import { createNoiseColor, noiseColorBetween, noiseColorGains } from './Noise';
import { Tuning } from './Tuning';
import { World } from './World';

// WHAT THE RECEIVER SHOULD SOUND LIKE RIGHT NOW
//
// Two inputs: where the dial is, and what time it is. Out comes a handful of
// numbers (ReceiverTargets) that the sound engine glides toward. All of it is
// computed from the shared clock, so every phone tuned to the same spot at the
// same moment gets the same numbers.
//
// (In these files a helper has to be written above the function that uses it,
// so in each pair below the small helper comes first.)

// How hot the static runs, 0...1: 1 on moving days, 0 on Still days
// (Instruments §2; physics reading, Confirmed Nov 19).

/** Moving days are hot, Still days are cold. */
export function noiseTemperatureOf(rule: DayRule): number {
  return dayRuleIsStill(rule) ? 0 : 1;
}

/**
 * Right after each day turn it glides from yesterday's temperature to
 * today's over World.temperatureGlideSeconds.
 */
export function noiseTemperatureAt(nowSeconds: number, clock: AsunderClock): number {
  const today = noiseTemperatureOf(clockRule(clock, nowSeconds));
  const secondsIn = clockSecondsIntoDay(clock, nowSeconds);
  const glide = World.temperatureGlideSeconds;
  // "Not gliding" is when glide isn't a positive number, or the glide is over.
  // Written as !(x > 0 && ...), it also returns `today` for NaN ("not a number"),
  // because a NaN makes every <, >, <= and >= comparison false. Don't
  // tidy it into `glide <= 0 || secondsIn >= glide`: NaN would slip through
  // that and the NaN would spread into the sound.
  if (!(glide > 0 && secondsIn < glide)) {
    return today;
  }

  const yesterday = noiseTemperatureOf(clockRule(clock, nowSeconds - SECONDS_PER_DAY));
  const t = secondsIn / glide; // how far through the glide, 0 to 1
  const eased = t * t * (3 - 2 * t); // starts and ends gently (a "smoothstep")
  return yesterday + (today - yesterday) * eased;
}

/** Where every control of the sound should be. The engine eases toward these. */
export interface ReceiverTargets {
  /** Static: how loud each color plays (temperature, quieting and volume applied). */
  white: number;
  pink: number;
  brown: number;
  /** The Carrier: how loud, 0...1, and the whistle's pitch in Hz. */
  carrierLevel: number;
  carrierPitch: number;
  /** The EQ path: the band of frequencies let through, in Hz. */
  highpassHz: number;
  lowpassHz: number;

  /**
   * Internal. Working space for receptionTargets: the static's color before
   * it's turned into the three loudnesses above. Kept here so that working
   * the targets out never creates anything new in memory.
   */
  scratchColor: NoiseColor;
}

/**
 * Makes a ReceiverTargets with everything at zero. Make ONE and reuse it:
 * receptionTargets fills it in again each time.
 */
export function createReceiverTargets(): ReceiverTargets {
  return {
    white: 0,
    pink: 0,
    brown: 0,
    carrierLevel: 0,
    carrierPitch: 0,
    highpassHz: 0,
    lowpassHz: 0,
    scratchColor: createNoiseColor(0, 0, 0, 0),
  };
}

/** Part way from `a` Hz to `b` Hz, measured in octaves rather than Hz. */
export function receptionBlendHz(a: number, b: number, t: number): number {
  return a * Math.pow(b / a, t);
}

/**
 * The targets for a dial position (unwrapped is fine) at a moment, written
 * into `out`. Cheap and allocation-free, so the audio thread calls it every buffer.
 */
export function receptionTargets(
  out: ReceiverTargets,
  dial: number,
  nowSeconds: number,
  clock: AsunderClock,
): void {
  // `dial` may be any number (it keeps counting up or down as you spin); bandPosition
  // wraps it into the band's 0 to 1 loop.
  const detents = carrierDetentsAway(bandPosition(dial));

  // During the day-turn dropout the Carrier is gone, so it's as if it weren't there.
  const onAir = carrierIsOnAir(nowSeconds, clock) ? 1.0 : 0.0;
  const strength = onAir * carrierStrength(detents);
  const clarity = onAir * carrierClarity(detents);

  // The static: today's temperature, quieted by a clear carrier.
  const temperature = noiseTemperatureAt(nowSeconds, clock);
  const color = out.scratchColor;
  noiseColorBetween(color, Tuning.coldStatic, Tuning.hotStatic, temperature);
  color.level *= Tuning.staticVolume * (1 - Tuning.carrierQuieting * clarity);
  noiseColorGains(color, out); // fills in out.white, out.pink and out.brown

  // The EQ path opens with clarity. Frequencies are blended on a musical
  // (logarithmic) scale, so halfway open sounds halfway.
  const highpass = receptionBlendHz(Tuning.closedHighpassHz, Tuning.openHighpassHz, clarity);
  const lowpass = receptionBlendHz(Tuning.closedLowpassHz, Tuning.openLowpassHz, clarity);

  // Phone speakers barely play low notes, so dead on, where the whistle
  // has slid down to the hum, it gets a lift to stay the loudest point.
  const humLift = 1 + Tuning.humBoost * clarity;

  // Write the results into `out` (nothing is created or returned).
  out.carrierLevel = Tuning.carrierVolume * strength * humLift;
  out.carrierPitch = carrierPitch(detents);
  out.highpassHz = highpass;
  out.lowpassHz = lowpass;
}
