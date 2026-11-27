// The wide-band display: turns a band position into the frequency, label and
// scale marks the screen draws. Only the screen uses it; the audio thread
// never does. (The 'worklet' line below is kept like the other core files.)
'worklet';

import type { BandDisplay, BandPosition, ScaleMark } from './BandModel';
import { roundHalfAwayFromZero, toInteger, wrapUnit } from './Wrap';

// RULE: a helper function has to be written ABOVE the first place it is used.
// If the order is wrong the code still works on a computer but the phone app
// breaks, because the build step that prepares worklet code needs it. (One
// test, DeclarationOrder, checks the order for you.) So the number-writing
// helpers come first here, and the display itself comes last.
//
// `(position) => ...` is a short way to write a function.

// MARK: Writing the numbers

/** The units the readout uses, smallest first. */
const units = [
  { name: 'kHz', hz: 1e3 },
  { name: 'MHz', hz: 1e6 },
  { name: 'GHz', hz: 1e9 },
  { name: 'THz', hz: 1e12 },
];

/** What spectrumReadout hands back: the number as text, and its unit. */
export interface SpectrumReadout {
  number: string;
  unit: string;
}

/**
 * A frequency as four significant digits and a unit: "3.000 kHz",
 * "19.93 MHz", "172.8 GHz". Four digits is enough for neighboring notches
 * to read differently. Built by hand (no number-formatting library) so it
 * reads the same on every platform.
 */
export function spectrumReadout(hz: number): SpectrumReadout {
  // The biggest unit that keeps the number at 1 or more.
  let unitIndex = 0;
  for (let i = 0; i < units.length; i += 1) {
    if (hz >= units[i].hz) {
      unitIndex = i;
    }
  }
  let value = hz / units[unitIndex].hz;

  // Four significant digits: 3 after the point below 10, 2 below 100, 1 below 1000.
  let decimals = value < 10 ? 3 : value < 100 ? 2 : 1;
  let digits = toInteger(roundHalfAwayFromZero(value * Math.pow(10, decimals)));

  // Rounding can carry over: 9.9996 becomes 10.000, 999.96 becomes 1000.0.
  if (digits >= 10_000) {
    if (decimals > 1) {
      decimals -= 1;
    } else if (unitIndex < units.length - 1) {
      unitIndex += 1;
      value /= 1000;
      decimals = 3;
    } else {
      decimals = 0; // the very top of the band: "1000 THz"
    }
    digits = toInteger(roundHalfAwayFromZero(value * Math.pow(10, decimals)));
  }

  // Put the decimal point back in: the last `decimals` digits go after it.
  const text = String(digits);
  const pointAt = Math.max(text.length - decimals, 0);
  const number = decimals === 0 ? text : text.slice(0, pointAt) + '.' + text.slice(pointAt);
  return { number: number, unit: units[unitIndex].name };
}

/** Short scale labels for powers of ten: "10k", "100M", "1T". */
export function spectrumShortLabel(hz: number): string {
  const r = spectrumReadout(hz);
  // The part before the decimal point (the first piece that isn't empty).
  const whole = r.number.split('.').find((piece) => piece !== '') ?? r.number;
  return whole + r.unit.slice(0, 1);
}

// MARK: The band's two ends

/**
 * The bottom and top of the wide band, in Hz. PLACEHOLDERS (see bottomHz and
 * topHz below, which read these). They sit out here as plain numbers so code
 * on the audio thread can use them too (see spectrumPositionOfHz).
 */
export const SPECTRUM_BOTTOM_HZ = 3e3;
export const SPECTRUM_TOP_HZ = 1e15;

/**
 * Where on the band a frequency (in Hz) sits. The same sum as the display's
 * positionOfHz, but a plain function, so the audio thread can call it.
 */
export function spectrumPositionOfHz(hz: number): number {
  return wrapUnit(Math.log10(hz / SPECTRUM_BOTTOM_HZ) / Math.log10(SPECTRUM_TOP_HZ / SPECTRUM_BOTTOM_HZ));
}

// MARK: The display

/**
 * THE WIDE BAND (Confirmed Nov 19): the dial covers a huge stretch of the
 * spectrum, from radio up through infrared and visible light, not an FM band.
 *
 * The numbers are spaced logarithmically: every tenfold stretch (1 to 10 MHz,
 * 10 to 100 MHz, ...) gets the same room on the dial, the way wideband
 * analyzers draw it. Spaced evenly, the top end would swallow nearly the whole dial.
 *
 * Position 0 reads the bottom frequency. Going up, the number multiplies by
 * the same amount for every step, and past the top it loops back to the bottom.
 */
export interface SpectrumDisplay extends BandDisplay {
  /**
   * The ends of the band, in Hz. Evan chose "radio through light" and
   * decided the top stops at light, not the string (Planck) scale. The exact
   * numbers are PLACEHOLDERS: 3 kHz is the bottom of radio; 1,000 THz is
   * just past violet light.
   */
  bottomHz: number;
  topHz: number;

  /** How many tenfold stretches the band covers (about 11.5). */
  decades(): number;

  /** The other way round: where on the band a frequency (in Hz) sits. */
  positionOfHz(hz: number): BandPosition;
}

/**
 * Makes the wide-band display. Only the screen uses this (never the audio
 * thread), which is why the object it returns is allowed to hold functions.
 */
export function createSpectrumDisplay(): SpectrumDisplay {
  const display: SpectrumDisplay = {
    bottomHz: SPECTRUM_BOTTOM_HZ,
    topHz: SPECTRUM_TOP_HZ,

    decades: () => Math.log10(display.topHz / display.bottomHz),

    /** The frequency at a position, in Hz. */
    frequencyAt: (position) =>
      display.bottomHz * Math.pow(display.topHz / display.bottomHz, position),

    // (wrapUnit folds the answer onto the loop, exactly as bandPosition() in
    // BandModel.ts does. It's used directly because BandModel.ts already
    // imports this file, and two files must not import each other.)
    positionOfHz: (hz) => wrapUnit(Math.log10(hz / display.bottomHz) / display.decades()),

    labelAt: (position) => spectrumReadout(display.frequencyAt(position)).number,

    unitAt: (position) => spectrumReadout(display.frequencyAt(position)).unit,

    /**
     * A numbered mark at every power of ten ("10k", "1M", "100G" ...), and
     * small unnumbered marks at 2 and 5 times each one, like log graph paper.
     */
    scaleMarks: () => {
      const marks: ScaleMark[] = [];
      const steps = [
        { step: 1.0, numbered: true },
        { step: 2.0, numbered: false },
        { step: 5.0, numbered: false },
      ];
      let power = 1e3;
      while (power < display.topHz) {
        for (const { step, numbered } of steps) {
          const hz = power * step;
          // Skip the very ends: the top is the same spot as the bottom.
          if (hz > display.bottomHz && hz < display.topHz) {
            marks.push({
              position: display.positionOfHz(hz),
              label: numbered ? spectrumShortLabel(hz) : null,
            });
          }
        }
        power *= 10;
      }
      return marks;
    },
  };
  return display;
}
