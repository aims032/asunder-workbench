// THE SCOPE'S TRACE: how a window of sound becomes a line on the screen.
//
// In Waveform mode the beam sweeps left to right over time, and the sound
// moves it up and down. This file is the arithmetic for that: when a sweep
// starts (the trigger), how much time fits across the screen, and how high
// up the screen a given sample lands. Still no drawing: scope/WaveTrace.tsx
// turns these numbers into the green line.
//
// THE GRID. A scope's screen is ruled into squares called divisions: 10
// across and 8 up. The knobs are marked "per division": Time/div is how much
// time one square is wide, Volts/div is how much signal one square is tall.
//
// THE TRIGGER. A scope redraws the wave many times a second. If each sweep
// started at a random moment, a repeating wave would land in a different
// place every time and smear into a blur. The trigger fixes that: each sweep
// waits to start until the wave climbs through a chosen height (the trigger
// level). A repeating wave crosses that height at the same point in every
// cycle, so every sweep lands on top of the last and the wave holds still.
// If the wave never reaches the level, the scope stops waiting and sweeps
// anyway ("Auto"), so you see a sliding wave, or the flat line when it's
// quiet, instead of a blank screen.
//
// RULE: a helper function (or constant) has to be written ABOVE the first
// place it is used (the DeclarationOrder test checks this).
'worklet';

import { ScopeTuning } from './Tuning';

/**
 * Where in `samples` a sweep should start: the first place the wave climbs
 * through `level` (below it at one sample, at or above it at the next).
 * Only the first `searchLength` samples are searched. Gives back -1 if the
 * wave never climbs through the level there.
 */
export function scopeTriggerIndex(samples: ArrayLike<number>, level: number, searchLength: number): number {
  const end = Math.min(searchLength, samples.length);
  for (let i = 1; i < end; i += 1) {
    if (samples[i - 1] < level && samples[i] >= level) {
      return i;
    }
  }
  return -1;
}

/**
 * Where the sweep the screen shows starts, on Auto: at the trigger if there
 * is one, otherwise at the very start of the window (free-running).
 * `visible` is how many samples fit across the screen; the search stops
 * early enough that a full screen's worth is always left to draw.
 */
export function scopeSweepStart(samples: ArrayLike<number>, level: number, visible: number): number {
  const found = scopeTriggerIndex(samples, level, samples.length - visible + 1);
  return found < 0 ? 0 : found;
}

/**
 * The time between one sample and the next, so that `pointsAcross` samples
 * span the whole screen at this Time/div setting (seconds per division).
 */
export function scopeSecondsPerSample(timePerDivision: number, pointsAcross: number): number {
  return (timePerDivision * ScopeTuning.gridAcross) / Math.max(1, pointsAcross - 1);
}

/**
 * How far down the screen a sample is drawn: 0 = the top edge, 0.5 = the
 * middle, 1 = the bottom edge. (Screens count downward, so a louder positive
 * sample gives a SMALLER number.) Samples too big for the screen run off it.
 *
 *  - `perDivision`: the Volts/div setting, how much signal one square is tall.
 *  - `position`: the vertical position, in squares. Positive = moved up.
 */
export function scopeTraceDepth(sample: number, perDivision: number, position: number): number {
  const squaresUp = sample / perDivision + position;
  return 0.5 - squaresUp / ScopeTuning.gridUp;
}
