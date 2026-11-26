// WHAT BESS PRINTS WHEN YOU'RE TUNING IN: two kinds of slip.
//
//   - The NOTICE: when a new transmission comes onto the band, a bare slip
//     with the word SIGNAL (TuneInTuning.noticeWord), a rough range like
//     "14.2–14.3 MHz" and the time. No words from the transmission. It's a
//     clue: something's out there, roughly here.
//   - The TRANSMISSION itself: once you've locked on to it. Printing it again
//     (finding it again later) brings a faded slip back to full ink.
//
// Pure logic: the watcher in src/tunein decides when, this only says what.
// RULE: a helper function has to be written ABOVE the first place it is used.
'worklet';

import type { Printout } from './Printouts';
import type { ScheduledTransmission } from './TransmissionSchedule';
import { TuneInTuning } from './Tuning';
import { signalDialLabel, signalNoticeRange } from './TuningIn';

/** The id of a transmission's notice slip (its print-out uses the plain id). */
export function signalNoticeId(entry: ScheduledTransmission): string {
  return `${entry.id}-notice`;
}

/**
 * The bare notice slip. `timeText` is the time to print on it, already
 * written out (the caller knows the listener's clock).
 */
export function signalNoticePrintout(entry: ScheduledTransmission, nowSeconds: number, timeText: string): Printout {
  return {
    id: signalNoticeId(entry),
    transmission: entry.number,
    arrivedAtSeconds: nowSeconds,
    lines: [{ text: `${TuneInTuning.noticeWord} ${signalNoticeRange(entry)}` }, { text: timeText }],
  };
}

/**
 * The transmission's own slip, printed when you lock on: where it was found,
 * then its script (Evan's words, placeholders for now), all at once.
 * (Typing it out in step with the audio, like the desk's TEST PRINT (LIVE),
 * waits on the open question of when a transmission starts playing.)
 */
export function signalPrintout(entry: ScheduledTransmission, nowSeconds: number): Printout {
  const lines = [{ text: signalDialLabel(entry) }];
  for (const line of entry.recording.script) {
    const note = line.note ? ` [${line.note}]` : '';
    lines.push({ text: `${line.line} · ${line.voice} · ${line.text}${note}` });
  }
  return { id: entry.id, transmission: entry.number, arrivedAtSeconds: nowSeconds, lines: lines };
}
