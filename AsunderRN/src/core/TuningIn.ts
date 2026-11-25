// TUNING IN A TRANSMISSION: the rules for finding one on the band.
//
// (Evan, Nov 25.) Each transmission sits at one fixed frequency, the same on
// every phone (TransmissionSchedule.ts). Off it, the band is ordinary static.
// What happens as you tune toward one, step by step:
//
//   1. ANYWHERE   The analyzer shows it as a faint, smooth bump just above the
//                 static floor (TuneInTuning.faintDb). You have to look for it.
//   2. CLOSE      A couple of notches off, the bump grows and starts to show
//                 the speaker's VOICEPRINT: the comb of harmonics and the
//                 formant bumps you see on the LINE input, spread across the
//                 width of the signal. The static thins and the sound opens
//                 up, part way. (Zoom the SPAN all the way in to read it.)
//   3. LOCKED     Right on it (within Tuning.lockDistance, the same closeness
//                 as the Carrier's lock pulse), the voiceprint is sharp, the
//                 dial gives the lock pulse, and after TuneInTuning.lockHoldSeconds
//                 Bess prints the transmission (see src/tunein).
//
// One number, CLARITY (0 to 1), drives all of it: 1 dead on, falling away as
// a bell curve the further off you are (TuneInTuning.clarityWidthDetents).
//
// This file has no screen and no sound hardware in it. The analyzer
// (Analyzer.ts) adds signalBandPower to what it measures, the sound
// (src/audio) calls signalReception, and the watcher (src/tunein) uses the rest.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test). 'worklet' marks every function here as
// safe to run on the screen and audio threads.
'worklet';

import type { AsunderClock } from './AsunderClock';
import { clockDayIndex } from './AsunderClock';
import type { BandPosition } from './BandModel';
import { bandDistance, bandPosition, bellStrength } from './BandModel';
import { dbToPower } from './Levels';
import type { ReceiverTargets } from './Reception';
import { receptionBlendHz } from './Reception';
import { spectrumPositionOfHz, spectrumReadout } from './SpectrumDisplay';
import { transmissionVoice } from './Transmission';
import type { StandInVoice } from './Transmission';
import type { ScheduledTransmission } from './TransmissionSchedule';
import { TRANSMISSION_SCHEDULE } from './TransmissionSchedule';
import { LineTuning, TuneInTuning, Tuning } from './Tuning';
import { lineHzAt, standInSyllable } from './Voiceprint';

// MARK: Where they are and whether they're on

/** Where a transmission sits on the band (0 to 1). */
export function signalPosition(entry: ScheduledTransmission): BandPosition {
  return spectrumPositionOfHz(entry.frequencyHz);
}

/**
 * Is this transmission on the band at this moment? From its day onward it
 * stays (TuneInTuning.staysOnceOnTheBand, the built default). While building,
 * TuneInTuning.everythingOnTheBand puts them all on.
 */
export function signalIsOnBand(entry: ScheduledTransmission, nowSeconds: number, clock: AsunderClock): boolean {
  if (TuneInTuning.everythingOnTheBand) {
    return true;
  }
  return clockDayIndex(clock, nowSeconds) >= entry.onBandFromDay;
}

/**
 * How far the dial is from a transmission, in notches. Positive = the
 * transmission is above the dial. Takes the short way round the loop.
 */
export function signalDetentsAway(entry: ScheduledTransmission, dial: BandPosition): number {
  return bandDistance(bandPosition(dial), signalPosition(entry)) / Tuning.detentSpacing;
}

/** How clear a transmission is from `detentsAway` notches off: 1 dead on, toward 0 far away. */
export function signalClarity(detentsAway: number): number {
  return bellStrength(detentsAway, TuneInTuning.clarityWidthDetents);
}

/** The three steps of tuning in (see the top of this file). */
export type SignalStage = 'faint' | 'close' | 'locked';

/** Which step you're at, `detentsAway` notches off. */
export function signalStage(detentsAway: number): SignalStage {
  if (Math.abs(detentsAway) <= Tuning.lockDistance) {
    return 'locked';
  }
  return signalClarity(detentsAway) >= TuneInTuning.closeFromClarity ? 'close' : 'faint';
}

/**
 * Which transmission on the band is nearest the dial, as its place in the
 * schedule (TRANSMISSION_SCHEDULE[i]), or -1 if none is on the band.
 */
export function nearestSignal(
  dial: BandPosition,
  nowSeconds: number,
  clock: AsunderClock,
  schedule: ScheduledTransmission[] = TRANSMISSION_SCHEDULE,
): number {
  let best = -1;
  let bestAway = Infinity;
  for (let i = 0; i < schedule.length; i += 1) {
    if (signalIsOnBand(schedule[i], nowSeconds, clock)) {
      const away = Math.abs(signalDetentsAway(schedule[i], dial));
      if (away < bestAway) {
        best = i;
        bestAway = away;
      }
    }
  }
  return best;
}

// MARK: What the analyzer sees

/**
 * Where a transmission's recording is at a wall-clock moment, in seconds
 * from its start. On the band it loops, so there's always someone speaking
 * on it sooner or later. (The same sum as lineLoopSeconds in LineInput.ts,
 * written out here so this file doesn't need that one.)
 */
export function signalLoopSeconds(entry: ScheduledTransmission, nowSeconds: number): number {
  const d = entry.recording.durationSeconds;
  return nowSeconds - Math.floor(nowSeconds / d) * d;
}

/**
 * One voice's print at one voice frequency, as a share of its loudest
 * harmonic (0 to 1). The same recipe as the LINE input's stand-in voices
 * (Voiceprint.ts: harmonics, formants, breath, getting weaker going up), but
 * with fatter harmonics (TuneInTuning.bandHarmonicShare), because squeezed
 * into a few notches of band, LINE's hair-thin spikes would slip between the
 * points on screen.
 */
export function signalVoicePrint(voice: StandInVoice, hz: number, atSeconds: number): number {
  const loudness = standInSyllable(voice, atSeconds);
  if (!(loudness > 0.02)) {
    return 0; // between syllables
  }
  let formant = 0;
  for (let i = 0; i < voice.formantsHz.length; i += 1) {
    const center = voice.formantsHz[i];
    const d = (hz - center) / (center * LineTuning.formantWidth);
    formant = Math.max(formant, Math.exp(-0.5 * d * d));
  }
  const pitch = voice.pitchHz;
  const tilt = dbToPower(-LineTuning.tiltDbPerOctave * Math.log2(Math.max(hz, pitch) / pitch));
  const nearest = Math.max(1, Math.round(hz / pitch)) * pitch;
  const h = (hz - nearest) / (pitch * TuneInTuning.bandHarmonicShare);
  const harmonic = Math.exp(-0.5 * h * h);
  const shape = harmonic * (1 - voice.breath) + voice.breath * 0.25;
  return loudness * loudness * (0.1 + 0.9 * formant) * shape * tilt;
}

/**
 * The voiceprint's strength at one voice frequency (0 to about 1). Every
 * voice speaking at that moment, on any line, adds in.
 */
export function signalVoiceShare(entry: ScheduledTransmission, hz: number, atSeconds: number): number {
  const recording = entry.recording;
  let share = 0;
  for (let i = 0; i < recording.script.length; i += 1) {
    const line = recording.script[i];
    if (atSeconds >= line.atSeconds && atSeconds < line.endSeconds) {
      const voice = transmissionVoice(recording, line.voice);
      if (voice !== null) {
        share += signalVoicePrint(voice.standIn, hz, atSeconds);
      }
    }
  }
  return share;
}

/**
 * How much power one transmission adds at a band position, for a dial at
 * `dial` (plain power, not dB: the analyzer adds it to the static).
 * `bucket` is how much band one screen point stands for: a point reports the
 * strongest thing anywhere in its stretch, so a narrow bump can't fall
 * between two points at a wide span.
 */
export function signalPowerOf(
  entry: ScheduledTransmission,
  position: BandPosition,
  bucket: number,
  dial: BandPosition,
  nowSeconds: number,
): number {
  const width = TuneInTuning.signalHalfWidthDetents;
  // Where this point is across the signal, in notches from its center.
  const across = bandDistance(signalPosition(entry), position) / Tuning.detentSpacing;
  const halfBucket = bucket / Tuning.detentSpacing / 2;
  const outside = Math.max(0, Math.abs(across) - halfBucket);
  if (outside > width * 3) {
    return 0; // far from this transmission: it adds nothing here
  }
  const clarity = signalClarity(signalDetentsAway(entry, dial));
  // The smooth bump: what you see from far away.
  const smooth = bellStrength(outside, width * 0.6);
  // The voiceprint, spread across the signal's width: its low end on the
  // left, high end on the right, like the LINE screen squeezed into the bump.
  let voice = 0;
  if (clarity > 0.001 && Math.abs(across) < width) {
    const hz = lineHzAt((across / width + 1) / 2);
    voice = signalVoiceShare(entry, hz, signalLoopSeconds(entry, nowSeconds));
  }
  // The voiceprint's window: flat across the signal, rounding off at its
  // edges, nothing outside. So when you're locked on, the smooth hump is
  // gone and what's left is the print itself.
  const x = across / width;
  const edge = Math.abs(x) < 1 ? 1 - x * x * x * x : 0;
  const lift = dbToPower(TuneInTuning.voiceprintLiftDb);
  const shape = (1 - clarity) * smooth + clarity * (Math.min(1, voice * lift) + TuneInTuning.silentShare) * edge;
  const levelDb = TuneInTuning.faintDb + (TuneInTuning.lockedDb - TuneInTuning.faintDb) * clarity;
  return dbToPower(levelDb) * shape;
}

/** Every transmission on the band, added up, at one position (see signalPowerOf). */
export function signalBandPower(
  position: BandPosition,
  bucket: number,
  dial: BandPosition,
  nowSeconds: number,
  clock: AsunderClock,
): number {
  let power = 0;
  for (let i = 0; i < TRANSMISSION_SCHEDULE.length; i += 1) {
    const entry = TRANSMISSION_SCHEDULE[i];
    if (signalIsOnBand(entry, nowSeconds, clock)) {
      power += signalPowerOf(entry, position, bucket, dial, nowSeconds);
    }
  }
  return power;
}

// MARK: What you hear

/**
 * Adjusts the sound's targets for a nearby transmission: the static quiets
 * and the EQ path opens with clarity, the way it does at the Carrier.
 * Call it right after receptionTargets. Creates nothing, so the audio
 * thread can call it every buffer. There is no voice in the speaker yet:
 * when there's a real recording, its track fades in here with clarity too.
 */
export function signalReception(out: ReceiverTargets, dial: number, nowSeconds: number, clock: AsunderClock): void {
  let clarity = 0;
  for (let i = 0; i < TRANSMISSION_SCHEDULE.length; i += 1) {
    const entry = TRANSMISSION_SCHEDULE[i];
    if (signalIsOnBand(entry, nowSeconds, clock)) {
      clarity = Math.max(clarity, signalClarity(signalDetentsAway(entry, bandPosition(dial))));
    }
  }
  if (!(clarity > 0.001)) {
    return; // nowhere near one (also catches a NaN)
  }
  const keep = 1 - TuneInTuning.staticQuieting * clarity;
  out.white *= keep;
  out.pink *= keep;
  out.brown *= keep;
  out.highpassHz = receptionBlendHz(out.highpassHz, Tuning.openHighpassHz, clarity);
  out.lowpassHz = receptionBlendHz(out.lowpassHz, Tuning.openLowpassHz, clarity);
}

// MARK: The clues, as words

/** Where it lives, the way the dial's readout shows it: "14.23 MHz". */
export function signalDialLabel(entry: ScheduledTransmission): string {
  const r = spectrumReadout(entry.frequencyHz);
  return `${r.number} ${r.unit}`;
}

/** The header the Physicist writes on a field log entry: "14.23 MHz · 02:10". */
export function signalLogHeader(entry: ScheduledTransmission): string {
  return `${signalDialLabel(entry)} · ${entry.logTime}`;
}

/**
 * The rough range Bess prints on the bare slip: "14.2–14.3 MHz" at
 * TuneInTuning.noticeDigits = 3. Rounded down and up to that many digits,
 * so the real frequency is always somewhere inside it.
 */
export function signalNoticeRange(entry: ScheduledTransmission): string {
  const r = spectrumReadout(entry.frequencyHz);
  if (entry.noticeRange !== undefined) {
    return `${entry.noticeRange} ${r.unit}`;
  }
  const value = Number(r.number);
  const digits = Math.max(1, TuneInTuning.noticeDigits);
  const place = Math.floor(Math.log10(value)) - (digits - 1); // 14.23 at 3 digits: tenths (-1)
  const step = Math.pow(10, place);
  const decimals = Math.max(0, -place);
  const low = Math.floor(value / step + 1e-9) * step;
  return `${low.toFixed(decimals)}–${(low + step).toFixed(decimals)} ${r.unit}`;
}
