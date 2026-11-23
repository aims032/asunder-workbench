// A TRANSMISSION, AS A FILE: the one source every instrument reads from.
//
// A transmission is a recording with ONE AUDIO TRACK PER VOICE (never mixed
// together), plus a timed script: who speaks, when, and on which line of the
// mill's phone network. From that one description:
//   - the printer types the script in step with the audio,
//   - the analyzer's LINE input shows whoever is speaking on the patched line,
//   - (later) the scope draws their waveform, and lines bleed into each other.
//
// This file only describes the container. Evan writes every word that goes
// in it. The stand-in at the bottom carries marked placeholders and exists so
// the instruments can be built and tried before anything is recorded.
//
// Decided (Evan, Nov 23): the phones are a fixed network wired through the
// mill, so a LINE belongs to a place, and a voice can move from line to line.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import type { Printout, PrintoutLine } from './Printouts';

/**
 * A made-up voice for testing, described by the few numbers that make one
 * voice look different from another on an analyzer. Real recordings replace
 * it (see LineInput.ts).
 */
export interface StandInVoice {
  /** The pitch of the voice in Hz. Lower = a deeper voice, harmonics closer together. */
  pitchHz: number;
  /** Where the voice's resonances sit, in Hz: the bumps that make its vowel colour. */
  formantsHz: number[];
  /** How breathy it is, 0 to 1: more = more hiss between the harmonics. */
  breath: number;
}

/** One voice in a transmission. */
export interface TransmissionVoice {
  /** A plain id, like "voice-1". Who it belongs to is Evan's to say. */
  id: string;
  /** The voice's own audio file, or null while there's no recording yet. */
  audioFile: string | null;
  /** What to show while there's no recording. */
  standIn: StandInVoice;
}

/** One line of the script: one voice speaking on one phone line for a while. */
export interface ScriptLine {
  /** When it starts and ends, in seconds from the start of the transmission. */
  atSeconds: number;
  endSeconds: number;
  /** Which phone line it's heard on: one of the switchboard's line jacks. */
  line: string;
  /** Which voice (a TransmissionVoice id). */
  voice: string;
  /** The words. Evan's, or a marked placeholder. */
  text: string;
  /** A sound note for the print-out, like "click". Optional. */
  note?: string;
}

export interface Transmission {
  /** Unique and stable. */
  id: string;
  /** 1 = Transmission 001. */
  number: number;
  durationSeconds: number;
  voices: TransmissionVoice[];
  /** In order of atSeconds. */
  script: ScriptLine[];
}

/** The voice with this id, or null. */
export function transmissionVoice(transmission: Transmission, id: string): TransmissionVoice | null {
  for (const voice of transmission.voices) {
    if (voice.id === id) {
      return voice;
    }
  }
  return null;
}

/**
 * Everything wrong with a transmission file, as a list of plain sentences
 * (empty = it's fine). `lines` is the switchboard's list of phone lines.
 * Run this on a new transmission before it goes in the app.
 */
export function transmissionProblems(transmission: Transmission, lines: string[]): string[] {
  const problems: string[] = [];
  if (!(transmission.durationSeconds > 0)) {
    problems.push('the duration must be more than 0 seconds');
  }
  const seen: string[] = [];
  for (const voice of transmission.voices) {
    if (seen.includes(voice.id)) {
      problems.push(`two voices are both called ${voice.id}`);
    }
    seen.push(voice.id);
  }
  let before = -Infinity;
  for (let i = 0; i < transmission.script.length; i += 1) {
    const entry = transmission.script[i];
    const where = `script line ${i + 1}`;
    if (transmissionVoice(transmission, entry.voice) === null) {
      problems.push(`${where}: there is no voice called ${entry.voice}`);
    }
    if (!lines.includes(entry.line)) {
      problems.push(`${where}: there is no phone line called ${entry.line}`);
    }
    if (!(entry.endSeconds > entry.atSeconds)) {
      problems.push(`${where}: it must end after it starts`);
    }
    if (entry.atSeconds < 0 || entry.endSeconds > transmission.durationSeconds) {
      problems.push(`${where}: it runs outside the transmission`);
    }
    if (entry.atSeconds < before) {
      problems.push(`${where}: it starts before the line above it`);
    }
    before = entry.atSeconds;
  }
  return problems;
}

/**
 * Who is speaking on this phone line at this moment (seconds from the start)?
 * Gives back the voice ids, usually none or one; two if they talk over each
 * other on the same line.
 */
export function transmissionVoicesOn(transmission: Transmission, line: string, atSeconds: number): string[] {
  const speaking: string[] = [];
  for (const entry of transmission.script) {
    if (entry.line === line && atSeconds >= entry.atSeconds && atSeconds < entry.endSeconds) {
      if (!speaking.includes(entry.voice)) {
        speaking.push(entry.voice);
      }
    }
  }
  return speaking;
}

/**
 * The transmission as a print-out for the thermal printer: one printed line
 * per script line, each stamped with the moment it should print.
 */
export function transmissionToPrintout(transmission: Transmission, arrivedAtSeconds: number): Printout {
  const lines: PrintoutLine[] = [];
  for (const entry of transmission.script) {
    const note = entry.note ? ` [${entry.note}]` : '';
    lines.push({ text: `${entry.line} · ${entry.voice} · ${entry.text}${note}`, atSeconds: entry.atSeconds });
  }
  return { id: transmission.id, transmission: transmission.number, arrivedAtSeconds: arrivedAtSeconds, lines: lines };
}

/**
 * A STAND-IN, not a real transmission: two made-up voices taking turns on
 * two lines, with placeholder words. It loops so there's always something on
 * the lines to look at. Delete it once a real transmission exists.
 * (Number 0 so it can never be mistaken for Transmission 001.)
 */
export const STAND_IN_TRANSMISSION: Transmission = {
  id: 'stand-in',
  number: 0,
  durationSeconds: 16,
  voices: [
    { id: 'voice-1', audioFile: null, standIn: { pitchHz: 110, formantsHz: [600, 1050, 2400], breath: 0.15 } },
    { id: 'voice-2', audioFile: null, standIn: { pitchHz: 205, formantsHz: [800, 1700, 2900], breath: 0.35 } },
  ],
  script: [
    { atSeconds: 0.5, endSeconds: 4, line: 'line-1', voice: 'voice-1', text: '[TRANSMISSION TEXT: Evan]', note: 'click' },
    { atSeconds: 4.5, endSeconds: 8, line: 'line-2', voice: 'voice-2', text: '[TRANSMISSION TEXT: Evan]' },
    { atSeconds: 8.5, endSeconds: 11.5, line: 'line-1', voice: 'voice-1', text: '[TRANSMISSION TEXT: Evan]' },
    { atSeconds: 12, endSeconds: 15.5, line: 'line-2', voice: 'voice-2', text: '[TRANSMISSION TEXT: Evan]', note: 'click' },
  ],
};
