// The Carrier: where it sits on the band, how loud and what pitch it is from a given
// dial position, and the oscillator that makes its tone. oscillatorNext runs on the
// audio thread (see src/audio). The others are used by receptionTargets (audio
// thread) and two of them, carrierDetentsAway and carrierIsOnAir, by DialModel too.
//
// The `'worklet';` line below marks every function in this file as safe to copy
// over to the audio thread, which runs its own separate copy of the code.
// It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used. Put it below and the code still works on a computer, but it
// breaks on the phone. (One test, DeclarationOrder, checks the order for you.)
'worklet';

// A note on bad numbers. NaN ("not a number") is what maths like 0 / 0 gives.
// A comparison with NaN (<, >, >=) is always false, so carrierIsOnAir would read
// a NaN time as "in the dropout" (silent), and oscillatorNext would drop the
// harmonics for a NaN pitch. But the oscillator's phase would still go NaN and
// stay NaN, so the caller must keep NaN out; src/audio checks each block for it.

import type { AsunderClock } from './AsunderClock';
import { clockSecondsIntoDay } from './AsunderClock';
import type { BandPosition } from './BandModel';
import { bandDistance, bellStrength } from './BandModel';
import { Tuning } from './Tuning';
import { World } from './World';

// The Carrier: a faint tone at a fixed place on the band (Instruments §3).
// It never moves. Every day turn it drops out for a moment, on every phone at once.
//
// You hear it as a zero-beat whistle, like tuning a shortwave set: off to the
// side it's a high whistle, and as you tune toward it the pitch slides down,
// settling to a low hum dead on center (Confirmed Nov 19).

/** Where it lives. See World.ts. */
export function carrierPosition(): BandPosition {
  return World.carrierPosition;
}

/**
 * How far the dial is from the Carrier, in detents. Positive = the Carrier
 * is above the dial. Takes the short way round the loop.
 */
export function carrierDetentsAway(dial: BandPosition): number {
  return bandDistance(dial, carrierPosition()) / Tuning.detentSpacing;
}

/** False during the dropout right after each day turn. */
export function carrierIsOnAir(nowSeconds: number, clock: AsunderClock): boolean {
  return clockSecondsIntoDay(clock, nowSeconds) >= World.carrierDropoutSeconds;
}

/** How loud it is from `detentsAway` away, 0...1 (a bell curve, Tuning.carrierWidth wide). */
export function carrierStrength(detentsAway: number): number {
  return bellStrength(detentsAway, Tuning.carrierWidth);
}

/**
 * How "clear" the reception is from `detentsAway` away, 0...1: how far the
 * EQ path opens and the hiss quiets. A narrower bell (Tuning.clearWidth).
 */
export function carrierClarity(detentsAway: number): number {
  return bellStrength(detentsAway, Tuning.clearWidth);
}

/**
 * The whistle's pitch from `detentsAway` away, in Hz. The further off, the higher;
 * the same on either side. Dead on, it's the hum.
 */
export function carrierPitch(detentsAway: number): number {
  return Tuning.humHz + Tuning.whistleHzPerDetent * Math.abs(detentsAway);
}

/**
 * The oscillator that makes the Carrier's tone: a sine with a little 2nd and
 * 3rd harmonic. The pitch can change every sample and the waveform stays smooth.
 */
export interface CarrierOscillator {
  /** Internal. Where in its cycle the wave is: 0 up to, but not including, 1. */
  phase: number;
}

export function createCarrierOscillator(): CarrierOscillator {
  return { phase: 0 };
}

/**
 * The next sample at `pitch` Hz, between -1 and 1.
 * Called once per sample on the audio thread (from chainRender), so it only
 * does plain arithmetic and creates nothing new. It changes `oscillator.phase`.
 */
export function oscillatorNext(
  oscillator: CarrierOscillator,
  pitch: number,
  sampleRate: number,
): number {
  // An overtone above half the sample rate (the "Nyquist" limit) can't be played;
  // it would fold back down as a wrong note ("aliasing"). Drop any that would.
  // Each harmonic's loudness is a Tuning knob (carrierSecondHarmonic and
  // carrierThirdHarmonic); here it is set to 0 when it would be too high.
  const nyquist = sampleRate / 2;
  const h2 = 2 * pitch < nyquist ? Tuning.carrierSecondHarmonic : 0;
  const h3 = 3 * pitch < nyquist ? Tuning.carrierThirdHarmonic : 0;
  const angle = 2 * Math.PI * oscillator.phase;
  const wave = Math.sin(angle) + h2 * Math.sin(2 * angle) + h3 * Math.sin(3 * angle);

  oscillator.phase += pitch / sampleRate;
  // Subtracting the whole-number part wraps the phase back into 0 up to 1, so it
  // never grows large enough to lose precision.
  oscillator.phase -= Math.floor(oscillator.phase);

  // 1 + h2 + h3 is the most the three sines can add up to, so dividing by it
  // keeps the result within -1...1.
  return wave / (1 + h2 + h3);
}
