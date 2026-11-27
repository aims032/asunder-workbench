// THE SCOPE'S XY MODE: pictures drawn by sound.
//
// Evan, Nov 25: "XY mode to draw her form." In XY mode there is no time
// axis. The LEFT sound channel moves the beam sideways and the RIGHT channel
// moves it up and down, so a stereo sound IS a drawing. Play a sine wave on
// the left and the same sine a quarter-cycle later on the right, and the
// beam goes round in a circle. Artists make whole animated pictures this way
// ("oscilloscope music"), and you can hear the picture as well as see it.
//
// This file answers "where is the beam, moment by moment?" as two rows of
// samples, one per channel. scope/XYBeam.tsx draws them.
//
// THE FIGURE IS A PLACEHOLDER. The real XY sounds are Evan's to make or
// choose. Until then every patched line carries one plain test figure (a
// slowly turning figure-eight, the classic scope test pattern) while the
// tape runs. When real stereo recordings exist, only scopeStereoSample
// changes.
//
// RULE: a helper function (or constant) has to be written ABOVE the first
// place it is used (the DeclarationOrder test checks this).
'worklet';

import { analyzerHash } from './Analyzer';
import { scopeInputIsIdle, scopeSignalAmount } from './ScopeSignal';
import { ScopeTuning } from './Tuning';

/** A number from -1 up to (not including) 1, fixed for a given pair of whole numbers. */
function xyNoise(a: number, b: number): number {
  return analyzerHash(a, b) / 2_147_483_648 - 1;
}

/**
 * The LEFT channel of the placeholder figure at this moment (seconds from
 * the start of the transmission): a plain sine wave.
 */
export function scopeStereoLeft(atSeconds: number): number {
  const T = ScopeTuning;
  return T.xyFigureLevel * Math.sin(2 * Math.PI * T.xyFigureHz * atSeconds);
}

/**
 * The RIGHT channel of the placeholder figure: a sine at xyFigureRatio times
 * the left one's pitch. (Twice the pitch draws a figure-eight; the same
 * pitch draws a circle or an oval.) Its timing against the left channel
 * drifts slowly, which is what makes the figure appear to turn.
 */
export function scopeStereoRight(atSeconds: number): number {
  const T = ScopeTuning;
  const drift = 2 * Math.PI * T.xyFigureTurnsPerSecond * atSeconds;
  return T.xyFigureLevel * Math.sin(2 * Math.PI * T.xyFigureHz * T.xyFigureRatio * atSeconds + drift);
}

/**
 * Fills `left` and `right` with the window of stereo samples the scope
 * should draw in XY mode, and gives back true if the input is idle.
 * The arguments match scopeSignalWindow (ScopeSignal.ts).
 *
 * Idle: every sample is 0 (the beam rests in the middle).
 * Off the signal: fuzz on both channels, so the beam jitters in a cloud.
 * Tuning in: the cloud tightens into the figure.
 */
export function scopeStereoWindow(
  left: number[] | Float32Array,
  right: number[] | Float32Array,
  line: string | null,
  playing: boolean,
  startSeconds: number,
  secondsPerSample: number,
  clarity: number,
): boolean {
  const n = Math.min(left.length, right.length);
  if (scopeInputIsIdle(line, playing)) {
    for (let i = 0; i < n; i += 1) {
      left[i] = 0;
      right[i] = 0;
    }
    return true;
  }
  const amount = scopeSignalAmount(clarity);
  const fuzz = (1 - amount) * ScopeTuning.signalFuzz;
  for (let i = 0; i < n; i += 1) {
    const at = startSeconds + i * secondsPerSample;
    const grain = Math.floor(at * ScopeTuning.signalGrainHz);
    // Different noise on each channel (13 and 17 just keep them apart).
    left[i] = scopeStereoLeft(at) * amount + (fuzz > 0 ? xyNoise(grain, 13) * fuzz : 0);
    right[i] = scopeStereoRight(at) * amount + (fuzz > 0 ? xyNoise(grain, 17) * fuzz : 0);
  }
  return false;
}

/**
 * How far across the screen a left-channel sample puts the beam: 0 = the
 * left edge, 0.5 = the middle, 1 = the right edge.
 *
 *  - `perDivision`: channel 1's Volts/div, how much signal one square is wide.
 *  - `position`: the horizontal position, in squares. Positive = moved right.
 */
export function scopeXYAcross(sample: number, perDivision: number, position: number): number {
  return 0.5 + (sample / perDivision + position) / ScopeTuning.gridAcross;
}

/**
 * How bright the beam is while it covers `squares` grid squares between one
 * sample and the next, 0 to 1. A real tube glows where the beam lingers: a
 * slow beam piles up light, a fast one spreads it thin. So the turning
 * points of a figure are bright and its long fast strokes are dim.
 */
export function scopeBeamBrightness(squares: number): number {
  const T = ScopeTuning;
  const brightness = 1 / (1 + Math.abs(squares) / T.xyDwellSquares);
  return brightness < T.xyDimmest ? T.xyDimmest : brightness;
}

/**
 * Which of `levels` brightness steps a stroke falls in: 0 = the dimmest,
 * levels - 1 = the brightest. (The screen draws each step as its own layer.)
 */
export function scopeBeamLevel(squares: number, levels: number): number {
  const T = ScopeTuning;
  const b = (scopeBeamBrightness(squares) - T.xyDimmest) / (1 - T.xyDimmest);
  const level = Math.floor(b * levels);
  return level >= levels ? levels - 1 : level < 0 ? 0 : level;
}
