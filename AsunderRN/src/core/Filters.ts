// Building blocks for the receiver's sound: a filter and a smoother. chainRender
// calls filterSetCutoff and filterProcess on the audio thread (see src/audio).
// It does smoothedStep's sum itself, written out in its loop, to save a call per
// knob per sample; if you change smoothedStep, change chainRender to match.
//
// The `'worklet';` line below marks every function in this file as safe to copy
// over to the audio thread, which runs its own separate copy of the code.
// It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used. Put it below and the code still works on a computer, but it
// breaks on the phone. (One test, DeclarationOrder, checks the order for you.)
'worklet';

// A note on bad numbers. NaN ("not a number", what maths like 0 / 0 gives) is
// poison for a filter: it goes into the filter's memory (ic1, ic2) and every later
// sample is NaN too. Math.min and Math.max pass NaN straight through, so the
// clamps in filterSetCutoff do not stop it. Whoever calls these functions has to
// keep NaN out; src/audio checks each block for it.
// The one guard here is in createSmoothed: `seconds > 0` is false for 0, for
// negatives AND for NaN, so all three fall back to "jump straight to the target".
// Don't tidy that test into another form.

/**
 * A state-variable filter: the same kind of 12 dB/octave multimode filter
 * that's in a lot of synths, giving low-pass, high-pass and band-pass from one circuit.
 *
 * This is Andrew Simper's "trapezoidal" design (Cytomic, 2013). Its cutoff
 * can be swept while audio runs through it without clicks or blowing up,
 * which matters because the receiver's filters move whenever you tune.
 */
export interface StateVariableFilter {
  /** The three outputs for the latest sample. filterProcess refreshes these. */
  low: number;
  band: number;
  high: number;

  // Internal. The filter's memory (two integrators).
  ic1: number;
  ic2: number;
  // Internal. Coefficients, recalculated whenever the cutoff or resonance changes.
  a1: number;
  a2: number;
  a3: number;
  k: number;
}

/**
 * `hz` is the cutoff. `resonance` is the Q: 0.707 is flat (no peak),
 * higher adds a peak at the cutoff.
 * (This sits above createStateVariableFilter because that function uses it,
 * and in these files a helper has to be written above the function that uses it.)
 */
export function filterSetCutoff(
  filter: StateVariableFilter,
  hz: number,
  resonance: number,
  sampleRate: number,
): void {
  // Keep the cutoff inside the range the math can handle: no lower than 10 Hz,
  // and no higher than 45% of the sample rate (the tan() below blows up as the
  // cutoff nears half the sample rate). Math.max picks the larger of two
  // numbers and Math.min the smaller, so nesting them squeezes hz into the range.
  // (A NaN `hz` would pass through this; see the note at the top of the file.)
  const safeHz = Math.min(Math.max(hz, 10), sampleRate * 0.45);
  // g is the cutoff turned into the number the filter maths wants.
  const g = Math.tan((Math.PI * safeHz) / sampleRate);
  // k is the damping, 1 / Q. A very low Q is held at 0.1 so k can't get huge.
  filter.k = 1 / Math.max(resonance, 0.1);
  // The three coefficients the per-sample step (filterProcess) multiplies by.
  filter.a1 = 1 / (1 + g * (g + filter.k));
  filter.a2 = g * filter.a1;
  filter.a3 = g * filter.a2;
}

/**
 * A new filter with empty memory, set to a placeholder cutoff (1 kHz, flat).
 * Call filterSetCutoff before real use. (In numbers like `1_000` the underscore
 * is only there to be easy to read; it is the same as 1000.)
 */
export function createStateVariableFilter(): StateVariableFilter {
  const filter: StateVariableFilter = {
    low: 0,
    band: 0,
    high: 0,
    ic1: 0,
    ic2: 0,
    a1: 0,
    a2: 0,
    a3: 0,
    k: 0,
  };
  filterSetCutoff(filter, 1_000, 0.707, 48_000);
  return filter;
}

/**
 * Runs one sample through. Afterwards read the three outputs from
 * filter.low, filter.band and filter.high (nothing is handed back, so
 * nothing new is created in memory on the audio thread).
 */
export function filterProcess(filter: StateVariableFilter, input: number): void {
  // chainRender calls this twice per sample (high-pass, then low-pass).
  // v1 is the band-pass, v2 the low-pass; ic1 and ic2 carry over to the next sample.
  const v3 = input - filter.ic2;
  const v1 = filter.a1 * filter.ic1 + filter.a2 * v3;
  const v2 = filter.ic2 + filter.a2 * filter.ic1 + filter.a3 * v3;
  filter.ic1 = 2 * v1 - filter.ic1;
  filter.ic2 = 2 * v2 - filter.ic2;
  filter.low = v2;
  filter.band = v1;
  filter.high = input - filter.k * v1 - v2;
}

/**
 * A value that glides toward its target instead of jumping, so controls
 * that move (the dial, a level, a filter) never click or "zipper".
 * It covers about 63% of the remaining distance every `seconds`.
 */
export interface Smoothed {
  /** Where the value is right now. (Read it freely; only smoothedStep and chainRender change it.) */
  value: number;
  /** Internal. The share of the remaining distance covered each sample. */
  coefficient: number;
}

/**
 * `start` is where the value begins. `seconds` is the glide time: about 63% of the
 * way there after that long (longer is slower and softer). 0 or less means no
 * gliding, the value jumps straight to its target.
 */
export function createSmoothed(start: number, seconds: number, sampleRate: number): Smoothed {
  return {
    value: start,
    coefficient: seconds > 0 ? 1 - Math.exp(-1 / (seconds * sampleRate)) : 1,
  };
}

/**
 * Move one sample's worth toward `target`, and return the new value.
 * It only does plain arithmetic, so it's safe on the audio thread. (chainRender
 * does this same sum written out in its loop; see the note at the top of this file.)
 */
export function smoothedStep(smoothed: Smoothed, target: number): number {
  smoothed.value += (target - smoothed.value) * smoothed.coefficient;
  return smoothed.value;
}
