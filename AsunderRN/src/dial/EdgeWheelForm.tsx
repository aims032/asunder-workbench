import {
  Canvas,
  createPicture,
  Group,
  LinearGradient,
  PaintStyle,
  Picture,
  Rect,
  RoundedRect,
  rect,
  rrect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { Tuning } from '../core';
import type { DialForm, Point, Size } from './DialForm';

/** Sideways finger travel turns the wheel; up/down movement is ignored. */
function edgeWheelDetents(from: Point, to: Point, _size: Size): number {
  'worklet';
  return (to.x - from.x) / Tuning.pointsPerDetent;
}

/** How rounded the wheel's corners are, in points. */
const CORNER_RADIUS = 6;
/** The gap above and below the grooves, in points. */
const GROOVE_INSET = 8;

/**
 * Placeholder drawing: grooves on a rolling cylinder, one groove per detent.
 * Grooves bunch up and dim toward the edges, so it reads as round.
 * At the center a groove moves exactly as far as your finger does.
 *
 * It's drawn with Skia, a drawing library: <Canvas> is a blank area, and the
 * things inside it are drawn in order, back to front.
 */
function EdgeWheelFace({ wheelDetents }: { wheelDetents: SharedValue<number> }) {
  // The canvas tells us its size by filling in this box.
  const size = useSharedValue({ width: 0, height: 0 });

  // The pen the grooves are drawn with. Its opacity and width change per groove.
  const pen = useMemo(() => {
    const paint = Skia.Paint();
    paint.setStyle(PaintStyle.Stroke);
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color('white'));
    return paint;
  }, []);

  // The grooves, redrawn whenever the wheel turns or the size changes.
  // (useDerivedValue: "work this out again whenever a box it reads changes".)
  const grooves = useDerivedValue(() => {
    const width = size.value.width;
    const height = size.value.height;
    const radius = width / 2;
    const spacing = Tuning.pointsPerDetent; // one groove per detent
    const offset = wheelDetents.value * spacing; // how far the surface has rolled
    const halfArc = (Math.PI / 2) * radius; // visible surface, center to edge

    return createPicture((canvas) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      // Only the grooves on the visible front half of the cylinder.
      const first = Math.floor((-halfArc - offset) / spacing);
      const last = Math.ceil((halfArc - offset) / spacing);

      for (let k = first; k <= last; k += 1) {
        const arc = k * spacing + offset; // distance from center along the surface
        const angle = arc / radius; // where on the cylinder, in radians
        if (Math.abs(angle) >= Math.PI / 2) {
          continue;
        }
        const x = radius + radius * Math.sin(angle); // projected onto the flat screen
        const facing = Math.cos(angle); // 1 at center, 0 at the edges

        pen.setAlphaf(0.08 + 0.55 * facing);
        pen.setStrokeWidth(0.5 + 1.5 * facing);
        canvas.drawLine(x, GROOVE_INSET, x, height - GROOVE_INSET, pen);
      }
    });
  });

  // The wheel's outline, and the far end of the shading, both follow the size.
  const outline = useDerivedValue(() =>
    rrect(rect(0, 0, size.value.width, size.value.height), CORNER_RADIUS, CORNER_RADIUS),
  );
  const width = useDerivedValue(() => size.value.width);
  const height = useDerivedValue(() => size.value.height);
  const rightEdge = useDerivedValue(() => vec(size.value.width, 0));

  return (
    <Canvas style={StyleSheet.absoluteFill} onSize={size}>
      <Group clip={outline}>
        {/* Shading across the cylinder: dark edges, lighter middle. */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={rightEdge} colors={['#000000', '#383838', '#000000']} />
        </Rect>
        <Picture picture={grooves} />
      </Group>
      <RoundedRect rect={outline} style="stroke" strokeWidth={1} color="#4d4d4d" />
    </Canvas>
  );
}

/**
 * PROPOSED form: an edge-on thumbwheel, like the tuning wheel on an old
 * pocket radio. You see the edge of a cylinder and roll it sideways.
 * Drag right to tune up, left to tune down.
 */
export const EdgeWheelForm: DialForm = {
  detents: edgeWheelDetents,
  Face: EdgeWheelFace,
};
