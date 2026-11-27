// THE SPECTRUM ANALYZER: what it measures and how its trace is swept.
// Pure logic, no drawing. src/analyzer draws it; the work here runs on the
// screen thread, once per frame (see AnalyzerModel.ts).
//
// The `'worklet';` line below marks every function in this file as safe to
// copy over to the screen thread. It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used. Put it below and the code still works on a computer, but it
// breaks on the phone. (One test, DeclarationOrder, checks the order for you.)
'worklet';

import type { AsunderClock } from './AsunderClock';
import type { BandPosition } from './BandModel';
import { bandDistance, bandPosition } from './BandModel';
import { carrierIsOnAir, carrierPosition } from './Carrier';
import { analyzerHash, dbToPower, powerToDb } from './Levels';
import { noiseTemperatureAt } from './Reception';
import { signalBandPower } from './TuningIn';
import { AnalyzerTuning } from './Tuning';

// WHERE THE PICTURE COMES FROM (Confirmed Nov 20: "swept from the band").
//
// The analyzer does NOT listen to the speaker. The phone's sound only holds
// 0 to 24 kHz, and the band runs from 3 kHz to 1,000 THz, so a picture of the
// sound could only ever show a sliver right around the dial. Instead, for each
// point across the screen, the analyzer asks the band "how much energy is
// here, right now?", using the same clock and the same laws as the sound
// (the day's temperature, the Carrier and its dropout). Every phone at the
// same settings draws the same picture.
//
// It works like a real swept analyzer (the Keysight N9032B in its swept mode):
//
//   - The trace is drawn left to right, one point at a time. Each point is
//     measured at the moment the sweep reaches it.
//   - RBW (resolution bandwidth) is how wide a slice of the band each
//     measurement hears. Narrow RBW: sharp lines and a lower noise floor, so a
//     faint line stands out, but the sweep has to go slower. Wide RBW: a fast
//     sweep, but lines blur and the floor rises. You can't have both. That's
//     real signal processing (the Gabor/Fourier limit), not quantum.
//   - The noise floor's ragged "grass" is measurement noise: random, but
//     seeded from the band position and the clock, so it's the same on every
//     phone. Averaging calms it; max hold keeps the peaks.
//
// UNITS. Positions, span and RBW are fractions of the whole band (the same
// 0-to-1 loop as the dial; 1 detent is 1/2300). Levels are in dB, labelled
// dBm the way the Keysight labels them. The dB numbers are made up (there are
// no real watts in this band), but they behave the way real ones do: +10 dB
// is ten times the power, and powers add, not dB.

// MARK: Measurement noise

/**
 * How many cells the band is cut into for the noise: each cell gets its own
 * grass. Fine enough that even the narrowest span never shows two points
 * sharing a cell. 2^24.
 */
const NOISE_CELLS = 16_777_216;

/**
 * The noise's size at one band position and one moment, as a multiple of the
 * average noise power. Most samples are a bit under 1, a few spike well
 * above it: an "exponential" spread, which is what real noise looks like
 * through an analyzer's detector. Averages out to 1.
 *
 * The noise is fixed for each cell of the band for 1/AnalyzerTuning.grassRate
 * of a second, then it rolls on.
 */
export function analyzerNoiseFactor(position: BandPosition, nowSeconds: number): number {
  const cell = Math.floor(bandPosition(position) * NOISE_CELLS);
  const tick = Math.floor(nowSeconds * AnalyzerTuning.grassRate);
  // +1 then divide by 2^32 + 1: a number strictly between 0 and 1, never 0
  // (log of 0 would be minus infinity).
  const u = (analyzerHash(cell, tick) + 1) / 4_294_967_297;
  return -Math.log(u);
}

// MARK: What's on the band

/**
 * The noise floor at a given RBW and noise temperature (0 = Still, 1 = moving),
 * in dB. A wider RBW hears a wider slice of noise, so the floor rises 10 dB for
 * every tenfold widening (that's real). Temperature lifts the whole floor: the
 * day turn shows up as the floor stepping up or down.
 */
export function analyzerFloorDb(rbw: number, temperature: number): number {
  const t = AnalyzerTuning;
  const atReference = t.coldFloorDb + (t.hotFloorDb - t.coldFloorDb) * temperature;
  return atReference + 10 * Math.log10(rbw / t.referenceRbw);
}

/**
 * How much of a single tone's power one measurement catches, 0...1.
 *
 * The RBW filter is shaped like a bell (a Gaussian, the shape real analyzers
 * use). `rbw` is its full width at half power, the way RBW is quoted.
 *
 * Each point on the screen stands for a little stretch of band, `bucket` wide.
 * Like a real analyzer's "peak" detector, a point reports the loudest thing
 * anywhere in its stretch, so a narrow line can never fall between two points.
 */
export function analyzerFilterShape(distance: number, rbw: number, bucket: number): number {
  const outside = Math.max(0, Math.abs(distance) - bucket / 2);
  // Full width at half power -> the bell's width ("sigma"): divide by 2.355.
  const sigma = rbw / 2.3548;
  if (!(sigma > 0)) {
    return outside === 0 ? 1 : 0;
  }
  const x = outside / sigma;
  return Math.exp(-0.5 * x * x);
}

/**
 * The level the analyzer measures at one band position, one moment, in dB.
 * `bucket` is how much band one screen point stands for. `withNoise` false
 * gives the noise-free average (handy for tests and for reading the floor).
 * `dial` is where the dial is tuned; leave it out (null) to see the band
 * without any transmissions on it.
 */
export function analyzerMeasure(
  position: BandPosition,
  bucket: number,
  rbw: number,
  nowSeconds: number,
  clock: AsunderClock,
  withNoise: boolean,
  dial: BandPosition | null = null,
): number {
  const temperature = noiseTemperatureAt(nowSeconds, clock);
  let power = dbToPower(analyzerFloorDb(rbw, temperature));
  if (withNoise) {
    power *= analyzerNoiseFactor(position, nowSeconds);
  }

  // The Carrier: one steady line, gone during its day-turn dropout.
  // (Weather features are on hold, Instruments §3, so it's the only one.)
  if (carrierIsOnAir(nowSeconds, clock)) {
    const distance = bandDistance(position, carrierPosition());
    power += dbToPower(AnalyzerTuning.carrierDb) * analyzerFilterShape(distance, rbw, bucket);
  }
  // The transmissions on the band (TuningIn.ts). How sharp each one looks
  // depends on how close the dial is, so they're only drawn when the dial is
  // given (the trace passes its own center, which follows the dial).
  if (dial !== null) {
    power += signalBandPower(position, bucket, dial, nowSeconds, clock);
  }
  return powerToDb(power);
}

// MARK: Sweep time

/**
 * How long one sweep across the screen takes, in seconds.
 *
 * A real analyzer has to linger long enough at each frequency for its filter
 * to "ring up", and a narrow filter rings up slowly. That gives the classic
 * rule: sweep time = k x span / RBW^2. Halve the RBW and the sweep takes four
 * times as long. Clamped to AnalyzerTuning.fastestSweep...slowestSweep so it
 * never blurs into nothing or takes all day.
 */
export function analyzerSweepSeconds(span: number, rbw: number): number {
  const t = AnalyzerTuning;
  const raw = (t.sweepFactor * span) / (rbw * rbw);
  if (!(raw > t.fastestSweep)) {
    return t.fastestSweep; // also catches NaN
  }
  return Math.min(raw, t.slowestSweep);
}

/**
 * The RBW the analyzer picks for itself when RBW is on Auto: the widest of
 * AnalyzerTuning.rbwSteps that is no wider than span / AnalyzerTuning.spanPerRbw.
 * (Real analyzers couple RBW to span the same way.)
 */
export function analyzerAutoRbw(span: number): number {
  const steps = AnalyzerTuning.rbwSteps;
  const wanted = span / AnalyzerTuning.spanPerRbw;
  let chosen = steps[0];
  for (let i = 0; i < steps.length; i += 1) {
    if (steps[i] <= wanted * 1.0001) {
      chosen = steps[i];
    }
  }
  return chosen;
}

// MARK: The trace

/** What the trace keeps from sweep to sweep (Keysight calls these trace types). */
export type TraceMode = 'clearWrite' | 'average' | 'maxHold';

/** The settings the sweep needs. The screen owns them; see AnalyzerModel.ts. */
export interface AnalyzerSettings {
  /** How much of the band is on screen, as a fraction of the whole band (1 = all of it). */
  span: number;
  /** The RBW in use (already worked out, if RBW is on Auto). A fraction of the band. */
  rbw: number;
  traceMode: TraceMode;
}

/**
 * The trace and its history. Make one with createAnalyzerTrace and move it on
 * with analyzerAdvance. Everything is plain numbers and plain lists, changed
 * in place, so it can live on the screen thread.
 */
export interface AnalyzerTrace {
  /** How many points across the screen. */
  points: number;
  /** The band position at the middle point (unwrapped is fine). */
  center: number;
  /** The span this trace was made for. A new span starts a new trace. */
  span: number;

  /** The trace as drawn, in dB, one per point. */
  values: number[];
  /** How many sweeps each point has been averaged over (for Average mode). */
  counts: number[];
  /** Where the sweep is: a point number, with a fraction for "part way to the next". */
  sweepAt: number;
  /** How many sweeps have finished since the trace began. */
  sweeps: number;

  /**
   * The spectrogram: a stack of past sweeps, `rows` of them, each `points`
   * long, one after the other in one list. It's a ring: `newestRow` is the
   * row being written now, and older rows are the ones before it, wrapping
   * round. A NaN means "no measurement here" (drawn as dark).
   */
  rows: number;
  history: number[];
  newestRow: number;
}

/** Makes an empty trace (every value very low, no history). */
export function createAnalyzerTrace(
  points: number,
  rows: number,
  center: number,
  span: number,
): AnalyzerTrace {
  const values: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < points; i += 1) {
    values.push(-200);
    counts.push(0);
  }
  const history: number[] = [];
  for (let i = 0; i < points * rows; i += 1) {
    history.push(NaN);
  }
  return {
    points: points,
    center: center,
    span: span,
    values: values,
    counts: counts,
    sweepAt: 0,
    sweeps: 0,
    rows: rows,
    history: history,
    newestRow: 0,
  };
}

/** How much band one point stands for. */
export function analyzerBucket(trace: AnalyzerTrace): number {
  return trace.span / (trace.points - 1);
}

/** The band position of point `i` (0 = left edge). */
export function analyzerPointPosition(trace: AnalyzerTrace, i: number): BandPosition {
  return bandPosition(trace.center + (i - (trace.points - 1) / 2) * analyzerBucket(trace));
}

/** Fold a new measurement into point `i` the way the trace mode says. */
export function analyzerStore(trace: AnalyzerTrace, i: number, db: number, mode: TraceMode): void {
  const old = trace.values[i];
  const count = trace.counts[i];
  if (mode === 'maxHold') {
    trace.values[i] = count === 0 ? db : Math.max(old, db);
  } else if (mode === 'average' && count > 0) {
    // Average in power, like a real "power average": the newest sweep counts
    // for 1/n, up to AnalyzerTuning.averageCount sweeps, then it keeps rolling.
    const n = Math.min(count + 1, AnalyzerTuning.averageCount);
    trace.values[i] = powerToDb(dbToPower(old) + (dbToPower(db) - dbToPower(old)) / n);
  } else {
    trace.values[i] = db;
  }
  trace.counts[i] = count + 1;
}

/** Clears the trace and its history (a new span, or Clear/Write pressed again). */
export function analyzerClear(trace: AnalyzerTrace): void {
  for (let i = 0; i < trace.points; i += 1) {
    trace.values[i] = -200;
    trace.counts[i] = 0;
  }
  for (let i = 0; i < trace.history.length; i += 1) {
    trace.history[i] = NaN;
  }
  trace.sweepAt = 0;
  trace.sweeps = 0;
}

/**
 * Slide the whole picture sideways by `shift` points (positive = the band
 * moves left on screen, because the center went up). What slides off one
 * edge is dropped; what comes in at the other edge is measured fresh, so the
 * trace follows the dial at once instead of waiting for the next sweep.
 * The spectrogram's rows slide with it, so its history stays lined up with
 * the band underneath; the new strip of old rows is blank (NaN).
 */
export function analyzerShift(
  trace: AnalyzerTrace,
  shift: number,
  rbw: number,
  nowSeconds: number,
  clock: AsunderClock,
): void {
  const n = trace.points;
  trace.center += shift * analyzerBucket(trace);

  // Slide the trace and each history row. (A moving copy, done in the
  // direction that doesn't overwrite what it still has to read.)
  const rowCount = trace.rows;
  for (let row = -1; row < rowCount; row += 1) {
    const list = row < 0 ? trace.values : trace.history;
    const start = row < 0 ? 0 : row * n;
    if (shift > 0) {
      for (let i = 0; i < n - shift; i += 1) {
        list[start + i] = list[start + i + shift];
      }
    } else {
      for (let i = n - 1; i >= -shift; i -= 1) {
        list[start + i] = list[start + i + shift];
      }
    }
  }
  if (shift > 0) {
    for (let i = 0; i < n - shift; i += 1) {
      trace.counts[i] = trace.counts[i + shift];
    }
  } else {
    for (let i = n - 1; i >= -shift; i -= 1) {
      trace.counts[i] = trace.counts[i + shift];
    }
  }

  // Fill the edge that came in.
  const from = shift > 0 ? n - shift : 0;
  const to = shift > 0 ? n : -shift;
  const bucket = analyzerBucket(trace);
  for (let i = from; i < to; i += 1) {
    trace.values[i] = analyzerMeasure(
      analyzerPointPosition(trace, i), bucket, rbw, nowSeconds, clock, true, bandPosition(trace.center),
    );
    trace.counts[i] = 1;
    for (let row = 0; row < rowCount; row += 1) {
      trace.history[row * n + i] = NaN;
    }
  }
}

/**
 * Keeps the trace centered on the dial. Slides it by whole points only;
 * the leftover fraction of a point is handed back, so the screen can nudge
 * the drawing by that much and the trace glides smoothly under the marker.
 * A jump of a whole screen or more just starts again.
 */
export function analyzerFollow(
  trace: AnalyzerTrace,
  dial: BandPosition,
  rbw: number,
  nowSeconds: number,
  clock: AsunderClock,
): number {
  const offset = bandDistance(bandPosition(trace.center), dial) / analyzerBucket(trace);
  const whole = Math.trunc(offset);
  if (Math.abs(whole) >= trace.points) {
    trace.center = dial;
    analyzerClear(trace);
    return 0;
  }
  if (whole !== 0) {
    analyzerShift(trace, whole, rbw, nowSeconds, clock);
  }
  return offset - whole;
}

/**
 * Moves the sweep on by `dt` seconds: measures every point it passes and
 * stores it. Gives back how many sweeps finished (each one starts a new
 * spectrogram row). Never measures more than a few sweeps per call, so a
 * long pause (the app in the background) doesn't make one frame slow.
 */
export function analyzerAdvance(
  trace: AnalyzerTrace,
  dt: number,
  settings: AnalyzerSettings,
  nowSeconds: number,
  clock: AsunderClock,
): number {
  const n = trace.points;
  const sweepSeconds = analyzerSweepSeconds(trace.span, settings.rbw);
  const pointsToGo = Math.min((Math.max(dt, 0) / sweepSeconds) * n, n * AnalyzerTuning.maxSweepsPerFrame);
  if (!(pointsToGo > 0)) {
    return 0; // no time passed (or a bad number): nothing to do
  }
  const bucket = analyzerBucket(trace);

  let finished = 0;
  let at = trace.sweepAt;
  const end = at + pointsToGo;
  // Each point is measured once, as the sweep crosses it.
  let next = Math.ceil(at);
  while (next < end) {
    const i = next % n;
    // When this point was crossed, a moment ago (so even a slow frame
    // measures each point at its own moment, not all at once).
    const when = nowSeconds - ((end - next) / n) * sweepSeconds;
    const db = analyzerMeasure(
      analyzerPointPosition(trace, i), bucket, settings.rbw, when, clock, true, bandPosition(trace.center),
    );
    analyzerStore(trace, i, db, settings.traceMode);
    trace.history[trace.newestRow * n + i] = db;
    if (i === n - 1) {
      // The sweep reached the right edge: start the next spectrogram row.
      finished += 1;
      trace.sweeps += 1;
      trace.newestRow = (trace.newestRow + 1) % trace.rows;
      for (let j = 0; j < n; j += 1) {
        trace.history[trace.newestRow * n + j] = NaN;
      }
    }
    next += 1;
  }
  at = end;
  // Keep the number small: only where in the sweep matters.
  trace.sweepAt = at - Math.floor(at / n) * n;
  return finished;
}

// MARK: Reading it

/** The point with the highest level, for the Peak marker. */
export function analyzerPeakIndex(trace: AnalyzerTrace): number {
  let best = 0;
  for (let i = 1; i < trace.points; i += 1) {
    if (trace.values[i] > trace.values[best]) {
      best = i;
    }
  }
  return best;
}
