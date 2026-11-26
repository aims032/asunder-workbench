import {
  scopeIdleShape,
  scopeInputIsIdle,
  scopeLineSample,
  scopeSignalAmount,
  scopeSignalWindow,
  ScopeTuning,
  STAND_IN_TRANSMISSION,
  standInVoiceSample,
} from '../index';

// The scope's signal (ScopeSignal.ts): the samples it draws, and the idle
// rule. There's no Swift version, so these are new.

const T = STAND_IN_TRANSMISSION;
// The stand-in's first script line: voice-1 on line-1 from 0.5 s to 4 s.
const SPEAKING_AT = 1.0;
/** One sample every 1/8000 of a second: fine enough to see a voice's wave. */
const STEP = 1 / 8000;

/** The biggest distance from the middle in a window. */
function peak(samples: number[]): number {
  return samples.reduce((most, s) => Math.max(most, Math.abs(s)), 0);
}

/** A fresh window of `n` samples. */
function windowOf(n: number): number[] {
  return new Array<number>(n).fill(99);
}

describe('the idle rule', () => {
  test('nothing patched in is idle; so is a patched line with the tape stopped', () => {
    expect(scopeInputIsIdle(null, true)).toBe(true);
    expect(scopeInputIsIdle('line-1', false)).toBe(true);
    expect(scopeInputIsIdle('line-1', true)).toBe(false);
  });

  test('idle: every sample is 0 (a flat line), whatever the tuning', () => {
    for (const clarity of [0, 0.5, 1]) {
      const out = windowOf(64);
      expect(scopeSignalWindow(out, T, null, true, SPEAKING_AT, STEP, clarity)).toBe(true);
      expect(peak(out)).toBe(0);
      const stopped = windowOf(64);
      expect(scopeSignalWindow(stopped, T, 'line-1', false, SPEAKING_AT, STEP, clarity)).toBe(true);
      expect(peak(stopped)).toBe(0);
    }
  });

  test('the idle shape is a flat line in both modes (Evan, Nov 25)', () => {
    expect(ScopeTuning.idleFlatLineInXY).toBe(true);
    expect(scopeIdleShape(false)).toBe('flatLine');
    expect(scopeIdleShape(true)).toBe('flatLine');
  });
});

describe('the stand-in voice as a wave', () => {
  const voice = T.voices[0].standIn;

  test('stays between -1 and 1 and is not silent mid-syllable', () => {
    let most = 0;
    for (let i = 0; i < 4000; i += 1) {
      const s = standInVoiceSample(voice, SPEAKING_AT + i * STEP);
      expect(Math.abs(s)).toBeLessThanOrEqual(1);
      most = Math.max(most, Math.abs(s));
    }
    expect(most).toBeGreaterThan(0.1);
  });

  test('is the same every time it is asked (every phone draws the same wave)', () => {
    expect(standInVoiceSample(voice, 1.2345)).toBe(standInVoiceSample(voice, 1.2345));
  });

  test('two voices make different waves', () => {
    const other = T.voices[1].standIn;
    let differs = false;
    for (let i = 0; i < 200 && !differs; i += 1) {
      const at = SPEAKING_AT + i * STEP;
      differs = Math.abs(standInVoiceSample(voice, at) - standInVoiceSample(other, at)) > 0.01;
    }
    expect(differs).toBe(true);
  });
});

describe('the sound on a line', () => {
  test('is silent when nobody is speaking on that line', () => {
    // 4.2 s is the gap between the first two script lines.
    expect(scopeLineSample(T, 'line-1', 4.2)).toBe(0);
    // At 1 s voice-1 is on line-1, so line-2 is quiet.
    expect(scopeLineSample(T, 'line-2', SPEAKING_AT)).toBe(0);
    expect(scopeLineSample(T, null, SPEAKING_AT)).toBe(0);
  });
});

describe('the window the scope draws', () => {
  test('tuned dead on: exactly the line\'s sound, no fuzz', () => {
    const out = windowOf(256);
    expect(scopeSignalWindow(out, T, 'line-1', true, SPEAKING_AT, STEP, 1)).toBe(false);
    for (let i = 0; i < out.length; i += 1) {
      expect(out[i]).toBeCloseTo(scopeLineSample(T, 'line-1', SPEAKING_AT + i * STEP), 12);
    }
    expect(peak(out)).toBeGreaterThan(0.1);
  });

  test('tuned dead on, in a pause between voices: flat', () => {
    const out = windowOf(64);
    scopeSignalWindow(out, T, 'line-1', true, 4.2, STEP, 1);
    expect(peak(out)).toBe(0);
  });

  test('off the signal: fuzz, no taller than signalFuzz, and it keeps changing', () => {
    const now = windowOf(256);
    const later = windowOf(256);
    scopeSignalWindow(now, T, 'line-1', true, 4.2, STEP, 0);
    scopeSignalWindow(later, T, 'line-1', true, 4.3, STEP, 0);
    expect(peak(now)).toBeGreaterThan(ScopeTuning.signalFuzz * 0.5);
    expect(peak(now)).toBeLessThanOrEqual(ScopeTuning.signalFuzz);
    expect(now).not.toEqual(later);
  });

  test('tuning in never lets less of the signal through', () => {
    let last = 0;
    for (let c = 0; c <= 1.0001; c += 0.05) {
      const amount = scopeSignalAmount(c);
      expect(amount).toBeGreaterThanOrEqual(last);
      last = amount;
    }
    expect(scopeSignalAmount(ScopeTuning.pictureFrom * 0.5)).toBe(0);
    expect(scopeSignalAmount(1)).toBe(1);
  });

  test('a window that runs off the end of the loop carries on from the start', () => {
    const out = windowOf(4);
    const step = 0.5;
    scopeSignalWindow(out, T, 'line-1', true, T.durationSeconds - 0.5, step, 1);
    // The second sample lands on 0 s, the third on 0.5 s, the fourth on 1 s.
    expect(out[3]).toBeCloseTo(scopeLineSample(T, 'line-1', 1.0), 12);
  });

  test('works on a Float32Array too (what the screen thread will use)', () => {
    const out = new Float32Array(32);
    scopeSignalWindow(out, T, 'line-1', true, SPEAKING_AT, STEP, 1);
    expect(Math.abs(out[5] - scopeLineSample(T, 'line-1', SPEAKING_AT + 5 * STEP))).toBeLessThan(1e-6);
  });
});
