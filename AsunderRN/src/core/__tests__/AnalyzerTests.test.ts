import type { AnalyzerSettings } from '../index';
import {
  AnalyzerTuning,
  analyzerAdvance,
  analyzerAutoRbw,
  analyzerFloorDb,
  analyzerFollow,
  analyzerMeasure,
  analyzerNoiseFactor,
  analyzerPeakIndex,
  analyzerPointPosition,
  analyzerSweepSeconds,
  bandDistance,
  createAnalyzerTrace,
  createClock,
  World,
} from '../index';
import { movingMidday, movingToStillTurn, stillMidday } from './AudioTestHelpers';

// The spectrum analyzer (new in the React Native app; there's no Swift version).
// What matters most: the same moment and settings give the same picture on
// every phone, the trade-offs behave like a real analyzer, and the picture
// wraps correctly where the band's loop joins.

describe('AnalyzerTests', () => {
  const clock = createClock();
  const carrier = World.carrierPosition;
  const span = 0.1;
  const rbw = 1e-3;
  const settings: AnalyzerSettings = { span: span, rbw: rbw, traceMode: 'clearWrite' };

  /** Sweeps a fresh trace centered on `center` for `seconds`, starting at `start`. */
  function sweptTrace(center: number, start: number, seconds: number, s = settings) {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, center, s.span);
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) {
      analyzerAdvance(trace, step, s, start + t + step, clock);
    }
    return trace;
  }

  // MARK: Same everywhere

  test('the same moment and settings give the same trace', () => {
    const a = sweptTrace(0.3, movingMidday, 1);
    const b = sweptTrace(0.3, movingMidday, 1);
    expect(a.values).toEqual(b.values);
  });

  test('the grass is the same at the same place and moment, and changes over time', () => {
    expect(analyzerNoiseFactor(0.4, movingMidday)).toBe(analyzerNoiseFactor(0.4, movingMidday));
    const later = movingMidday + 1 / AnalyzerTuning.grassRate;
    expect(analyzerNoiseFactor(0.4, later)).not.toBe(analyzerNoiseFactor(0.4, movingMidday));
  });

  test('the grass averages out to about 1', () => {
    let sum = 0;
    const n = 20_000;
    for (let i = 0; i < n; i += 1) {
      sum += analyzerNoiseFactor(i / n, movingMidday);
    }
    expect(sum / n).toBeCloseTo(1, 1);
  });

  // MARK: What it sees

  test('the Carrier stands well above the floor, and nothing else does', () => {
    const onIt = analyzerMeasure(carrier, 0, rbw, movingMidday, clock, false);
    const away = analyzerMeasure(carrier + 0.2, 0, rbw, movingMidday, clock, false);
    expect(onIt).toBeCloseTo(AnalyzerTuning.carrierDb, 0);
    expect(away).toBeCloseTo(analyzerFloorDb(rbw, 1), 5);
    expect(onIt - away).toBeGreaterThan(20);
  });

  test('the Carrier is gone from the analyzer during its day-turn dropout', () => {
    const inDropout = movingToStillTurn + World.carrierDropoutSeconds / 2;
    const db = analyzerMeasure(carrier, 0, rbw, inDropout, clock, false);
    expect(db).toBeLessThan(AnalyzerTuning.carrierDb - 20);
  });

  test('the floor is lower on Still days than on moving days', () => {
    const moving = analyzerMeasure(0.8, 0, rbw, movingMidday, clock, false);
    const still = analyzerMeasure(0.8, 0, rbw, stillMidday, clock, false);
    expect(moving - still).toBeCloseTo(AnalyzerTuning.hotFloorDb - AnalyzerTuning.coldFloorDb, 5);
  });

  test('a tenfold narrower RBW lowers the floor by 10 dB', () => {
    expect(analyzerFloorDb(1e-4, 1) - analyzerFloorDb(1e-3, 1)).toBeCloseTo(-10, 5);
  });

  test('a narrower RBW draws a thinner line', () => {
    const offBy = 0.002;
    const wide = analyzerMeasure(carrier + offBy, 0, 1e-2, movingMidday, clock, false);
    const narrow = analyzerMeasure(carrier + offBy, 0, 1e-4, movingMidday, clock, false);
    expect(wide).toBeGreaterThan(AnalyzerTuning.carrierDb - 3);
    expect(narrow).toBeLessThan(analyzerFloorDb(1e-4, 1) + 1);
  });

  test('a point that has the Carrier anywhere in its stretch reports it (peak detector)', () => {
    const bucket = 0.01;
    const db = analyzerMeasure(carrier + bucket * 0.45, bucket, 1e-5, movingMidday, clock, false);
    expect(db).toBeCloseTo(AnalyzerTuning.carrierDb, 0);
  });

  // MARK: The sweep

  test('halving the RBW makes the sweep four times as long', () => {
    const a = analyzerSweepSeconds(0.01, 2e-4);
    const b = analyzerSweepSeconds(0.01, 1e-4);
    expect(b / a).toBeCloseTo(4, 5);
  });

  test('the sweep time stays between the fastest and slowest allowed', () => {
    expect(analyzerSweepSeconds(1, 1e-2)).toBe(AnalyzerTuning.fastestSweep);
    expect(analyzerSweepSeconds(1, 1e-5)).toBe(AnalyzerTuning.slowestSweep);
    expect(analyzerSweepSeconds(NaN, 1e-3)).toBe(AnalyzerTuning.fastestSweep);
  });

  test('Auto RBW follows the span', () => {
    expect(analyzerAutoRbw(0.1)).toBeCloseTo(1e-3, 10);
    expect(analyzerAutoRbw(1)).toBeCloseTo(1e-2, 10);
    expect(analyzerAutoRbw(0.003)).toBeCloseTo(3e-5, 10);
  });

  test('one sweep time measures every point once and finishes one sweep', () => {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, 0.5, span);
    const seconds = analyzerSweepSeconds(span, rbw);
    const finished = analyzerAdvance(trace, seconds, settings, movingMidday, clock);
    expect(finished).toBe(1);
    expect(trace.counts.every((c) => c === 1)).toBe(true);
  });

  test('a bad frame time does nothing instead of breaking the sweep', () => {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, 0.5, span);
    expect(analyzerAdvance(trace, NaN, settings, movingMidday, clock)).toBe(0);
    expect(trace.sweepAt).toBe(0);
  });

  // MARK: Following the dial, and the loop

  test('the peak is the Carrier when it is on screen', () => {
    const trace = sweptTrace(carrier + 0.02, movingMidday, 1);
    const peakAt = analyzerPointPosition(trace, analyzerPeakIndex(trace));
    expect(Math.abs(bandDistance(peakAt, carrier))).toBeLessThan(span / (AnalyzerTuning.points - 1));
  });

  test('the picture wraps across the seam where the band loops', () => {
    // Center the screen right on the seam (position 0 = position 1).
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, 0, span);
    const left = analyzerPointPosition(trace, 0);
    const right = analyzerPointPosition(trace, AnalyzerTuning.points - 1);
    expect(left).toBeCloseTo(1 - span / 2, 10);
    expect(right).toBeCloseTo(span / 2, 10);
  });

  test('following the dial slides the trace, keeping it lined up with the band', () => {
    const trace = sweptTrace(carrier, movingMidday, 1);
    const before = trace.values.slice();
    const bucket = span / (AnalyzerTuning.points - 1);
    // Move the dial up by 10 points and a bit.
    const leftover = analyzerFollow(trace, carrier + 10.4 * bucket, rbw, movingMidday + 1, clock);
    expect(leftover).toBeCloseTo(0.4, 5);
    // What was at point 15 is now at point 5.
    expect(trace.values[5]).toBe(before[15]);
  });

  test('following the dial across the seam works the short way round', () => {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, 0.999, span);
    const bucket = span / (AnalyzerTuning.points - 1);
    const leftover = analyzerFollow(trace, 0.999 + 3 * bucket - 1, rbw, movingMidday, clock);
    expect(Math.abs(leftover)).toBeLessThan(1e-6);
    expect(bandDistance(analyzerPointPosition(trace, 200), 0.999 + 3 * bucket)).toBeCloseTo(0, 8);
  });

  // MARK: Trace modes

  test('max hold never goes down', () => {
    const hold: AnalyzerSettings = { ...settings, traceMode: 'maxHold' };
    const trace = createAnalyzerTrace(AnalyzerTuning.points, 4, 0.7, span);
    const seconds = analyzerSweepSeconds(span, rbw);
    analyzerAdvance(trace, seconds, hold, movingMidday, clock);
    const first = trace.values.slice();
    analyzerAdvance(trace, seconds, hold, movingMidday + 1, clock);
    trace.values.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(first[i]));
  });

  test('averaging calms the grass', () => {
    function spread(values: number[]): number {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length);
    }
    const plain = sweptTrace(0.8, movingMidday, 3);
    const averaged = sweptTrace(0.8, movingMidday, 3, { ...settings, traceMode: 'average' });
    expect(spread(averaged.values)).toBeLessThan(spread(plain.values) / 2);
  });
});
