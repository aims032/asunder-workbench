// THE SCOPE'S FRONT PANEL, AS NUMBERS: which controls it has, what one click
// of each knob does, and how each setting reads on the panel.
//
// Modeled on a classic analog bench scope (Evan, Nov 25): a mode switch and
// a row of round knobs. Which real model it copies is still open, so this is
// behavior only. No drawing here, so Evan's artwork for the knobs can replace
// the placeholder pictures without touching any of this.
//
// THE CONTROLS
//   Mode         how the beam draws: Waveform, XY or Picture.
//   Time/div     how much time one grid square is wide (Waveform).
//   Volts/div 1  how much signal one square is tall (Waveform); how wide
//                the drawing is in XY (channel 1 = the left sound channel).
//   Volts/div 2  how tall the drawing is in XY (channel 2 = the right one).
//   Position     slides the whole trace up/down or left/right.
//   Intensity    how bright the beam is.
//   Focus        how sharp the beam is.
//   Trigger      the height the wave must climb through before each sweep
//                starts (see ScopeTrace.ts). The scope is always on "Auto":
//                when the wave never reaches the level it sweeps anyway.
//
// Time/div and Volts/div click through fixed values in a 1-2-5 pattern
// (1, 2, 5, 10, 20, 50...), the way real scopes do. The lists, the starting
// values and every range are in ScopeTuning.
//
// RULE: a helper function (or constant) has to be written ABOVE the first
// place it is used (the DeclarationOrder test checks this).
'worklet';

import { ScopeTuning } from './Tuning';

/** How the beam draws. */
export type ScopeDrawMode = 'waveform' | 'xy' | 'picture';

/** The knobs. */
export type ScopeKnob =
  | 'time'
  | 'volts1'
  | 'volts2'
  | 'positionUp'
  | 'positionAcross'
  | 'intensity'
  | 'focus'
  | 'trigger';

/** Every knob, in the order they sit on the panel. */
export const SCOPE_KNOBS: readonly ScopeKnob[] = [
  'time',
  'volts1',
  'volts2',
  'positionUp',
  'positionAcross',
  'intensity',
  'focus',
  'trigger',
];

/** Where every control is set. */
export interface ScopePanelState {
  mode: ScopeDrawMode;
  /** Which of ScopeTuning.timeSteps. */
  timeIndex: number;
  /** Which of ScopeTuning.voltsSteps, for each channel. */
  volts1Index: number;
  volts2Index: number;
  /** How far the trace is moved, in grid squares. Positive = up / right. */
  positionUp: number;
  positionAcross: number;
  /** 0 (dark) to 1 (full brightness). */
  intensity: number;
  /** 0 (a soft blur) to 1 (sharp). */
  focus: number;
  /** The trigger level, in grid squares above the middle line. */
  triggerSquares: number;
}

/** The modes the switch offers, in order. Picture is there only while ScopeTuning.keepPictureMode is true. */
export function scopeModes(): ScopeDrawMode[] {
  return ScopeTuning.keepPictureMode ? ['waveform', 'xy', 'picture'] : ['waveform', 'xy'];
}

/** The place in `steps` closest to `value`. */
function nearestIndex(steps: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i += 1) {
    if (Math.abs(steps[i] - value) < Math.abs(steps[best] - value)) {
      best = i;
    }
  }
  return best;
}

/** `x` kept between `low` and `high`. */
function clampTo(x: number, low: number, high: number): number {
  return x < low ? low : x > high ? high : x;
}

/**
 * `value` moved by one `step` in `direction` and kept in range. Rounded to
 * the nearest whole step so many small moves never drift (0.1 + 0.2 is not
 * exactly 0.3 on a computer).
 */
function nudge(value: number, direction: number, step: number, low: number, high: number): number {
  return clampTo(Math.round((value + direction * step) / step) * step, low, high);
}

/** The panel as it is when the app opens. Settings aren't remembered between sessions yet (open question). */
export function scopePanelInitial(): ScopePanelState {
  const T = ScopeTuning;
  return {
    mode: 'waveform',
    timeIndex: nearestIndex(T.timeSteps, T.timePerDivision),
    volts1Index: nearestIndex(T.voltsSteps, T.voltsPerDivision),
    volts2Index: nearestIndex(T.voltsSteps, T.voltsPerDivision),
    positionUp: 0,
    positionAcross: 0,
    intensity: T.startIntensity,
    focus: T.startFocus,
    triggerSquares: T.startTriggerSquares,
  };
}

/** Time/div as it's set: seconds per grid square. */
export function scopePanelTime(panel: ScopePanelState): number {
  return ScopeTuning.timeSteps[panel.timeIndex];
}

/** Volts/div as it's set for a channel (1 or 2): signal per grid square. */
export function scopePanelVolts(panel: ScopePanelState, channel: 1 | 2): number {
  return ScopeTuning.voltsSteps[channel === 1 ? panel.volts1Index : panel.volts2Index];
}

/**
 * The trigger level as a signal height (the units samples come in). It's set
 * in grid squares, so it stays at the same place on the screen when Volts/div
 * changes, like the level marker on a real scope.
 */
export function scopePanelTriggerLevel(panel: ScopePanelState): number {
  return panel.triggerSquares * scopePanelVolts(panel, 1);
}

/**
 * One click of a knob, `direction` +1 (clockwise) or -1.
 * Clockwise on Time/div and Volts/div makes the wave BIGGER on screen (less
 * time or signal per square), the way a real scope's knobs zoom in. On the
 * others, clockwise is up, right, brighter, sharper, higher.
 */
export function scopePanelTurn(panel: ScopePanelState, knob: ScopeKnob, direction: number): ScopePanelState {
  const T = ScopeTuning;
  switch (knob) {
    case 'time':
      // timeSteps runs shortest first, so zooming in is a smaller index.
      return { ...panel, timeIndex: clampTo(panel.timeIndex - direction, 0, T.timeSteps.length - 1) };
    case 'volts1':
      return { ...panel, volts1Index: clampTo(panel.volts1Index - direction, 0, T.voltsSteps.length - 1) };
    case 'volts2':
      return { ...panel, volts2Index: clampTo(panel.volts2Index - direction, 0, T.voltsSteps.length - 1) };
    case 'positionUp': {
      const reach = T.gridUp / 2;
      return { ...panel, positionUp: nudge(panel.positionUp, direction, T.positionStep, -reach, reach) };
    }
    case 'positionAcross': {
      const reach = T.gridAcross / 2;
      return { ...panel, positionAcross: nudge(panel.positionAcross, direction, T.positionStep, -reach, reach) };
    }
    case 'intensity':
      return { ...panel, intensity: nudge(panel.intensity, direction, T.intensityStep, T.lowestIntensity, 1) };
    case 'focus':
      return { ...panel, focus: nudge(panel.focus, direction, T.focusStep, 0, 1) };
    case 'trigger': {
      const reach = T.gridUp / 2;
      return { ...panel, triggerSquares: nudge(panel.triggerSquares, direction, T.triggerStep, -reach, reach) };
    }
  }
}

/** The value a knob is set to, as one number (used to tell whether a click changed anything). */
export function scopePanelValue(panel: ScopePanelState, knob: ScopeKnob): number {
  switch (knob) {
    case 'time':
      return panel.timeIndex;
    case 'volts1':
      return panel.volts1Index;
    case 'volts2':
      return panel.volts2Index;
    case 'positionUp':
      return panel.positionUp;
    case 'positionAcross':
      return panel.positionAcross;
    case 'intensity':
      return panel.intensity;
    case 'focus':
      return panel.focus;
    case 'trigger':
      return panel.triggerSquares;
  }
}

/** Flip the mode switch to the next position (round again at the end). */
export function scopePanelNextMode(panel: ScopePanelState): ScopePanelState {
  const modes = scopeModes();
  const i = modes.indexOf(panel.mode);
  return { ...panel, mode: modes[(i + 1) % modes.length] };
}

/** A number with no more decimals than it needs: 2, 0.5, 1.25. */
function tidy(x: number): string {
  return String(Math.round(x * 100) / 100);
}

/** A time as a scope writes it: "2 ms", "100 µs", "0.5 s". */
export function scopeTimeLabel(seconds: number): string {
  if (seconds >= 1) {
    return `${tidy(seconds)} s`;
  }
  if (seconds >= 0.001) {
    return `${tidy(seconds * 1000)} ms`;
  }
  return `${tidy(seconds * 1_000_000)} µs`;
}

/** What a knob shows under its name. */
export function scopeKnobLabel(panel: ScopePanelState, knob: ScopeKnob): string {
  switch (knob) {
    case 'time':
      return scopeTimeLabel(scopePanelTime(panel));
    case 'volts1':
      return tidy(scopePanelVolts(panel, 1));
    case 'volts2':
      return tidy(scopePanelVolts(panel, 2));
    case 'positionUp':
      return tidy(panel.positionUp);
    case 'positionAcross':
      return tidy(panel.positionAcross);
    case 'intensity':
      return tidy(panel.intensity * 10);
    case 'focus':
      return tidy(panel.focus * 10);
    case 'trigger':
      return tidy(panel.triggerSquares);
  }
}
