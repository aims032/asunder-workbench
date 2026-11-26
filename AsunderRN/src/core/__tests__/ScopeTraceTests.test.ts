import {
  scopeSecondsPerSample,
  scopeSweepStart,
  scopeTraceDepth,
  scopeTriggerIndex,
  ScopeTuning,
} from '../index';

// The scope's trace arithmetic (ScopeTrace.ts): the trigger, the time base
// and where a sample lands on the screen. No Swift version, so these are new.

/** A steady tone: `cycles` whole cycles spread over every `perCycle` samples, starting at `phase` (0 to 1). */
function tone(length: number, perCycle: number, phase: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) {
    out.push(Math.sin(2 * Math.PI * (i / perCycle + phase)));
  }
  return out;
}

describe('the trigger', () => {
  test('finds the first place the wave climbs through the level', () => {
    expect(scopeTriggerIndex([0, 0.1, 0.3, 0.6, 0.2, 0.7], 0.5, 6)).toBe(3);
  });

  test('ignores the wave falling through the level', () => {
    expect(scopeTriggerIndex([0.9, 0.1, 0, -0.5], 0.5, 4)).toBe(-1);
  });

  test('a wave that never reaches the level gives no trigger', () => {
    expect(scopeTriggerIndex(tone(200, 40, 0), 1.5, 200)).toBe(-1);
    expect(scopeTriggerIndex(new Array<number>(200).fill(0), 0.2, 200)).toBe(-1);
  });

  test('only searches as far as it is told', () => {
    expect(scopeTriggerIndex([0, 0, 0, 0, 1], 0.5, 4)).toBe(-1);
    expect(scopeTriggerIndex([0, 0, 0, 0, 1], 0.5, 5)).toBe(4);
  });
});

describe('a sweep', () => {
  test('a steady tone holds still: whenever the window starts, the sweep looks the same', () => {
    const visible = 100;
    const shown: number[][] = [];
    for (const phase of [0, 0.13, 0.5, 0.77]) {
      const samples = tone(200, 40, phase);
      const start = scopeSweepStart(samples, 0.2, visible);
      shown.push(samples.slice(start, start + visible));
    }
    for (const sweep of shown) {
      expect(sweep.length).toBe(visible);
      for (let i = 0; i < visible; i += 1) {
        // Within one sample's worth of the first sweep.
        expect(Math.abs(sweep[i] - shown[0][i])).toBeLessThan(0.17);
      }
    }
  });

  test('with no trigger it free-runs from the start of the window (Auto)', () => {
    expect(scopeSweepStart(tone(200, 40, 0.3), 1.5, 100)).toBe(0);
    expect(scopeSweepStart(new Array<number>(200).fill(0), 0.2, 100)).toBe(0);
  });

  test('always leaves a full screen to draw', () => {
    // The only climb is too late to fit a screen after it, so it isn't used.
    const samples = new Array<number>(200).fill(0);
    samples[150] = 1;
    expect(scopeSweepStart(samples, 0.5, 100)).toBe(0);
    samples[100] = 1;
    expect(scopeSweepStart(samples, 0.5, 100)).toBe(100);
  });
});

describe('the grid', () => {
  test('the points across the screen span exactly ten squares of time', () => {
    const step = scopeSecondsPerSample(0.002, 301);
    expect(step * 300).toBeCloseTo(0.002 * ScopeTuning.gridAcross, 12);
  });

  test('silence sits on the middle line', () => {
    expect(scopeTraceDepth(0, 0.25, 0)).toBe(0.5);
  });

  test('one square of signal is one square of height, upward', () => {
    expect(scopeTraceDepth(0.25, 0.25, 0)).toBeCloseTo(0.5 - 1 / ScopeTuning.gridUp, 12);
    expect(scopeTraceDepth(-0.25, 0.25, 0)).toBeCloseTo(0.5 + 1 / ScopeTuning.gridUp, 12);
  });

  test('a smaller Volts/div draws a taller wave', () => {
    const tall = Math.abs(scopeTraceDepth(0.2, 0.1, 0) - 0.5);
    const short = Math.abs(scopeTraceDepth(0.2, 0.5, 0) - 0.5);
    expect(tall).toBeGreaterThan(short);
  });

  test('the position slides the whole trace up by that many squares', () => {
    expect(scopeTraceDepth(0, 0.25, 2)).toBeCloseTo(0.5 - 2 / ScopeTuning.gridUp, 12);
  });
});
