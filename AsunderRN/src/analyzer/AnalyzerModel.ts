import { makeMutable } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  AnalyzerTuning,
  analyzerAdvance,
  analyzerClear,
  analyzerFollow,
  createAnalyzerTrace,
  createClock,
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
}

export interface AnalyzerModel {
  /** Internal: the trace and its bookkeeping. */
  state: SharedValue<AnalyzerState>;
  /** What the sweep should use. Written from the panel (JS thread). */
  settings: SharedValue<AnalyzerSettings>;
  /** Bumped by the panel to clear the trace (e.g. a new trace mode). */
  clearCount: SharedValue<number>;

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
    }),
    settings: makeMutable(settings),
    clearCount: makeMutable(0),
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
