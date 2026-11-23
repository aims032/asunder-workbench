import {
  BlurMask,
  DiscretePathEffect,
  Group,
  Path,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { readVectorArt, ScopeTuning } from '../core';
import type { ScopeXYLook, VectorBox } from '../core';
import { bundledFileUri } from './ScopePictures';

// THE SCOPE'S XY MODE: vector art drawn the way an old lab oscilloscope
// draws, with one glowing green beam. Used when the patched line carries
// vector art (an SVG file). Drawn inside ScopeScreen's canvas.
//
// What you see, back to front:
//   - the grass: the fuzzy line an empty scope shows across its middle,
//   - the glow: a blurred, wider copy of the drawing,
//   - the drawing itself, thin and bright,
//   - the bright spot: the beam itself, racing round the drawing.
// Off the signal, the line wobbles and dims and the grass takes over.
// All the numbers are the xy... entries in ScopeTuning.

/** Load an SVG file bundled with the app and read it. null until it's loaded. */
export function useVectorArt(file: number | undefined): { box: VectorBox | null; shapes: string[] } | null {
  const [art, setArt] = useState<{ box: VectorBox | null; shapes: string[] } | null>(null);
  useEffect(() => {
    setArt(null);
    const uri = file === undefined ? null : bundledFileUri(file);
    if (!uri) {
      return;
    }
    let cancelled = false;
    fetch(uri)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) {
          setArt(readVectorArt(text));
        }
      })
      .catch((error) => console.error('[scope] could not read the vector art', error));
    return () => {
      cancelled = true;
    };
  }, [file]);
  return art;
}

/** All the art's shapes as one path, scaled and centered to fit the screen. */
function fitArt(art: { box: VectorBox | null; shapes: string[] }, width: number, height: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  for (const d of art.shapes) {
    const shape = Skia.Path.MakeFromSVGString(d);
    if (shape) {
      builder.addPath(shape);
    }
  }
  // Fit the art's own drawing area if the file gave one, else the shapes.
  const bounds = builder.computeBounds();
  const box = art.box ?? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  if (!(box.width > 0 && box.height > 0)) {
    return builder.build();
  }
  const margin = ScopeTuning.xyMargin;
  const scale = Math.min((width * (1 - 2 * margin)) / box.width, (height * (1 - 2 * margin)) / box.height);
  const matrix = Skia.Matrix();
  matrix.translate(width / 2, height / 2);
  matrix.scale(scale, scale);
  matrix.translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
  builder.transform(matrix);
  return builder.build();
}

export function XYTrace({
  art,
  width,
  height,
  look,
  time,
}: {
  art: { box: VectorBox | null; shapes: string[] } | null;
  width: number;
  height: number;
  look: SharedValue<ScopeXYLook>;
  /** Seconds, counting up (from ScopeScreen). */
  time: SharedValue<number>;
}) {
  const T = ScopeTuning;
  const drawing = useMemo(() => (art ? fitArt(art, width, height) : null), [art, width, height]);
  const grass = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(0, height / 2);
    p.lineTo(width, height / 2);
    return p.build();
  }, [width, height]);

  // The wobble changes pattern a few dozen times a second, so the line shimmers.
  const seed = useDerivedValue(() => Math.floor(time.value * T.snowRate));
  const wobble = useDerivedValue(() => look.value.wobble * width);
  const glowOpacity = useDerivedValue(() => 0.45 * look.value.brightness);
  const lineOpacity = useDerivedValue(() => 0.9 * look.value.brightness);
  const grassOpacity = useDerivedValue(() => 0.6 * look.value.grass);
  const grassHeight = useDerivedValue(() => height * 0.04 * (0.3 + look.value.grass));
  // The bright spot's place along the drawing, 0 (start) to 1 (end).
  const spotStart = useDerivedValue(() => (time.value / T.xyTraceSeconds) % 1);
  const spotEnd = useDerivedValue(() => Math.min(1, spotStart.value + T.xyTraceLength));

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="#020604" />
      <Path path={grass} style="stroke" strokeWidth={1.2} color={T.xyColor} opacity={grassOpacity}>
        <DiscretePathEffect length={3} deviation={grassHeight} seed={seed} />
      </Path>
      {drawing ? (
        <Group>
          <Path path={drawing} style="stroke" strokeWidth={T.xyGlow} color={T.xyColor} opacity={glowOpacity}>
            <BlurMask blur={T.xyGlow} style="normal" />
            <DiscretePathEffect length={8} deviation={wobble} seed={seed} />
          </Path>
          <Path path={drawing} style="stroke" strokeWidth={T.xyLineWidth} color={T.xyColor} opacity={lineOpacity}>
            <DiscretePathEffect length={8} deviation={wobble} seed={seed} />
          </Path>
          <Path
            path={drawing}
            style="stroke"
            strokeWidth={T.xyLineWidth * 2}
            strokeCap="round"
            color="#eafff2"
            opacity={lineOpacity}
            start={spotStart}
            end={spotEnd}
          >
            <BlurMask blur={2} style="solid" />
          </Path>
        </Group>
      ) : null}
    </Group>
  );
}
