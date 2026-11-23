// THE ANALYZER'S LINE INPUT: what the analyzer shows when it's switched from
// BAND (the whole radio band, as before) to LINE (the sound on whichever
// phone line is patched into it on the switchboard).
//
// On LINE the screen runs from LineTuning.lowHz to LineTuning.highHz, the
// range a voice lives in, left to right, low to high. A voice shows up as a
// comb of evenly spaced spikes (its harmonics: the pitch and its multiples)
// under a few broad bumps (its formants: the resonances of the mouth and
// throat). Pitch and formants differ from person to person, which is why
// two voices look different here.
//
// FOR NOW THE VOICES ARE STAND-INS. Nothing has been recorded, so
// standInVoiceDb below works a voice-like spectrum out from a few numbers
// (Transmission.ts, StandInVoice). When there are real recordings, the level
// at each frequency comes from the actual audio instead, and only
// lineMeasure has to change.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import { analyzerHash, analyzerStore, dbToPower, powerToDb } from './Analyzer';
import type { AnalyzerTrace, TraceMode } from './Analyzer';
import { transmissionVoice, transmissionVoicesOn } from './Transmission';
import type { StandInVoice, Transmission } from './Transmission';
import { LineTuning } from './Tuning';

/** The frequency at a spot across the LINE screen: 0 = left edge, 1 = right edge. */
export function lineHzAt(fraction: number): number {
  const t = LineTuning;
  return t.lowHz * Math.pow(t.highHz / t.lowHz, Math.min(1, Math.max(0, fraction)));
}

/** A number from 0 up to (not including) 1, fixed for a given pair of whole numbers. */
function lineUnit(a: number, b: number): number {
  return analyzerHash(a, b) / 4_294_967_296;
}

/**
 * The quiet hiss of an empty line at this frequency and moment, in dB.
 * It flickers a little, like the grass on the band.
 */
export function lineFloorDb(hz: number, atSeconds: number): number {
  const t = LineTuning;
  const cell = Math.floor(hz / 4);
  const tick = Math.floor(atSeconds * t.grassRate);
  return t.floorDb + (lineUnit(cell, tick) - 0.5) * t.grassDb;
}

/**
 * How loud the stand-in voice is right now, 0 to 1. Speech comes in
 * syllables, so the level rises and falls a few times a second instead of
 * holding steady.
 */
export function standInSyllable(voice: StandInVoice, atSeconds: number): number {
  const t = LineTuning;
  const at = atSeconds * t.syllablesPerSecond;
  const slot = Math.floor(at);
  const within = at - slot;
  // Each syllable has its own strength; the pitch number keeps two voices
  // from pulsing in step with each other.
  const strength = 0.45 + 0.55 * lineUnit(slot, Math.round(voice.pitchHz));
  return strength * Math.sin(Math.PI * within);
}

/**
 * The stand-in voice's level at one frequency and moment, in dB.
 * Harmonics (spikes at the pitch and its multiples) shaped by formants
 * (broad bumps), plus breath noise in between.
 */
export function standInVoiceDb(voice: StandInVoice, hz: number, atSeconds: number): number {
  const t = LineTuning;
  const loudness = standInSyllable(voice, atSeconds);
  if (!(loudness > 0.02)) {
    return -200; // between syllables: nothing
  }
  // The pitch wanders a little from syllable to syllable, like speech does.
  const slot = Math.floor(atSeconds * t.syllablesPerSecond);
  const pitch = voice.pitchHz * (1 + (lineUnit(slot, 7) - 0.5) * t.pitchWander);

  // Formants: how much the mouth lets through at this frequency (0 to 1).
  let formant = 0;
  for (const center of voice.formantsHz) {
    const d = (hz - center) / (center * t.formantWidth);
    formant = Math.max(formant, Math.exp(-0.5 * d * d));
  }
  // Higher frequencies are naturally weaker in a voice.
  const tilt = -t.tiltDbPerOctave * Math.log2(Math.max(hz, pitch) / pitch);

  // Harmonics: how close this frequency is to a multiple of the pitch.
  const nearest = Math.max(1, Math.round(hz / pitch)) * pitch;
  const h = (hz - nearest) / t.harmonicWidthHz;
  const harmonic = Math.exp(-0.5 * h * h);

  const shape = harmonic * (1 - voice.breath) + voice.breath * 0.25;
  const power = dbToPower(t.voicePeakDb + tilt) * loudness * loudness * (0.03 + 0.97 * formant) * shape;
  return powerToDb(power);
}

/**
 * What the analyzer reads at one frequency on a phone line: the line's hiss,
 * plus every voice speaking on that line at that moment. With no line
 * patched in (`line` is null) it's only the analyzer's own faint hiss.
 * `atSeconds` is seconds from the start of the transmission.
 */
export function lineMeasure(transmission: Transmission, line: string | null, hz: number, atSeconds: number): number {
  let power = dbToPower(lineFloorDb(hz, atSeconds) - (line === null ? LineTuning.unpatchedDropDb : 0));
  if (line !== null) {
    for (const id of transmissionVoicesOn(transmission, line, atSeconds)) {
      const voice = transmissionVoice(transmission, id);
      if (voice !== null) {
        power += dbToPower(standInVoiceDb(voice.standIn, hz, atSeconds));
      }
    }
  }
  return powerToDb(power);
}

/** Where a looping transmission is at a wall-clock moment (Unix seconds). */
export function lineLoopSeconds(transmission: Transmission, nowSeconds: number): number {
  const d = transmission.durationSeconds;
  return nowSeconds - Math.floor(nowSeconds / d) * d;
}

/**
 * Moves the LINE sweep on by `dt` seconds, the same way analyzerAdvance moves
 * the BAND sweep: measures each point it passes and stores it, and starts a
 * new spectrogram row at the right edge. Gives back how many sweeps finished.
 */
export function lineAdvance(
  trace: AnalyzerTrace,
  dt: number,
  traceMode: TraceMode,
  nowSeconds: number,
  transmission: Transmission,
  line: string | null,
): number {
  const n = trace.points;
  const sweepSeconds = LineTuning.sweepSeconds;
  const pointsToGo = Math.min((Math.max(dt, 0) / sweepSeconds) * n, n * LineTuning.maxSweepsPerFrame);
  if (!(pointsToGo > 0)) {
    return 0;
  }
  let finished = 0;
  const end = trace.sweepAt + pointsToGo;
  let next = Math.ceil(trace.sweepAt);
  while (next < end) {
    const i = next % n;
    const when = nowSeconds - ((end - next) / n) * sweepSeconds;
    const db = lineMeasure(transmission, line, lineHzAt(i / (n - 1)), lineLoopSeconds(transmission, when));
    analyzerStore(trace, i, db, traceMode);
    trace.history[trace.newestRow * n + i] = db;
    if (i === n - 1) {
      finished += 1;
      trace.sweeps += 1;
      trace.newestRow = (trace.newestRow + 1) % trace.rows;
      for (let j = 0; j < n; j += 1) {
        trace.history[trace.newestRow * n + j] = NaN;
      }
    }
    next += 1;
  }
  trace.sweepAt = end - Math.floor(end / n) * n;
  return finished;
}
