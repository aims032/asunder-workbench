import { AnalyzerTuning, analyzerAutoRbw, analyzerSweepSeconds, currentBandDisplay } from '../core';
import type { AnalyzerSettings, TraceMode } from '../core';

// THE ANALYZER'S FRONT PANEL, AS NUMBERS: which settings it has, what one
// step of the knob does to each, and how each reads on screen.
// No drawing here, so Evan's artwork for the keys and the knob can replace
// the placeholder pictures without touching any of this.
//
// It works the way the Keysight's front panel does: you press a key to pick
// the "active function" (Span, RBW or Ref Level), then the knob changes it.
// Trace and View are keys that step through their choices each time you press.

/** What the knob is set to change. */
export type ActiveFunction = 'span' | 'rbw' | 'reference';

/** What the screen shows: the trace, the spectrogram, or both stacked. */
export type AnalyzerView = 'trace' | 'split' | 'spectrogram';

export interface PanelState {
  active: ActiveFunction;
  /** Which of AnalyzerTuning.spanSteps. */
  spanIndex: number;
  /** Which of AnalyzerTuning.rbwSteps, or null for Auto. */
  rbwIndex: number | null;
  /** The level at the top of the screen, in dB. */
  referenceDb: number;
  traceMode: TraceMode;
  view: AnalyzerView;
}

export function initialPanel(): PanelState {
  const spanIndex = AnalyzerTuning.spanSteps.indexOf(AnalyzerTuning.startSpan);
  return {
    active: 'span',
    spanIndex: spanIndex >= 0 ? spanIndex : 0,
    rbwIndex: null,
    referenceDb: AnalyzerTuning.startReferenceDb,
    traceMode: 'clearWrite',
    view: 'split',
  };
}

export function panelSpan(panel: PanelState): number {
  return AnalyzerTuning.spanSteps[panel.spanIndex];
}

export function panelRbw(panel: PanelState): number {
  return panel.rbwIndex === null
    ? analyzerAutoRbw(panelSpan(panel))
    : AnalyzerTuning.rbwSteps[panel.rbwIndex];
}

/** What the sweep needs from the panel. */
export function panelSweepSettings(panel: PanelState): AnalyzerSettings {
  return { span: panelSpan(panel), rbw: panelRbw(panel), traceMode: panel.traceMode };
}

function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length - 1, i));
}

/**
 * One notch of the knob, `direction` +1 (clockwise) or -1. Clockwise makes
 * things bigger the way a real panel does: a wider span, a wider RBW, a
 * higher reference level.
 */
export function panelKnobStep(panel: PanelState, direction: number): PanelState {
  switch (panel.active) {
    case 'span': {
      // spanSteps runs widest first, so "wider" is a smaller index.
      const spanIndex = clampIndex(panel.spanIndex - direction, AnalyzerTuning.spanSteps.length);
      return { ...panel, spanIndex };
    }
    case 'rbw': {
      // Turning the knob takes RBW off Auto, starting from wherever Auto was.
      const steps = AnalyzerTuning.rbwSteps;
      const from = panel.rbwIndex ?? steps.indexOf(panelRbw(panel));
      return { ...panel, rbwIndex: clampIndex(from + direction, steps.length) };
    }
    case 'reference': {
      const t = AnalyzerTuning;
      const referenceDb = Math.max(
        t.lowestReferenceDb,
        Math.min(t.highestReferenceDb, panel.referenceDb + direction * t.referenceStepDb),
      );
      return { ...panel, referenceDb };
    }
  }
}

/** Did that step actually change anything? (No tick at the end of a range.) */
export function panelChanged(a: PanelState, b: PanelState): boolean {
  return a.spanIndex !== b.spanIndex || a.rbwIndex !== b.rbwIndex || a.referenceDb !== b.referenceDb;
}

/** Pressing Span, RBW or Ref Level. Pressing RBW again while it's active flips Auto on and off. */
export function panelPress(panel: PanelState, key: ActiveFunction): PanelState {
  if (key === 'rbw' && panel.active === 'rbw') {
    const steps = AnalyzerTuning.rbwSteps;
    return { ...panel, rbwIndex: panel.rbwIndex === null ? steps.indexOf(panelRbw(panel)) : null };
  }
  return { ...panel, active: key };
}

const TRACE_MODES: TraceMode[] = ['clearWrite', 'average', 'maxHold'];
const VIEWS: AnalyzerView[] = ['split', 'trace', 'spectrogram'];

export function panelNextTraceMode(panel: PanelState): PanelState {
  const i = TRACE_MODES.indexOf(panel.traceMode);
  return { ...panel, traceMode: TRACE_MODES[(i + 1) % TRACE_MODES.length] };
}

export function panelNextView(panel: PanelState): PanelState {
  const i = VIEWS.indexOf(panel.view);
  return { ...panel, view: VIEWS[(i + 1) % VIEWS.length] };
}

// MARK: How things read on screen

export const TRACE_MODE_NAMES: Record<TraceMode, string> = {
  clearWrite: 'Clear Write',
  average: 'Average',
  maxHold: 'Max Hold',
};

export const VIEW_NAMES: Record<AnalyzerView, string> = {
  trace: 'Trace',
  split: 'Split',
  spectrogram: 'Spectrogram',
};

/**
 * A frequency (or a width) in Hz as the Keysight writes it: three or four
 * significant digits and a unit, from Hz up to THz. "1.25 MHz", "730 Hz".
 */
export function hzLabel(hz: number): string {
  if (!(hz > 0)) {
    return '0 Hz';
  }
  const units = ['Hz', 'kHz', 'MHz', 'GHz', 'THz'];
  let u = 0;
  let value = hz;
  while (value >= 1000 && u < units.length - 1) {
    value /= 1000;
    u += 1;
  }
  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[u]}`;
}

/**
 * How many Hz a stretch of band `width` wide covers, centered on `center`.
 * The band is log-spaced, so the same width is more Hz higher up.
 */
export function bandWidthHz(center: number, width: number): number {
  if (width >= 1) {
    return Infinity; // the whole loop: there's no single width in Hz (see spanLabel)
  }
  const display = currentBandDisplay;
  const f = display.frequencyAt(center);
  const ratio = display.frequencyAt(0.999999) / display.frequencyAt(0);
  return f * (Math.pow(ratio, width / 2) - Math.pow(ratio, -width / 2));
}

/** A span as the screen writes it. The whole band reads "Full", like a real analyzer's Full Span key. */
export function spanLabel(center: number, span: number): string {
  return span >= 1 ? 'Full' : hzLabel(bandWidthHz(center, span));
}

/** "61 ms", "2.0 s". */
export function secondsLabel(seconds: number): string {
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(1)} s`;
}

/** The sweep time for the panel's span and RBW. */
export function panelSweepSeconds(panel: PanelState): number {
  return analyzerSweepSeconds(panelSpan(panel), panelRbw(panel));
}
