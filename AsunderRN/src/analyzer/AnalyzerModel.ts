import { makeMutable } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  AnalyzerTuning,
  analyzerAdvance,
  analyzerClear,
  analyzerFollow,
  createAnalyzerTrace,
  createClock,
  lineAdvance,
  STAND_IN_TRANSMISSION,
} from '../core';
import type { AnalyzerSettings, AnalyzerTrace, AsunderClock, BandPosition } from '../core';

// THE LIVE ANALYZER: owns the trace and moves the sweep on every frame.
//
// Like the dial (see DialModel.ts), it runs on the screen's own thread, so
// it can follow the dial's needle and redraw without waiting on anything.
// The panel's settings come in from the JS thread through `settings`; the
// drawings watch `frame` and `nudge`.

interface AnalyzerState {
  trace: AnalyzerTrace;
  clock: AsunderClock;
  /** The `clearCount` last acted on, to notice a new Clear request. */
  clearsSeen: number;
  /** Which input the trace on screen was drawn from, to notice a switch. */
  inputSeen: AnalyzerInput;
  /** Which phone line it was drawn from, to notice a re-patch. */
  lineSeen: string | null;
}

/**
 * What the analyzer is looking at: the radio BAND (as always), or the LINE
 * input, which is whatever phone line is patched into it on the switchboard.
 */
export type AnalyzerInput = 'band' | 'line';

export interface AnalyzerModel {
  /** Internal: the trace and its bookkeeping. */
  state: SharedValue<AnalyzerState>;
  /** What the sweep should use. Written from the panel (JS thread). */
  settings: SharedValue<AnalyzerSettings>;
  /** Bumped by the panel to clear the trace (e.g. a new trace mode). */
  clearCount: SharedValue<number>;
  /** BAND or LINE. Written from the panel's INPUT key. */
  input: SharedValue<AnalyzerInput>;
  /**
   * The phone line patched into the analyzer on the switchboard, or null if
   * nothing is. Written whenever the switchboard changes (see Bench.ts).
   */
  patchedLine: SharedValue<string | null>;

  // What the drawings read:
  /** Goes up by 1 every frame the trace changes, so the drawing knows to redraw. */
  frame: SharedValue<number>;
  /**
   * The fraction of a point the trace is off center by (see analyzerFollow).
   * The drawing slides the trace by this much so it glides under the marker.
   */
  nudge: SharedValue<number>;
}

export function createAnalyzerModel(settings: AnalyzerSettings, start: BandPosition): AnalyzerModel {
  return {
    state: makeMutable<AnalyzerState>({
      trace: createAnalyzerTrace(AnalyzerTuning.points, AnalyzerTuning.spectrogramRows, start, settings.span),
      clock: createClock(),
      clearsSeen: 0,
      inputSeen: 'band',
      lineSeen: null,
    }),
    settings: makeMutable(settings),
    clearCount: makeMutable(0),
    input: makeMutable<AnalyzerInput>('band'),
    patchedLine: makeMutable<string | null>(null),
    frame: makeMutable(0),
    nudge: makeMutable(0),
  };
}

/**
 * Move the analyzer on by `dt` seconds, following the dial's needle.
 * Called once per screen frame (AnalyzerScreen starts it).
 */
export function analyzerModelFrame(model: AnalyzerModel, needle: BandPosition, dt: number): void {
  'worklet';
  const state = model.state.value;
  const trace = state.trace;
  const settings = model.settings.value;
  const now = Date.now() / 1000;
  const input = model.input.value;
  const line = model.patchedLine.value;

  // Switched between BAND and LINE, or a different line was patched in:
  // wipe the screen so the old picture doesn't linger under the new one.
  if (state.inputSeen !== input || (input === 'line' && state.lineSeen !== line)) {
    state.inputSeen = input;
    state.lineSeen = line;
    trace.center = needle;
    analyzerClear(trace);
  }

  // LINE: sweep the patched phone line instead of the band. The dial has no
  // say here, so the trace doesn't slide (nudge stays 0).
  if (input === 'line') {
    if (state.clearsSeen !== model.clearCount.value) {
      state.clearsSeen = model.clearCount.value;
      analyzerClear(trace);
    }
    model.nudge.value = 0;
    lineAdvance(trace, dt, settings.traceMode, now, STAND_IN_TRANSMISSION, line);
    model.frame.value += 1;
    return;
  }

  // A new span, or a Clear: start the trace again where the dial is.
  if (trace.span !== settings.span || state.clearsSeen !== model.clearCount.value) {
    state.clearsSeen = model.clearCount.value;
    trace.span = settings.span;
    trace.center = needle;
    analyzerClear(trace);
  }

  model.nudge.value = analyzerFollow(trace, needle, settings.rbw, now, state.clock);
  analyzerAdvance(trace, dt, settings, now, state.clock);
  model.frame.value += 1;
}
