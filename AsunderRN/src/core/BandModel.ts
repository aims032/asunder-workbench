// Two jobs in one file. The position helpers (bandPosition, bandDistance,
// bellStrength) are also used on the audio thread, through the Carrier and
// Reception code (see src/audio). The display parts (BandDisplay, the FM
// example, currentBandDisplay) are only for drawing and labels on screen. The
// 'worklet' line below marks the functions as allowed to run off the main thread.
'worklet';

import { createSpectrumDisplay } from './SpectrumDisplay';
import { roundHalfAwayFromZero, toInteger, wrapUnit } from './Wrap';

// READING THIS FILE (notes, each explained once)
//
// RULE: a helper function has to be written ABOVE the first place it is used.
// If the order is wrong the code still works on a computer but the phone app
// breaks, because the build step that prepares worklet code needs it.
// (One test, DeclarationOrder, checks the order for you.)
//
// NaN GUARD: bellStrength has `!(width > 0)`. NaN means "not a number". Every
// comparison with NaN is false, so `width <= 0` would let a NaN through, while
// `!(width > 0)` catches it. Don't tidy it into `width <= 0`.
//
// `interface FMBandDisplay extends BandDisplay` means "everything BandDisplay
// has, plus these extra parts".
//
// `(position) => ...` is a short way to write a function. A parameter named
// with a leading underscore (`_position`) is one the function ignores.

// THE BAND
//
// A position on the band is a number in 0..<1 that wraps: the band is a loop
// (Confirmed Nov 6). Everything that lives on the band (the dial, the Carrier,
// later the weather and the transmissions) uses BandPosition, so no code ever
// has to remember to wrap by hand.
//
// What number the listener *sees* is a separate job: see BandDisplay below.
// Since Nov 19 that's a wide spectrum, from radio up through visible light
// (SpectrumDisplay). The old FM-looking band is kept as a simple example.

/**
 * A place on the band. Always 0..<1.
 * It's a plain number, so nothing stops a wrong one being used by mistake:
 * always make one with bandPosition(raw), which folds it onto the loop.
 */
export type BandPosition = number;

/** Any number works; it gets folded onto the loop. 1.2 becomes 0.2. */
export function bandPosition(raw: number): BandPosition {
  return wrapUnit(raw);
}

/**
 * This position, moved along the band. Positive moves up, negative moves down,
 * and moving past the top comes back in at the bottom.
 */
export function bandMoved(position: BandPosition, delta: number): BandPosition {
  return bandPosition(position + delta);
}

/**
 * The shortest way from `from` to `to`, going around the loop either way.
 * Positive means `to` is above, negative means below. Always -0.5..<0.5.
 *
 * From 0.95 to 0.05 this is +0.1 (across the seam), not -0.9.
 * Signal strength uses this, so a feature near the seam is still easy to hear.
 */
export function bandDistance(from: BandPosition, to: BandPosition): number {
  return wrapUnit(to - from + 0.5) - 0.5;
}

/**
 * How strong a feature sounds from a given distance: a bell curve.
 * 1 dead on center, about 0.6 at one `width` away, near 0 past three widths.
 * `width` is a fraction of the whole band (0.002 = 0.2% of it).
 */
export function bellStrength(distance: number, width: number): number {
  // A width that isn't above zero can't make a bell, so it becomes a spike:
  // full strength only exactly on center.
  if (!(width > 0)) {
    return distance === 0 ? 1 : 0;
  }
  const x = distance / width;
  return Math.exp(-0.5 * x * x);
}

// MARK: - Display

/**
 * Turns a band position into the number shown on the dial.
 * The app only talks to this interface, so the band's numbers live in one place.
 */
export interface BandDisplay {
  /** The frequency for a position, in the display's own units. */
  frequencyAt(position: BandPosition): number;
  /** The number as the readout shows it, e.g. "19.93". */
  labelAt(position: BandPosition): string;
  /** The unit that goes with that number, e.g. "MHz". */
  unitAt(position: BandPosition): string;
  /** Marks printed on the dial's scale. A label is null for an unnumbered tick. */
  scaleMarks(): ScaleMark[];
}

/** One mark on the printed scale. */
export interface ScaleMark {
  position: BandPosition;
  label: string | null;
}

/**
 * SUPERSEDED Nov 19 by SpectrumDisplay: an FM-looking band, 87.5 to 108.0.
 * Kept as the simplest example of a BandDisplay.
 * Position 0 reads 87.5; just under 1 reads 108.0; then it loops back to 87.5.
 */
export interface FMBandDisplay extends BandDisplay {
  bottom: number;
  top: number;
}

/**
 * Makes the FM-looking display. Only the screen uses this (never the audio
 * thread), which is why the object it returns is allowed to hold functions.
 */
export function createFMBandDisplay(): FMBandDisplay {
  const display: FMBandDisplay = {
    bottom: 87.5,
    top: 108.0,

    frequencyAt: (position) => display.bottom + position * (display.top - display.bottom),

    labelAt: (position) => {
      // One decimal, like a real FM readout. Built by hand rather than with
      // a number-formatting library so it's identical on every platform.
      const tenths = toInteger(roundHalfAwayFromZero(display.frequencyAt(position) * 10));
      return `${toInteger(tenths / 10)}.${tenths % 10}`;
    },

    unitAt: (_position) => 'MHz',

    /**
     * A tick at every whole number (88 ... 107), numbered every 4 (88, 92 ... 104).
     * 108 is skipped: it's the same spot as 87.5, where the loop joins.
     */
    scaleMarks: () => {
      const marks: ScaleMark[] = [];
      for (let mhz = 88; mhz <= 107; mhz += 1) {
        marks.push({
          position: bandPosition((mhz - display.bottom) / (display.top - display.bottom)),
          label: mhz % 4 === 0 ? `${mhz}` : null,
        });
      }
      return marks;
    },
  };
  return display;
}

/** The display the app uses. Swap this one line to change the whole band's numbers. */
export const currentBandDisplay: BandDisplay = createSpectrumDisplay();
