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

import { analyzerStore } from './Analyzer';
import { dbToPower, powerToDb } from './Levels';
import type { AnalyzerTrace, TraceMode } from './Analyzer';
import { transmissionVoice, transmissionVoicesOn } from './Transmission';
import type { Transmission } from './Transmission';
import { lineHzAt, lineUnit, standInVoiceDb } from './Voiceprint';
import { LineTuning } from './Tuning';

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
