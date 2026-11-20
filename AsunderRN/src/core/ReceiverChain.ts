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
import { createCarrierOscillator } from './Carrier';
import type { Smoothed, StateVariableFilter } from './Filters';
import { createSmoothed, createStateVariableFilter, filterSetCutoff } from './Filters';
import type { NoiseRandom, NoiseSource } from './Noise';
import {
  brownMemory,
  brownScale,
  createNoiseSource,
  noiseFillRandoms,
  pinkScale,
  whiteScale,
} from './Noise';
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
 * The random numbers for the static are made this many samples at a time
 * (three per sample), into a list the chain keeps (`randoms`), and the sound
 * loop reads them from there. Any size works; the sound is the same. 256 is
 * two of the phone's blocks. (Internal.)
 */
const randomStretch = 256;

/**
 * Below this loudness the Carrier is skipped: its three sine waves aren't
 * worked out, only its place in its cycle moves on, so it comes back
 * smoothly. 1e-9 is about 180 dB down. Skipping something that quiet can
 * flip the very last bit of an odd sample (measured: about 1 sample in 6,000
 * while tuning across the edge of the Carrier, never by more than 0.000000015,
 * some 156 dB below full scale), which nobody can hear. Off the Carrier
 * (nearly the whole band) it saves three sin() calls per sample. (Internal.)
 */
const carrierSilentLevel = 1e-9;

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

  /** Internal. Working space for the static's random numbers (see randomStretch). */
  randoms: Float64Array;
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
    randoms: new Float64Array(3 * randomStretch),
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
 * chainRender, with the static's random numbers coming from `fillRandoms`.
 * The app always uses noiseFillRandoms (through chainRender, below). The
 * Swift comparison test hands in its own, so it can feed the chain the exact
 * random numbers the Swift app used. Read chainRender's notes first.
 */
export function chainRenderWith(
  chain: ReceiverChain,
  out: Float32Array,
  count: number,
  targets: ReceiverTargets,
  fillRandoms: (random: NoiseRandom, out: Float64Array, count: number) => void,
): void {
  // Looked up once here, so the loop doesn't repeat the lookup on every sample.
  const sampleRate = chain.sampleRate;
  const noise = chain.noise;
  const carrier = chain.carrier;
  const highpass = chain.highpass;
  const lowpass = chain.lowpass;
  const randoms = chain.randoms;
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
  // variables are the cheapest thing there is. Every sum in the loop is
  // exactly the sum in the helper it stands in for (smoothedStep and
  // filterProcess in Filters.ts, noiseShape in Noise.ts, oscillatorNext in
  // Carrier.ts), done in the same order, so the sound comes out the same bit
  // for bit (apart from the quiet-Carrier skip, see carrierSilentLevel). If
  // you change one of those helpers, change the loop to match.
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

  // THE MODULES' MEMORY, TAKEN OUT THE SAME WAY, for the same reason.
  // The static's filters (see noiseShape in Noise.ts):
  let b0 = noise.b0;
  let b1 = noise.b1;
  let b2 = noise.b2;
  let b3 = noise.b3;
  let b4 = noise.b4;
  let b5 = noise.b5;
  let b6 = noise.b6;
  let brownState = noise.brownState;
  let whiteSample = noise.white;
  let pinkSample = noise.pink;
  let brownSample = noise.brown;
  // The two EQ filters (see filterProcess in Filters.ts). `hp` is the
  // high-pass, `lp` the low-pass. ic1 and ic2 are each filter's memory; a1,
  // a2, a3 and k its settings, which only change when step 1 re-aims it.
  let hpIc1 = highpass.ic1;
  let hpIc2 = highpass.ic2;
  let hpA1 = highpass.a1;
  let hpA2 = highpass.a2;
  let hpA3 = highpass.a3;
  let hpK = highpass.k;
  let lpIc1 = lowpass.ic1;
  let lpIc2 = lowpass.ic2;
  let lpA1 = lowpass.a1;
  let lpA2 = lowpass.a2;
  let lpA3 = lowpass.a3;
  // The Carrier's place in its cycle (see oscillatorNext in Carrier.ts), and
  // the numbers it needs that never change.
  let phase = carrier.phase;
  const nyquist = sampleRate / 2;
  const secondHarmonic = Tuning.carrierSecondHarmonic;
  const thirdHarmonic = Tuning.carrierThirdHarmonic;
  // Whether the Carrier is too quiet to matter for this whole block: it is
  // now, and it is heading for quiet too (so it can only get quieter).
  const carrierIsSilent =
    carrierLevel < carrierSilentLevel && carrierLevelTarget < carrierSilentLevel;

  // The block is made in stretches of up to randomStretch samples: first the
  // random numbers for the stretch, then the sound loop for it.
  for (let start = 0; start < count; start += randomStretch) {
    const end = Math.min(start + randomStretch, count);
    fillRandoms(noise.random, randoms, 3 * (end - start));
    let r = 0; // where in `randoms` the next number is

    for (let i = start; i < end; i += 1) {
      // 1. Housekeeping: every few samples (filterUpdateInterval), re-aim the
      //    filters at where their cutoffs have glided to. The tan() inside
      //    filterSetCutoff is expensive, so it isn't done every sample. Its
      //    new settings are then copied back out into the local variables.
      if (samplesUntilFilterUpdate === 0) {
        filterSetCutoff(highpass, highpassHz, resonance, sampleRate);
        filterSetCutoff(lowpass, lowpassHz, resonance, sampleRate);
        hpA1 = highpass.a1;
        hpA2 = highpass.a2;
        hpA3 = highpass.a3;
        hpK = highpass.k;
        lpA1 = lowpass.a1;
        lpA2 = lowpass.a2;
        lpA3 = lowpass.a3;
        samplesUntilFilterUpdate = filterUpdateInterval;
      }
      samplesUntilFilterUpdate -= 1;

      // 2. Noise source and mix. Three fresh random numbers (white, pink,
      //    brown), then noiseShape's sums written out (Noise.ts; the numbers
      //    are locked there, don't tune here). Each color goes through its own
      //    level knob, and the three are added together. The target levels are
      //    worked out in Reception.ts (the day's temperature, quieted near the
      //    Carrier). Each `x += (xTarget - x) * xGlide` line is one knob gliding
      //    one sample's worth (the same sum as smoothedStep in Filters.ts).
      const w = randoms[r];
      const p = randoms[r + 1];
      const b = randoms[r + 2];
      r += 3;
      b0 = 0.99886 * b0 + p * 0.0555179;
      b1 = 0.99332 * b1 + p * 0.0750759;
      b2 = 0.96900 * b2 + p * 0.1538520;
      b3 = 0.86650 * b3 + p * 0.3104856;
      b4 = 0.55000 * b4 + p * 0.5329522;
      b5 = -0.7616 * b5 - p * 0.0168980;
      const pinkRaw = b0 + b1 + b2 + b3 + b4 + b5 + b6 + p * 0.5362;
      b6 = p * 0.115926;
      brownState = brownMemory * brownState + b * 0.1;
      whiteSample = w * whiteScale;
      pinkSample = pinkRaw * pinkScale;
      brownSample = brownState * brownScale;

      white += (whiteTarget - white) * whiteGlide;
      pink += (pinkTarget - pink) * pinkGlide;
      brown += (brownTarget - brown) * brownGlide;
      let sample = whiteSample * white + pinkSample * pink + brownSample * brown;

      // 3. Tone. The Carrier's oscillator (oscillatorNext's sums, Carrier.ts)
      //    is mixed in with the static (added to it) before the filters, so it
      //    takes the same EQ path. When it's too quiet to matter (see
      //    carrierSilentLevel), only its cycle moves on.
      carrierPitch += (carrierPitchTarget - carrierPitch) * carrierPitchGlide;
      carrierLevel += (carrierLevelTarget - carrierLevel) * carrierLevelGlide;
      if (carrierIsSilent) {
        phase += carrierPitch / sampleRate;
        phase -= Math.floor(phase);
      } else {
        const h2 = 2 * carrierPitch < nyquist ? secondHarmonic : 0;
        const h3 = 3 * carrierPitch < nyquist ? thirdHarmonic : 0;
        const angle = 2 * Math.PI * phase;
        const wave = Math.sin(angle) + h2 * Math.sin(2 * angle) + h3 * Math.sin(3 * angle);
        phase += carrierPitch / sampleRate;
        phase -= Math.floor(phase);
        sample += (wave / (1 + h2 + h3)) * carrierLevel;
      }

      // 4. Filters: the EQ path (filterProcess's sums, Filters.ts). Everything
      //    goes through it, high-pass first, then low-pass. The two cutoff
      //    knobs only glide along here (step 1 reads them); they don't re-aim
      //    the filters. v1 is a filter's band-pass, v2 its low-pass.
      highpassHz += (highpassHzTarget - highpassHz) * highpassHzGlide;
      lowpassHz += (lowpassHzTarget - lowpassHz) * lowpassHzGlide;
      let v3 = sample - hpIc2;
      let v1 = hpA1 * hpIc1 + hpA2 * v3;
      let v2 = hpIc2 + hpA2 * hpIc1 + hpA3 * v3;
      hpIc1 = 2 * v1 - hpIc1;
      hpIc2 = 2 * v2 - hpIc2;
      sample = sample - hpK * v1 - v2; // the high-pass output
      v3 = sample - lpIc2;
      v1 = lpA1 * lpIc1 + lpA2 * v3;
      v2 = lpIc2 + lpA2 * lpIc1 + lpA3 * v3;
      lpIc1 = 2 * v1 - lpIc1;
      lpIc2 = 2 * v2 - lpIc2;
      sample = v2; // the low-pass output

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
  }

  // Put everything back, so the next block carries on from exactly where
  // this one stopped.
  chain.white.value = white;
  chain.pink.value = pink;
  chain.brown.value = brown;
  chain.carrierPitch.value = carrierPitch;
  chain.carrierLevel.value = carrierLevel;
  chain.highpassHz.value = highpassHz;
  chain.lowpassHz.value = lowpassHz;
  chain.power.value = power;
  chain.samplesUntilFilterUpdate = samplesUntilFilterUpdate;
  noise.b0 = b0;
  noise.b1 = b1;
  noise.b2 = b2;
  noise.b3 = b3;
  noise.b4 = b4;
  noise.b5 = b5;
  noise.b6 = b6;
  noise.brownState = brownState;
  noise.white = whiteSample;
  noise.pink = pinkSample;
  noise.brown = brownSample;
  highpass.ic1 = hpIc1;
  highpass.ic2 = hpIc2;
  lowpass.ic1 = lpIc1;
  lowpass.ic2 = lpIc2;
  carrier.phase = phase;
}

/**
 * Fill `out` with `count` samples, gliding toward `targets`.
 * `out` is a Float32Array (see the top of this file); storing a number into it
 * rounds the number to 32 bits.
 *
 * THIS IS THE HOTTEST CODE IN THE APP. The loop inside chainRenderWith (above)
 * runs once per sample: about 48,000 times a second (the phone's sample rate)
 * on the audio thread, and it has to finish each block before the speaker
 * needs it, or you hear a glitch. The rules for it:
 *   - Nothing new may be created inside the loop: no arrays, no objects, no text.
 *     (Making new things forces the phone to tidy up memory later, and a tidy-up
 *     in the middle of the audio is a click.)
 *   - Nothing may wait: no file reads, no network, no logging.
 *   - Keep it short. Anything that doesn't have to change every sample goes
 *     outside the loop (like the knobs taken out at its top) or runs
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
  chainRenderWith(chain, out, count, targets, noiseFillRandoms);
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
