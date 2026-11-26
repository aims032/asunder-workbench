import {
  scopeBeamBrightness,
  scopeBeamLevel,
  scopeStereoLeft,
  scopeStereoRight,
  scopeStereoWindow,
  ScopeTuning,
  scopeXYAcross,
} from '../index';

// XY mode's numbers (ScopeXY.ts): the stereo stand-in, where the beam lands
// and how bright it is. New, no Swift version.

const STEP = 1 / 16000;

function peak(samples: number[]): number {
  return samples.reduce((most, s) => Math.max(most, Math.abs(s)), 0);
}

function windows(n: number): [number[], number[]] {
  return [new Array<number>(n).fill(99), new Array<number>(n).fill(99)];
}

describe('the stereo window', () => {
  test('idle (nothing patched, or the tape stopped): the beam rests in the middle', () => {
    for (const [line, playing] of [
      [null, true],
      ['line-1', false],
    ] as const) {
      const [left, right] = windows(64);
      expect(scopeStereoWindow(left, right, line, playing, 1, STEP, 1)).toBe(true);
      expect(peak(left)).toBe(0);
      expect(peak(right)).toBe(0);
    }
  });

  test('tuned dead on: exactly the placeholder figure, no fuzz', () => {
    const [left, right] = windows(128);
    expect(scopeStereoWindow(left, right, 'line-1', true, 2, STEP, 1)).toBe(false);
    for (let i = 0; i < left.length; i += 1) {
      expect(left[i]).toBeCloseTo(scopeStereoLeft(2 + i * STEP), 12);
      expect(right[i]).toBeCloseTo(scopeStereoRight(2 + i * STEP), 12);
    }
  });

  test('the figure stays inside its size', () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(Math.abs(scopeStereoLeft(i * STEP))).toBeLessThanOrEqual(ScopeTuning.xyFigureLevel);
      expect(Math.abs(scopeStereoRight(i * STEP))).toBeLessThanOrEqual(ScopeTuning.xyFigureLevel);
    }
  });

  test('off the signal: a cloud of fuzz, different on each channel', () => {
    const [left, right] = windows(256);
    scopeStereoWindow(left, right, 'line-1', true, 2, STEP, 0);
    expect(peak(left)).toBeGreaterThan(0);
    expect(peak(left)).toBeLessThanOrEqual(ScopeTuning.signalFuzz);
    expect(left).not.toEqual(right);
  });

  test('is the same every time it is asked (every phone draws the same figure)', () => {
    const [a, b] = windows(64);
    const [c, d] = windows(64);
    scopeStereoWindow(a, b, 'line-1', true, 3.3, STEP, 0.6);
    scopeStereoWindow(c, d, 'line-1', true, 3.3, STEP, 0.6);
    expect(a).toEqual(c);
    expect(b).toEqual(d);
  });
});

describe('where the beam lands', () => {
  test('silence is the middle of the screen', () => {
    expect(scopeXYAcross(0, 0.1, 0)).toBe(0.5);
  });

  test('one square of signal moves it one square to the right', () => {
    expect(scopeXYAcross(0.1, 0.1, 0)).toBeCloseTo(0.5 + 1 / ScopeTuning.gridAcross, 12);
    expect(scopeXYAcross(-0.1, 0.1, 0)).toBeCloseTo(0.5 - 1 / ScopeTuning.gridAcross, 12);
  });

  test('a smaller Volts/div on channel 1 stretches the figure wider', () => {
    const wide = Math.abs(scopeXYAcross(0.2, 0.05, 0) - 0.5);
    const narrow = Math.abs(scopeXYAcross(0.2, 0.5, 0) - 0.5);
    expect(wide).toBeGreaterThan(narrow);
  });

  test('the horizontal position slides it sideways', () => {
    expect(scopeXYAcross(0, 0.1, 2)).toBeCloseTo(0.5 + 2 / ScopeTuning.gridAcross, 12);
  });
});

describe('how bright the beam is', () => {
  test('a still beam is at full brightness', () => {
    expect(scopeBeamBrightness(0)).toBe(1);
  });

  test('the faster it moves, the dimmer it is, down to a floor', () => {
    let last = 1;
    for (let d = 0; d <= 5; d += 0.05) {
      const b = scopeBeamBrightness(d);
      expect(b).toBeLessThanOrEqual(last);
      expect(b).toBeGreaterThanOrEqual(ScopeTuning.xyDimmest);
      last = b;
    }
    expect(scopeBeamBrightness(100)).toBe(ScopeTuning.xyDimmest);
  });

  test('moving backwards counts the same as forwards', () => {
    expect(scopeBeamBrightness(-0.3)).toBe(scopeBeamBrightness(0.3));
  });

  test('the brightness steps run from 0 (fast) to the top step (still)', () => {
    expect(scopeBeamLevel(0, 4)).toBe(3);
    expect(scopeBeamLevel(100, 4)).toBe(0);
    for (let d = 0; d <= 3; d += 0.01) {
      const level = scopeBeamLevel(d, 4);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(3);
    }
  });
});
