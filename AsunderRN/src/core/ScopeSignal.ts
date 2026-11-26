// THE SCOPE'S SIGNAL: the sound the oscilloscope draws.
//
// Evan, Nov 25: the scope is a real analog oscilloscope driven by SOUND. It
// shows the wave of the music or voice going to and from the Asunder. This
// file is the "signal in" half: it answers "what is the sound on the scope's
// input right now?" as a short run of numbers (samples). Drawing them is the
// screen's job (the next step), and this file knows nothing about drawing.
//
// A SAMPLE is how far the sound pushes the beam at one instant: 0 is the
// middle of the screen (silence), +1 and -1 are the loudest it gets. A WINDOW
// is a row of samples, one after another in time: the slice of sound that
// fits across the screen.
//
// Where the sound comes from: the phone line patched into the switchboard's
// SCOPE jack, at the tape's current moment (the same "now" the printer and
// the analyzer's LINE input use).
//
// FOR NOW THE VOICES ARE STAND-INS. Nothing has been recorded, so
// standInVoiceSample below works a voice-like wave out from a few numbers
// (Transmission.ts, StandInVoice), the same numbers the analyzer's LINE
// input draws its spectrum from. Every phone works out the same wave. When
// there are real recordings, only scopeLineSample has to change.
//
// RULE: a helper function (or constant) has to be written ABOVE the first
// place it is used (the DeclarationOrder test checks this).
'worklet';

import { analyzerHash } from './Analyzer';
import { standInSyllable } from './LineInput';
import { transmissionVoice, transmissionVoicesOn } from './Transmission';
import type { StandInVoice, Transmission } from './Transmission';
import { LineTuning, ScopeTuning } from './Tuning';

/** A number pulled into 0...1. */
function signalClamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** A number from -1 up to (not including) 1, fixed for a given pair of whole numbers. */
function signalNoise(a: number, b: number): number {
  return analyzerHash(a, b) / 2_147_483_648 - 1;
}

/**
 * One sample of a stand-in voice at this moment (seconds from the start of
 * the transmission), between -1 and 1.
 *
 * A voice is a buzz from the throat (the pitch and its multiples, called
 * harmonics) shaped by the mouth (formants: which harmonics come through
 * loud), plus some breath. Adding the harmonics up as sine waves gives the
 * spiky, repeating wave a real voice makes on a scope. It rises and falls in
 * syllables, in step with what the analyzer's LINE input shows.
 */
export function standInVoiceSample(voice: StandInVoice, atSeconds: number): number {
  const line = LineTuning;
  const loudness = standInSyllable(voice, atSeconds);
  if (!(loudness > 0.02)) {
    return 0; // between syllables: silence
  }
  // The pitch wanders a little from syllable to syllable (the same wander
  // the analyzer uses, so the two instruments agree).
  const slot = Math.floor(atSeconds * line.syllablesPerSecond);
  const wander = analyzerHash(slot, 7) / 4_294_967_296 - 0.5;
  const pitch = voice.pitchHz * (1 + wander * line.pitchWander);
  // Time since this syllable began, so each syllable's wave starts clean.
  const within = atSeconds - slot / line.syllablesPerSecond;

  let sum = 0;
  let total = 0;
  for (let k = 1; k <= ScopeTuning.signalHarmonics; k += 1) {
    const hz = k * pitch;
    if (hz > line.highHz) {
      break;
    }
    // How much the mouth lets through at this harmonic (0 to 1).
    let formant = 0;
    for (const center of voice.formantsHz) {
      const d = (hz - center) / (center * line.formantWidth);
      formant = Math.max(formant, Math.exp(-0.5 * d * d));
    }
    // Higher harmonics are naturally weaker. (dB to height: 20 dB = 10 times.)
    const tiltDb = -line.tiltDbPerOctave * Math.log2(k);
    const height = Math.pow(10, tiltDb / 20) * Math.sqrt(0.03 + 0.97 * formant);
    sum += height * Math.sin(2 * Math.PI * hz * within);
    total += height;
  }
  const buzz = total > 0 ? sum / total : 0;
  // Breath: a fine hiss, new every signalGrainHz-th of a second.
  const grain = Math.floor(atSeconds * ScopeTuning.signalGrainHz);
  const breath = signalNoise(grain, Math.round(voice.pitchHz));
  return loudness * (buzz * (1 - voice.breath) + breath * voice.breath * 0.5);
}

/**
 * One sample of the sound on a phone line at this moment (seconds from the
 * start of the transmission): every voice speaking on that line, added up.
 * Silence (0) when nobody is speaking on it, or when no line is given.
 *
 * THIS is the function that changes when real recordings exist: it will read
 * the voices' audio files instead of the stand-ins.
 */
export function scopeLineSample(transmission: Transmission, line: string | null, atSeconds: number): number {
  if (line === null) {
    return 0;
  }
  let sample = 0;
  for (const id of transmissionVoicesOn(transmission, line, atSeconds)) {
    const voice = transmissionVoice(transmission, id);
    if (voice !== null) {
      sample += standInVoiceSample(voice.standIn, atSeconds);
    }
  }
  return sample;
}

// THE IDLE RULE (Evan, Nov 25): with nothing on its input, the scope shows
// one flat horizontal line across the middle.
//
// "Nothing on its input" means either no line is patched into the SCOPE
// jack, or the tape isn't running (nothing is playing on the lines at all).
// A patched line with the tape running is NOT idle, even in a pause between
// voices: then the scope shows whatever the dial is letting through.

/** Is the scope's input idle? `line` is the patched line (null = none), `playing` is whether the tape is running. */
export function scopeInputIsIdle(line: string | null, playing: boolean): boolean {
  return line === null || !playing;
}

/** What an idle scope draws. */
export type ScopeIdleShape = 'flatLine' | 'dot';

/**
 * What the idle scope draws in each mode. A real scope with no input shows a
 * flat line in Waveform mode and a single dot in XY mode. Evan asked for the
 * flat line in both; ScopeTuning.idleFlatLineInXY = false tries the dot.
 */
export function scopeIdleShape(xyMode: boolean): ScopeIdleShape {
  return xyMode && !ScopeTuning.idleFlatLineInXY ? 'dot' : 'flatLine';
}

/**
 * How much of the real signal gets through at this clarity (0 to 1). Uses
 * the same threshold as the TV picture (ScopeTuning.pictureFrom), so the
 * wave and the picture come in together as you tune.
 */
export function scopeSignalAmount(clarity: number): number {
  const from = ScopeTuning.pictureFrom;
  return signalClamp01((clarity - from) / (1 - from));
}

/**
 * Fills `out` with the window of samples the scope should draw, and gives
 * back true if the input is idle (so the screen can draw the idle shape).
 *
 *  - `line`: the phone line patched into the SCOPE jack, or null.
 *  - `playing`: whether the tape is running.
 *  - `startSeconds`: the tape's moment at the window's first sample.
 *  - `secondsPerSample`: the time between one sample and the next. (The
 *    Time/div knob will set this: more time per sample = more wave squeezed
 *    onto the screen.)
 *  - `clarity`: how well the dial is tuned, 0 to 1 (scopeClarity in Scope.ts).
 *
 * Idle: every sample is 0, a flat line.
 * Off the signal: fuzz, a jumping noisy trace.
 * Tuning in: the fuzz dies away and the voice's wave comes through.
 */
export function scopeSignalWindow(
  out: number[] | Float32Array,
  transmission: Transmission,
  line: string | null,
  playing: boolean,
  startSeconds: number,
  secondsPerSample: number,
  clarity: number,
): boolean {
  const n = out.length;
  if (scopeInputIsIdle(line, playing)) {
    for (let i = 0; i < n; i += 1) {
      out[i] = 0;
    }
    return true;
  }
  const amount = scopeSignalAmount(clarity);
  const fuzz = (1 - amount) * ScopeTuning.signalFuzz;
  const duration = transmission.durationSeconds;
  for (let i = 0; i < n; i += 1) {
    // The stand-in loops, so a window that runs off the end carries on from the start.
    let at = startSeconds + i * secondsPerSample;
    at -= Math.floor(at / duration) * duration;
    const signal = amount > 0 ? scopeLineSample(transmission, line, at) : 0;
    const grain = Math.floor(at * ScopeTuning.signalGrainHz);
    out[i] = signal * amount + (fuzz > 0 ? signalNoise(grain, 11) * fuzz : 0);
  }
  return false;
}
