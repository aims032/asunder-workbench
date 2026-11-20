import { createStateVariableFilter, filterProcess, filterSetCutoff } from '../Filters';

// Small measuring tools for the sound tests.
//
// (No 'worklet' line up top: tests never run on the audio thread.)
//
// Wherever the Swift helpers took a list of samples, these take
// `ArrayLike<number>`. That means "anything with a length and numbered slots",
// so a plain number[] and a Float32Array (what the receiver renders into) both
// fit, and a test never has to convert one into the other first.

export const testSampleRate = 48_000.0;

/// Root-mean-square level: the average loudness of a signal.
export function rms(samples: ArrayLike<number>): number {
  let sum = 0.0;
  const n = samples.length;
  for (let i = 0; i < n; i += 1) {
    sum += samples[i] * samples[i];
  }
  return n === 0 ? 0 : Math.sqrt(sum / n);
}

export function peak(samples: ArrayLike<number>): number {
  let most = 0;
  for (let i = 0; i < samples.length; i += 1) {
    most = Math.max(most, Math.abs(samples[i]));
  }
  return most;
}

export function decibels(ratio: number): number {
  return 20 * Math.log10(ratio);
}

/// How loud a signal is in a narrow band around `hz` (a resonant band-pass filter).
export function bandLevel(samples: ArrayLike<number>, hz: number, q: number = 1.4): number {
  const filter = createStateVariableFilter();
  filterSetCutoff(filter, hz, q, testSampleRate);
  // Skip the first 0.1 s while the filter settles.
  // (Every sample still goes through the filter; the early ones just aren't measured.)
  const skip = Math.trunc(testSampleRate / 10);
  let sum = 0.0;
  let n = 0;
  for (let i = 0; i < samples.length; i += 1) {
    filterProcess(filter, samples[i]);
    if (i >= skip) {
      sum += filter.band * filter.band;
      n += 1;
    }
  }
  return n === 0 ? 0 : Math.sqrt(sum / n);
}

/// A rough iPhone speaker: everything below ~250 Hz rolls off steeply
/// (two high-pass filters in a row, 24 dB per octave).
export function speaker(samples: ArrayLike<number>): number[] {
  const a = createStateVariableFilter();
  const b = createStateVariableFilter();
  filterSetCutoff(a, 250, 0.707, testSampleRate);
  filterSetCutoff(b, 250, 0.707, testSampleRate);
  const out = new Array<number>(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    filterProcess(a, samples[i]);
    filterProcess(b, a.high);
    out[i] = b.high;
  }
  return out;
}

/// A brightness measure: 0 for very dull sounds, ~1 for white noise.
/// (One minus how alike each sample is to the one before it.)
export function brightness(samples: ArrayLike<number>): number {
  let same = 0.0;
  let total = 0.0;
  for (let i = 1; i < samples.length; i += 1) {
    same += samples[i] * samples[i - 1];
    total += samples[i] * samples[i];
  }
  return 1 - same / total;
}

/// A UTC moment from a string like "2026-11-18 12:00:00".
/// The answer is in Unix seconds, which is how the core counts time.
/// (Swift crashed on a string it couldn't read; this throws an error instead,
/// which fails the test just the same.)
export function utc(s: string): number {
  const parts = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (parts === null) {
    throw new Error(`utc() expects "yyyy-MM-dd HH:mm:ss" and got "${s}"`);
  }
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // JavaScript quietly rolls an impossible date forward (Nov 31 becomes Dec 1).
  // Reading the date back catches that.
  const readBack =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
  if (!readBack) {
    throw new Error(`utc() got a date that doesn't exist: "${s}"`);
  }
  return date.getTime() / 1_000;
}

// Known days, counted from the placeholder epoch (Sunday 1 Nov 2026).
// Week 0 runs P = [W, L, S, R, W, S, L], so:
export const movingMidday = utc('2026-11-01 12:00:00'); // Sunday, W
export const stillMidday = utc('2026-11-03 12:00:00'); // Tuesday, S
export const movingToStillTurn = utc('2026-11-03 00:00:00'); // Monday (L) turns into Tuesday (S)
