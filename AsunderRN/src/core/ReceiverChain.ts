// The receiver's whole signal chain. On the phone, chainRender runs on the audio thread (see src/audio).
//
// The `'worklet';` line below marks every function in this file as safe to copy
// over to the audio thread, which runs its own separate copy of the code.
// It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used. Put it below and the code still works on a computer, but it
// breaks on the phone. (One test, DeclarationOrder, checks the order for you.)
'worklet';

// JavaScript idioms used here (explained once):
//   - `x += 1` means "add 1 to x". `x -= 1` takes 1 away.
//   - `Float32Array` is a fixed-length list of 32-bit numbers, the format the
//     phone's audio system wants. It can't grow or shrink.
//   - Everything else in this file is done in 64-bit numbers (JavaScript's normal
//     number). Only when a sample is stored into a Float32Array is it rounded to 32 bits.
//
// NaN ("not a number") is what bad maths produces, for example 0 / 0. Once NaN gets
// into a filter's memory it stays there and every later sample is NaN. Note that
// the clamp at the end of chainRender does NOT remove NaN: every comparison with
// NaN is false, so it passes straight through. The audio callback in src/audio checks each block for
// it and rebuilds the chain if it finds one.

import type { CarrierOscillator } from './Carrier';
import { createCarrierOscillator, oscillatorNext } from './Carrier';
import type { Smoothed, StateVariableFilter } from './Filters';
import {
  createSmoothed,
  createStateVariableFilter,
  filterProcess,
  filterSetCutoff,
} from './Filters';
import type { NoiseSource } from './Noise';
import { createNoiseSource, noiseNext } from './Noise';
import type { ReceiverTargets } from './Reception';
import { Tuning } from './Tuning';

/**
 * Filters are recalculated every this many samples (about 3,000 times a second at 48 kHz),
 * which is smooth to the ear and much cheaper than every sample.
 * (Internal. It sits up here because in these files a value has to be
 * written above the function that uses it.)
 */
const filterUpdateInterval = 16;

/**
 * The receiver's signal chain, as a rack in code:
 *
 *     noise source (white + pink + brown) ─┐
 *                                          ├─► high-pass ─► low-pass ─► out
 *     Carrier oscillator ──────────────────┘   (the EQ path)
 *
 * Static and signal share one chain (Instruments §2): the filters every
 * sound goes through open up when you're on a feature and close when you're not.
 * Later, a transmission's audio joins at the same point as the Carrier.
 *
 * It makes sound one sample at a time and never allocates memory or waits,
 * so it's safe to run on the audio thread. It doesn't know about clocks or
 * dials: each buffer it's handed ReceiverTargets and glides every control toward them.
 *
 * Everything inside is internal except `sampleRate`, which is safe to read.
 */
export interface ReceiverChain {
  sampleRate: number;

  // Internal. The modules.
  noise: NoiseSource;
  carrier: CarrierOscillator;
  highpass: StateVariableFilter;
  lowpass: StateVariableFilter;

  // Internal. The knobs, each gliding toward its target (no clicks, no zipper noise).
  white: Smoothed;
  pink: Smoothed;
  brown: Smoothed;
  carrierLevel: Smoothed;
  carrierPitch: Smoothed;
  highpassHz: Smoothed;
  lowpassHz: Smoothed;
  /** Internal. Fades the whole radio in when it turns on. */
  power: Smoothed;

  /** Internal. Counts down to the next time the filters are recalculated. */
  samplesUntilFilterUpdate: number;
}

/**
 * `seed` picks the noise sequence. Same seed, same static, sample for sample.
 * (A whole number from 0 up to 2^53.)
 * It starts silent with the EQ closed and fades up (Tuning.powerOnFade).
 */
export function createReceiverChain(sampleRate: number, seed: number): ReceiverChain {
  const follow = Tuning.soundFollowTime;
  return {
    sampleRate: sampleRate,
    noise: createNoiseSource(seed),
    carrier: createCarrierOscillator(),
    highpass: createStateVariableFilter(),
    lowpass: createStateVariableFilter(),
    white: createSmoothed(0, follow, sampleRate),
    pink: createSmoothed(0, follow, sampleRate),
    brown: createSmoothed(0, follow, sampleRate),
    carrierLevel: createSmoothed(0, follow, sampleRate),
    carrierPitch: createSmoothed(Tuning.humHz, follow, sampleRate),
    highpassHz: createSmoothed(Tuning.closedHighpassHz, follow, sampleRate),
    lowpassHz: createSmoothed(Tuning.closedLowpassHz, follow, sampleRate),
    power: createSmoothed(0, Tuning.powerOnFade, sampleRate),
    samplesUntilFilterUpdate: 0,
  };
}

/**
 * Fade in again from silence, as when it first turned on. Call this when the
 * radio comes back after a pause or a phone call (never while it's playing).
 */
export function chainRestartFade(chain: ReceiverChain): void {
  // The fade's speed (Tuning.powerOnFade) hasn't changed, so putting its
  // value back to 0 is the same as starting a fresh fade, without creating
  // anything new in memory.
  chain.power.value = 0;
}

/**
 * Fill `out` with `count` samples, gliding toward `targets`.
 * `out` is a Float32Array (see the top of this file); storing a number into it
 * rounds the number to 32 bits.
 *
 * THIS IS THE HOTTEST CODE IN THE APP. The loop below runs once per sample:
 * about 48,000 times a second (the phone's sample rate) on the audio thread, and it has to finish each
 * block before the speaker needs it, or you hear a glitch. The rules for it:
 *   - Nothing new may be created inside the loop: no arrays, no objects, no text.
 *     (Making new things forces the phone to tidy up memory later, and a tidy-up
 *     in the middle of the audio is a click.)
 *   - Nothing may wait: no file reads, no network, no logging.
 *   - Keep it short. Anything that doesn't have to change every sample goes
 *     outside the loop (like the knobs taken out just below) or runs
 *     only every few samples (like the filter update in step 1).
 *
 * The stages run in this order, like a rack: noise source ─► mix of the three
 * colors ─► add the Carrier tone ─► high-pass ─► low-pass ─► power fade ─► clamp.
 */
export function chainRender(
  chain: ReceiverChain,
  out: Float32Array,
  count: number,
  targets: ReceiverTargets,
): void {
  // Looked up once here, so the loop doesn't repeat the lookup on every sample.
  const sampleRate = chain.sampleRate;
  const noise = chain.noise;
  const carrier = chain.carrier;
  const highpass = chain.highpass;
  const lowpass = chain.lowpass;
  const resonance = Tuning.receiverResonance;

  // THE KNOBS, TAKEN OUT FOR THE BLOCK. Each knob is a Smoothed (Filters.ts):
  // a value that glides toward a target. The targets don't change during a
  // block, and neither does how fast each knob glides, so all three numbers
  // are copied into plain local variables here, used in the loop, and the
  // knob positions are put back after it.
  //
  // Why: on the phone this code runs in an interpreter (nothing compiles it
  // into fast machine code), so every function call and every
  // `chain.something` lookup costs real time, 48,000 times a second. Local
  // variables are the cheapest thing there is. The glide sum in the loop is
  // exactly smoothedStep's sum (Filters.ts), done in the same order, so the
  // sound comes out the same bit for bit.
  //
  // Two things this relies on (true today, keep them true):
  //   - each knob is its own Smoothed object (createReceiverChain makes eight);
  //   - nothing called inside the loop reads `chain.white.value` and the like,
  //     because those are only brought up to date after the loop.
  //
  // Each knob has three names: `x` (where it is now), `xTarget` (where it's
  // going) and `xGlide` (the share of the remaining distance it covers each sample).
  let white = chain.white.value;
  const whiteTarget = targets.white;
  const whiteGlide = chain.white.coefficient;
  let pink = chain.pink.value;
  const pinkTarget = targets.pink;
  const pinkGlide = chain.pink.coefficient;
  let brown = chain.brown.value;
  const brownTarget = targets.brown;
  const brownGlide = chain.brown.coefficient;
  let carrierPitch = chain.carrierPitch.value;
  const carrierPitchTarget = targets.carrierPitch;
  const carrierPitchGlide = chain.carrierPitch.coefficient;
  let carrierLevel = chain.carrierLevel.value;
  const carrierLevelTarget = targets.carrierLevel;
  const carrierLevelGlide = chain.carrierLevel.coefficient;
  let highpassHz = chain.highpassHz.value;
  const highpassHzTarget = targets.highpassHz;
  const highpassHzGlide = chain.highpassHz.coefficient;
  let lowpassHz = chain.lowpassHz.value;
  const lowpassHzTarget = targets.lowpassHz;
  const lowpassHzGlide = chain.lowpassHz.coefficient;
  let power = chain.power.value; // the power knob's target is always 1 (fully on)
  const powerGlide = chain.power.coefficient;
  // The filter countdown is taken out the same way.
  let samplesUntilFilterUpdate = chain.samplesUntilFilterUpdate;

  for (let i = 0; i < count; i += 1) {
    // 1. Housekeeping: every few samples (filterUpdateInterval), re-aim the
    //    filters at where their cutoffs have glided to. The tan() inside
    //    filterSetCutoff is expensive, so it isn't done every sample.
    if (samplesUntilFilterUpdate === 0) {
      filterSetCutoff(highpass, highpassHz, resonance, sampleRate);
      filterSetCutoff(lowpass, lowpassHz, resonance, sampleRate);
      samplesUntilFilterUpdate = filterUpdateInterval;
    }
    samplesUntilFilterUpdate -= 1;

    // 2. Noise source and mix. noiseNext makes the next white, pink and brown
    //    sample (it stores them in `noise`). Each color goes through its own
    //    level knob, and the three are added together. The target levels are
    //    worked out in Reception.ts (the day's temperature, quieted near the
    //    Carrier). Each `x += (xTarget - x) * xGlide` line is one knob gliding
    //    one sample's worth (the same sum as smoothedStep in Filters.ts).
    noiseNext(noise);
    white += (whiteTarget - white) * whiteGlide;
    pink += (pinkTarget - pink) * pinkGlide;
    brown += (brownTarget - brown) * brownGlide;
    let sample = noise.white * white + noise.pink * pink + noise.brown * brown;

    // 3. Tone. The Carrier's oscillator is mixed in with the static
    //    (added to it) before the filters, so it takes the same EQ path.
    carrierPitch += (carrierPitchTarget - carrierPitch) * carrierPitchGlide;
    carrierLevel += (carrierLevelTarget - carrierLevel) * carrierLevelGlide;
    sample += oscillatorNext(carrier, carrierPitch, sampleRate) * carrierLevel;

    // 4. Filters: the EQ path. Everything goes through it, high-pass first, then
    //    low-pass. The two cutoff knobs only glide along here (step 1 reads
    //    them); they don't re-aim the filters.
    //    filterProcess hands nothing back: read the result from the filter
    //    (.high for the high-pass, .low for the low-pass).
    highpassHz += (highpassHzTarget - highpassHz) * highpassHzGlide;
    lowpassHz += (lowpassHzTarget - lowpassHz) * lowpassHzGlide;
    filterProcess(highpass, sample);
    sample = highpass.high;
    filterProcess(lowpass, sample);
    sample = lowpass.low;

    // 5. Power fade and output clamp. The power knob fades the radio in from
    //    silence. Then the sample is clamped to -1...1: that is full scale for
    //    audio, and a value outside it would be cut off harshly (clipped) by
    //    the phone. `a ? b : c` means "if a, then b, otherwise c". The first
    //    line stops it going below -1, the second stops it going above 1.
    //    It gives exactly what Math.min(Math.max(sample, -1), 1) gives, minus
    //    two calls. (A NaN gets through it, see the top of the file.)
    power += (1 - power) * powerGlide;
    sample *= power;
    const notBelow = sample < -1 ? -1 : sample;
    out[i] = notBelow > 1 ? 1 : notBelow;
  }

  // Put the knobs (and the countdown) back, so the next block carries on
  // from exactly where this one stopped.
  chain.white.value = white;
  chain.pink.value = pink;
  chain.brown.value = brown;
  chain.carrierPitch.value = carrierPitch;
  chain.carrierLevel.value = carrierLevel;
  chain.highpassHz.value = highpassHz;
  chain.lowpassHz.value = lowpassHz;
  chain.power.value = power;
  chain.samplesUntilFilterUpdate = samplesUntilFilterUpdate;
}

/**
 * Convenience for tests and tools: render into a new array.
 * Allocates memory, so never call this on the audio thread.
 */
export function chainRenderToNewArray(
  chain: ReceiverChain,
  count: number,
  targets: ReceiverTargets,
): Float32Array {
  const buffer = new Float32Array(count);
  chainRender(chain, buffer, count, targets);
  return buffer;
}
