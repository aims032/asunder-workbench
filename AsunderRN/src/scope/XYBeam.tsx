import { BlurMask, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { makeMutable, useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  scopeBeamLevel,
  scopeClarity,
  scopeIdleShape,
  scopeStereoWindow,
  scopeTraceDepth,
  scopeXYAcross,
  ScopeTuning,
} from '../core';
import type { BandPosition } from '../core';
import type { WaveSettings } from './WaveTrace';

// THE SCOPE'S XY MODE: a picture drawn by a stereo sound. The LEFT channel
// moves the beam sideways and the RIGHT channel moves it up and down
// (core/ScopeXY.ts). There is no time axis, so the TIME knob does nothing
// here. Drawn inside ScopeScreen's canvas.
//
// Every frame it:
//   1. asks the core for the last few hundredths of a second of both
//      channels,
//   2. turns each pair of samples into a point on the screen,
//   3. joins the points up, sorting each little stroke by how fast the beam
//      was moving: slow strokes are drawn bright and fast ones dim, the way
//      a real tube glows where the beam lingers.
// With nothing on the input the beam rests: a flat line (Evan's rule), or a
// dot if ScopeTuning.idleFlatLineInXY is false.
//
// What you see, back to front: the grid, the beam's glow, then the beam in
// xyBrightnessLevels layers from dim to bright.
// The numbers are in ScopeTuning (XY mode: the sound-drawn figure).

/** One brightness layer of the beam. `index` picks the layer out of the list made each frame. */
function BeamLayer({
  layers,
  index,
  strokeWidth,
  opacity,
  blur,
}: {
  layers: SharedValue<SkPath[]>;
  index: number;
  strokeWidth: number;
  opacity: number;
  blur: number;
}) {
  const path = useDerivedValue(() => layers.value[index]);
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeJoin="round"
      strokeCap="round"
      color={ScopeTuning.xyColor}
      opacity={opacity}
    >
      {blur > 0.2 ? <BlurMask blur={blur} style="normal" /> : null}
    </Path>
  );
}

export function XYBeam({
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
  const levels = T.xyBrightnessLevels;

  // The two channels' samples. Made once and refilled every frame.
  const slice = useMemo(
    () =>
      makeMutable({
        left: new Array<number>(T.xyPoints).fill(0),
        right: new Array<number>(T.xyPoints).fill(0),
      }),
    [T.xyPoints],
  );

  // The grid, the same one Waveform mode draws.
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

  // The beam's path this frame, as a list: one path per brightness level
  // (dimmest first), and then the whole figure as one path for the glow.
  const layers = useDerivedValue(() => {
    time.value; // redraw on every frame
    const { left, right } = slice.value;
    const set = settings.value;
    const n = left.length;
    const step = T.xyWindowSeconds / (n - 1);
    // The window ends at "now" on the tape.
    const tapeNow = Date.now() / 1000 - tapeStartedAt.value;
    const idle = scopeStereoWindow(
      left,
      right,
      line.value,
      playing.value,
      tapeNow - T.xyWindowSeconds,
      step,
      scopeClarity(needle.value),
    );

    const builders = [];
    for (let k = 0; k <= levels; k += 1) {
      builders.push(Skia.PathBuilder.Make());
    }
    const whole = builders[levels];
    const brightest = builders[levels - 1];

    if (idle) {
      // The resting beam, where the position knobs have put it.
      const cx = scopeXYAcross(0, 1, set.positionAcross) * width;
      const cy = scopeTraceDepth(0, 1, set.positionUp) * height;
      if (scopeIdleShape(true) === 'flatLine') {
        brightest.moveTo(0, cy).lineTo(width, cy);
        whole.moveTo(0, cy).lineTo(width, cy);
      } else {
        // A dot: a stroke too short to see as a line (the round end makes it a dot).
        brightest.moveTo(cx, cy).lineTo(cx + 0.01, cy);
        whole.moveTo(cx, cy).lineTo(cx + 0.01, cy);
      }
    } else {
      let lastX = 0;
      let lastY = 0;
      let lastLevel = -1;
      for (let i = 0; i < n; i += 1) {
        const ax = scopeXYAcross(left[i], set.voltsPerDivision, set.positionAcross);
        const ay = scopeTraceDepth(right[i], set.voltsPerDivision2, set.positionUp);
        const x = ax * width;
        const y = ay * height;
        if (i === 0) {
          whole.moveTo(x, y);
        } else {
          whole.lineTo(x, y);
          // How far the beam went since the last sample, in grid squares.
          const dxSquares = ((x - lastX) / width) * T.gridAcross;
          const dySquares = ((y - lastY) / height) * T.gridUp;
          const squares = Math.sqrt(dxSquares * dxSquares + dySquares * dySquares);
          const level = scopeBeamLevel(squares, levels);
          // Carry on the same stroke while the brightness level stays the same.
          if (level !== lastLevel) {
            builders[level].moveTo(lastX, lastY);
          }
          builders[level].lineTo(x, y);
          lastLevel = level;
        }
        lastX = x;
        lastY = y;
      }
    }
    return builders.map((b) => b.build());
  });

  // Out of focus, the beam gets thicker and blurrier.
  const softness = (1 - focus) * T.focusBlur;
  const coreWidth = T.xyLineWidth * (1 + (1 - focus) * (T.focusSpread - 1));

  // One layer per brightness level, from xyDimmest up to full.
  const beam = [];
  for (let k = 0; k < levels; k += 1) {
    const brightness = T.xyDimmest + ((k + 1) / levels) * (1 - T.xyDimmest);
    beam.push(
      <BeamLayer
        key={k}
        layers={layers}
        index={k}
        strokeWidth={coreWidth}
        opacity={brightness * intensity}
        blur={softness}
      />,
    );
  }

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#020604" />
      <Path path={grid} style="stroke" strokeWidth={1} color={T.xyColor} opacity={T.gridOpacity} />
      <BeamLayer layers={layers} index={levels} strokeWidth={T.xyGlow} opacity={0.3 * intensity} blur={T.xyGlow} />
      {beam}
    </Group>
  );
}
