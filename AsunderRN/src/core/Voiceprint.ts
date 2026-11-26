// VOICEPRINTS: the shape a voice makes on the analyzer, worked out from a
// few numbers (a StandInVoice) until there are real recordings.
//
// Two screens draw it: the LINE input (LineInput.ts), and the BAND, where a
// transmission sharpens into its speaker's voiceprint as you tune in
// (TuningIn.ts). It lives in its own file so both can use it without the
// analyzer and the line input importing each other.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import { analyzerHash, dbToPower, powerToDb } from './Levels';
import type { StandInVoice } from './Transmission';
import { LineTuning } from './Tuning';

/** The frequency at a spot across the LINE screen: 0 = left edge, 1 = right edge. */
export function lineHzAt(fraction: number): number {
  const t = LineTuning;
  return t.lowHz * Math.pow(t.highHz / t.lowHz, Math.min(1, Math.max(0, fraction)));
}

/** A number from 0 up to (not including) 1, fixed for a given pair of whole numbers. */
export function lineUnit(a: number, b: number): number {
  return analyzerHash(a, b) / 4_294_967_296;
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

