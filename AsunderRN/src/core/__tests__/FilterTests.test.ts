import {
  createNoiseRandom,
  createSmoothed,
  createStateVariableFilter,
  filterProcess,
  filterSetCutoff,
  randomNextSigned,
  smoothedStep,
} from '../index';
import type { StateVariableFilter } from '../index';
import { decibels, rms, testSampleRate } from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/FilterTests.swift.
// One test here per Swift test function, with the same name.

function sine(hz: number, seconds: number = 0.5): number[] {
  const count = Math.trunc(seconds * testSampleRate);
  const out = new Array<number>(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.sin((2 * Math.PI * hz * i) / testSampleRate);
  }
  return out;
}

/// Runs one sample through the filter and picks which output to listen to.
/// (In Swift this took a filter and handed back a changed copy of it. Here
/// the filter is changed in place, so only the picked sample comes back.)
type Pick = (filter: StateVariableFilter, x: number) => number;

/// Level after the filter relative to before, in dB, once it has settled.
function gain(hz: number, pick: Pick, cutoff: number): number {
  const filter = createStateVariableFilter();
  filterSetCutoff(filter, cutoff, 0.707, testSampleRate);
  const input = sine(hz);
  const output: number[] = [];
  for (const x of input) {
    output.push(pick(filter, x));
  }
  const skip = Math.trunc(input.length / 2);
  return decibels(rms(output.slice(skip)) / rms(input.slice(skip)));
}

function lowpass(f: StateVariableFilter, x: number): number {
  filterProcess(f, x);
  return f.low;
}

function highpass(f: StateVariableFilter, x: number): number {
  filterProcess(f, x);
  return f.high;
}

describe('FilterTests', () => {
  test('testLowpassKeepsLowsAndCutsHighs', () => {
    expect(Math.abs(gain(100, lowpass, 1_000) - 0)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(gain(1_000, lowpass, 1_000) - -3)).toBeLessThanOrEqual(0.5);
    expect(gain(10_000, lowpass, 1_000)).toBeLessThan(-35);
  });

  test('testHighpassKeepsHighsAndCutsLows', () => {
    expect(Math.abs(gain(10_000, highpass, 1_000) - 0)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(gain(1_000, highpass, 1_000) - -3)).toBeLessThanOrEqual(0.5);
    expect(gain(100, highpass, 1_000)).toBeLessThan(-35);
  });

  /// The receiver sweeps its filters whenever you tune. Slamming the cutoff
  /// around while noise runs through must never blow up.
  test('testSweepingTheCutoffNeverBlowsUp', () => {
    const filter = createStateVariableFilter();
    const random = createNoiseRandom(3);
    let worst = 0.0;
    for (let i = 0; i < 200_000; i += 1) {
      if (i % 16 === 0) {
        const hz = i % 32 === 0 ? 30.0 : 20_000.0;
        filterSetCutoff(filter, hz, 0.8, testSampleRate);
      }
      filterProcess(filter, randomNextSigned(random));
      expect(Number.isFinite(filter.low) && Number.isFinite(filter.high)).toBe(true);
      worst = Math.max(worst, Math.abs(filter.low), Math.abs(filter.high));
    }
    expect(worst).toBeLessThan(10);
  });

  test('testCutoffAboveTheLimitIsClampedNotBroken', () => {
    const filter = createStateVariableFilter();
    filterSetCutoff(filter, 1_000_000, 0.707, testSampleRate);
    filterProcess(filter, 1);
    expect(Number.isFinite(filter.low)).toBe(true);
  });

  // MARK: Smoothed

  test('testSmoothedCoversAboutTwoThirdsInItsTime', () => {
    const s = createSmoothed(0, 0.01, testSampleRate);
    for (let i = 0; i < 480; i += 1) {
      smoothedStep(s, 1); // 0.01 s
    }
    expect(Math.abs(s.value - (1 - Math.exp(-1)))).toBeLessThanOrEqual(0.01);
  });

  test('testSmoothedWithZeroTimeJumpsStraightThere', () => {
    const s = createSmoothed(0, 0, testSampleRate);
    expect(smoothedStep(s, 5)).toBe(5);
  });
});
