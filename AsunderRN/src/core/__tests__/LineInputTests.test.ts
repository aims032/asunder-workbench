import {
  AnalyzerTuning,
  createAnalyzerTrace,
  lineAdvance,
  lineHzAt,
  lineLoopSeconds,
  lineMeasure,
  LineTuning,
  STAND_IN_TRANSMISSION,
  standInSyllable,
  standInVoiceDb,
} from '../index';
import type { StandInVoice } from '../index';

// The analyzer's LINE input (LineInput.ts). New tests; no Swift version.

const t = STAND_IN_TRANSMISSION;
const low: StandInVoice = t.voices[0].standIn;
const high: StandInVoice = t.voices[1].standIn;

/** A moment when this voice is at the top of a syllable (so it's clearly speaking). */
function loudMoment(voice: StandInVoice): number {
  let best = 0;
  for (let s = 0; s < 4; s += 0.01) {
    if (standInSyllable(voice, s) > standInSyllable(voice, best)) {
      best = s;
    }
  }
  return best;
}

/** The loudest frequency of a voice between two frequencies, searched 1 Hz at a time. */
function peakHz(voice: StandInVoice, fromHz: number, toHz: number, at: number): number {
  let best = fromHz;
  for (let hz = fromHz; hz <= toHz; hz += 1) {
    if (standInVoiceDb(voice, hz, at) > standInVoiceDb(voice, best, at)) {
      best = hz;
    }
  }
  return best;
}

describe('LineInputTests', () => {
  test('the screen runs from lowHz to highHz, evenly by ratio', () => {
    expect(lineHzAt(0)).toBeCloseTo(LineTuning.lowHz, 6);
    expect(lineHzAt(1)).toBeCloseTo(LineTuning.highHz, 6);
    expect(lineHzAt(0.5)).toBeCloseTo(Math.sqrt(LineTuning.lowHz * LineTuning.highHz), 6);
    expect(lineHzAt(-1)).toBeCloseTo(LineTuning.lowHz, 6);
    expect(lineHzAt(2)).toBeCloseTo(LineTuning.highHz, 6);
  });

  test('a voice is a comb: strong on its harmonics, weak between them', () => {
    const at = loudMoment(low);
    const first = peakHz(low, 60, 400, at);
    const onHarmonic = standInVoiceDb(low, first * 5, at);
    const between = standInVoiceDb(low, first * 5.5, at);
    expect(onHarmonic - between).toBeGreaterThan(6);
  });

  test('the two stand-in voices look different: their combs are spaced differently', () => {
    const lowPitch = peakHz(low, 60, 400, loudMoment(low));
    const highPitch = peakHz(high, 60, 400, loudMoment(high));
    // Each lowest spike sits near that voice's own pitch (it wanders a little).
    expect(Math.abs(lowPitch - low.pitchHz)).toBeLessThan(low.pitchHz * LineTuning.pitchWander);
    expect(Math.abs(highPitch - high.pitchHz)).toBeLessThan(high.pitchHz * LineTuning.pitchWander);
    expect(highPitch).toBeGreaterThan(lowPitch * 1.4);
  });

  test('a voice is silent between syllables', () => {
    // Syllable edges fall on whole multiples of 1 / syllablesPerSecond.
    expect(standInVoiceDb(low, 300, 0)).toBe(-200);
  });

  test('a line with someone speaking stands above an empty line', () => {
    // Find a moment and frequency where voice-1 is speaking on line-1.
    const entry = t.script[0];
    let most = -Infinity;
    for (let s = entry.atSeconds; s < entry.endSeconds; s += 0.05) {
      for (let hz = 80; hz < 1500; hz += 5) {
        const gap = lineMeasure(t, entry.line, hz, s) - lineMeasure(t, 'line-6', hz, s);
        most = Math.max(most, gap);
      }
    }
    expect(most).toBeGreaterThan(20);
  });

  test('with nothing patched in, the screen is quieter than an empty line', () => {
    const empty = lineMeasure(t, 'line-6', 500, 1);
    const unpatched = lineMeasure(t, null, 500, 1);
    expect(empty - unpatched).toBeCloseTo(LineTuning.unpatchedDropDb, 6);
  });

  test('the same moment always measures the same (every phone agrees)', () => {
    expect(lineMeasure(t, 'line-1', 440, 2.345)).toBe(lineMeasure(t, 'line-1', 440, 2.345));
  });

  test('a looping transmission wraps round its own length', () => {
    expect(lineLoopSeconds(t, t.durationSeconds * 3 + 2.5)).toBeCloseTo(2.5, 9);
    expect(lineLoopSeconds(t, 0)).toBe(0);
  });

  test('one sweep fills every point and starts a new spectrogram row', () => {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, AnalyzerTuning.spectrogramRows, 0.5, 1);
    const finished = lineAdvance(trace, LineTuning.sweepSeconds, 'clearWrite', 1000, t, 'line-1');
    expect(finished).toBe(1);
    expect(trace.counts.every((c) => c === 1)).toBe(true);
    expect(trace.values.every((v) => Number.isFinite(v))).toBe(true);
    expect(trace.newestRow).toBe(1);
  });

  test('a long pause never works out more than maxSweepsPerFrame sweeps', () => {
    const trace = createAnalyzerTrace(AnalyzerTuning.points, AnalyzerTuning.spectrogramRows, 0.5, 1);
    expect(lineAdvance(trace, 60, 'clearWrite', 1000, t, null)).toBeLessThanOrEqual(LineTuning.maxSweepsPerFrame);
    expect(lineAdvance(trace, 0, 'clearWrite', 1000, t, null)).toBe(0);
  });
});
