import type { ComponentType } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The shape of the dial: how a finger turns it, and how it's drawn.
 *
 * The dial's form is OPEN (Instruments §0): an edge-on wheel, a face-on wheel,
 * or a knob. The physics doesn't care which; each form only answers two things.
 * To try a different form, write another object that fits this and swap
 * it in ContentView. That's the only line that changes.
 *
 * Phase 1 forms are plain placeholder drawings. Evan's artwork replaces the
 * `Face` in Phase 4; the gesture math stays.
 */
export interface DialForm {
  /**
   * How many detents the wheel turns when a finger moves from `from` to `to`
   * inside a dial of this `size`. Positive = up the band.
   * It runs on the screen thread, so it must be a 'worklet' (see DialModel.ts).
   */
  detents: (from: Point, to: Point, size: Size) => number;

  /**
   * The dial drawn at a given turn (detents, unwrapped: keeps counting past a lap).
   * `wheelDetents` is a shared value: the drawing follows it without being told.
   */
  Face: ComponentType<{ wheelDetents: SharedValue<number> }>;
}

/** A place on the screen, in points, measured from the dial's top-left corner. */
export interface Point {
  x: number;
  y: number;
}

/** How big the dial is on screen, in points. */
export interface Size {
  width: number;
  height: number;
}
