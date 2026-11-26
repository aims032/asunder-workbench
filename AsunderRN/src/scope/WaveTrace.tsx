import { BlurMask, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { makeMutable, useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  scopeClarity,
  scopeSecondsPerSample,
  scopeSignalWindow,
  scopeSweepStart,
  scopeTraceDepth,
  ScopeTuning,
  STAND_IN_TRANSMISSION,
} from '../core';
import type { BandPosition } from '../core';

// THE SCOPE'S WAVEFORM MODE: the sound on the patched phone line, drawn the
// way a lab oscilloscope draws it. The beam sweeps left to right over time
// and the sound moves it up and down. Drawn inside ScopeScreen's canvas.
//
// Every frame it:
//   1. asks the core for the latest slice of sound (ScopeSignal.ts),
//   2. finds where the sweep should start so a steady wave holds still
//      (the trigger, ScopeTrace.ts),
//   3. draws one screen's worth from there as a glowing green line.
// With nothing on the input the slice is all zeros, so the line is flat.
//
// What you see, back to front: the grid, the beam's glow, the beam.
// The numbers are in ScopeTuning (Waveform mode and The signal).
// The knobs (ScopePanel.tsx) set Time/div, Volts/div, the positions, the
// trigger level, and how bright and sharp the beam is.

/** The knob settings the drawing reads every frame. */
export interface WaveSettings {
  /** Seconds per grid square. */
  timePerDivision: number;
  /** Signal per grid square. */
  voltsPerDivision: number;
  /** How far the trace is moved, in grid squares. */
  positionUp: number;
  positionAcross: number;
  /** The trigger level, as a signal height. */
  triggerLevel: number;
}

export function WaveTrace({
  width,
  height,
  needle,
  line,
  playing,
  tapeStartedAt,
  time,
  settings,
  intensity,
  focus,
}: {
  width: number;
  height: number;
  needle: SharedValue<BandPosition>;
  /** The phone line patched into the SCOPE jack (null = nothing). */
  line: SharedValue<string | null>;
  /** Whether the tape is running. */
  playing: SharedValue<boolean>;
  /** The clock time (Unix seconds) the tape was at 0. */
  tapeStartedAt: SharedValue<number>;
  /** Seconds, counting up (from ScopeScreen). Reading it redraws every frame. */
  time: SharedValue<number>;
  /** Where the knobs are set. */
  settings: SharedValue<WaveSettings>;
  /** How bright the beam is, 0 to 1 (the Intensity knob). */
  intensity: number;
  /** How sharp the beam is, 0 (soft) to 1 (sharp) (the Focus knob). */
  focus: number;
}) {
  const T = ScopeTuning;

  // The slice of sound: two screens' worth, so the trigger has a whole
  // screen to search and still leaves a whole screen to draw. Made once and
  // refilled every frame.
  const slice = useMemo(() => makeMutable({ samples: new Array<number>(T.tracePoints * 2).fill(0) }), [T.tracePoints]);

  // The grid, drawn once per size. The middle lines are drawn twice so they
  // show a little brighter, like the center lines on a real scope.
  const grid = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let i = 0; i <= T.gridAcross; i += 1) {
      const x = (i / T.gridAcross) * width;
      builder.moveTo(x, 0).lineTo(x, height);
    }
    for (let i = 0; i <= T.gridUp; i += 1) {
      const y = (i / T.gridUp) * height;
      builder.moveTo(0, y).lineTo(width, y);
    }
    builder.moveTo(width / 2, 0).lineTo(width / 2, height);
    builder.moveTo(0, height / 2).lineTo(width, height / 2);
    return builder.build();
  }, [width, height, T.gridAcross, T.gridUp]);

  const trace = useDerivedValue(() => {
    time.value; // redraw on every frame
    const samples = slice.value.samples;
    const set = settings.value;
    const visible = T.tracePoints;
    const step = scopeSecondsPerSample(set.timePerDivision, visible);
    // The slice ends at "now" on the tape.
    const tapeNow = Date.now() / 1000 - tapeStartedAt.value;
    const from = tapeNow - (samples.length - 1) * step;
    scopeSignalWindow(
      samples,
      STAND_IN_TRANSMISSION,
      line.value,
      playing.value,
      from,
      step,
      scopeClarity(needle.value),
    );
    const start = scopeSweepStart(samples, set.triggerLevel, visible);

    const builder = Skia.PathBuilder.Make();
    const dx = width / (visible - 1);
    // The horizontal position slides the whole trace sideways.
    const shift = (set.positionAcross / T.gridAcross) * width;
    for (let i = 0; i < visible; i += 1) {
      const y = scopeTraceDepth(samples[start + i], set.voltsPerDivision, set.positionUp) * height;
      if (i === 0) {
        builder.moveTo(shift, y);
      } else {
        builder.lineTo(shift + i * dx, y);
      }
    }
    return builder.build();
  });

  // Out of focus, the beam gets thicker and blurrier.
  const softness = (1 - focus) * T.focusBlur;
  const coreWidth = T.xyLineWidth * (1 + (1 - focus) * (T.focusSpread - 1));

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#020604" />
      <Path path={grid} style="stroke" strokeWidth={1} color={T.xyColor} opacity={T.gridOpacity} />
      <Path path={trace} style="stroke" strokeWidth={T.xyGlow} strokeJoin="round" color={T.xyColor} opacity={0.5 * intensity}>
        <BlurMask blur={T.xyGlow} style="normal" />
      </Path>
      <Path path={trace} style="stroke" strokeWidth={coreWidth} strokeJoin="round" color={T.xyColor} opacity={intensity}>
        {softness > 0.2 ? <BlurMask blur={softness} style="normal" /> : null}
      </Path>
    </Group>
  );
}
