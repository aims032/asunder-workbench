// THE LIVE PRINT-OUT: the printer typing a transmission's script in step
// with the sound, and the "tape" that says where in the transmission we are.
// Pure arithmetic, no screen: the printer panel (src/desk) draws it.
//
// The idea (Evan, Nov 23): as a transmission plays, the printer types each
// line at the moment it's spoken, stamped with the time and which phone it
// came over. Tap a printed line and the transmission jumps back to it.
//
// Two things are kept apart here:
//   WHERE THE TAPE IS      the moment being heard right now. It loops, and a
//                          tap can move it.
//   HOW FAR THE PAPER GOT  the furthest moment the tape has ever reached.
//                          Paper can't un-print, so this only goes up.
// So after jumping back, everything already printed stays on the paper and
// only the "now" mark moves.
//
// Nothing here knows any words. It only decides how MUCH of a line shows.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import type { Printout } from './Printouts';

/** Where a transmission is in its playing. */
export interface Tape {
  /** The clock time (Unix seconds) at which the tape was, or would have been, at 0. */
  startedAtSeconds: number;
  /** The furthest the tape has reached, in seconds from its start. */
  printedThroughSeconds: number;
  /** Where the tape was the last time anyone looked (used to notice it looping). */
  lastSeconds: number;
}

/** A tape starting from the beginning right now. */
export function tapeStart(nowSeconds: number): Tape {
  return { startedAtSeconds: nowSeconds, printedThroughSeconds: 0, lastSeconds: 0 };
}

/** Where the tape is right now, in seconds from its start. It loops at `durationSeconds`. */
export function tapeSeconds(tape: Tape, durationSeconds: number, nowSeconds: number): number {
  if (!(durationSeconds > 0)) {
    return 0;
  }
  const since = nowSeconds - tape.startedAtSeconds;
  return since - Math.floor(since / durationSeconds) * durationSeconds;
}

/**
 * Time has passed: note how far the paper has got. Call this often (the
 * printer panel does, several times a second). If the tape has looped back
 * to the start by itself, everything has been printed.
 */
export function tapeAdvance(tape: Tape, durationSeconds: number, nowSeconds: number): Tape {
  const at = tapeSeconds(tape, durationSeconds, nowSeconds);
  const looped = at < tape.lastSeconds;
  const through = looped ? durationSeconds : Math.max(tape.printedThroughSeconds, at);
  return { startedAtSeconds: tape.startedAtSeconds, printedThroughSeconds: through, lastSeconds: at };
}

/**
 * Move the tape so that right now it is at `toSeconds`. You can only jump to
 * something already printed, so a jump never lets the sound run ahead of the
 * paper: a target past the printed part is pulled back to it.
 */
export function tapeJump(tape: Tape, nowSeconds: number, toSeconds: number): Tape {
  const to = Math.max(0, Math.min(toSeconds, tape.printedThroughSeconds));
  return { startedAtSeconds: nowSeconds - to, printedThroughSeconds: tape.printedThroughSeconds, lastSeconds: to };
}

/**
 * How much of each line of a print-out is on the paper when the paper has
 * got as far as `throughSeconds`: one string per line, in order. A line that
 * hasn't started is '' and one being typed is cut short. The printer types
 * `charsPerSecond` characters a second from the moment a line starts.
 * A line with no time on it is there from the start.
 */
export function livePrintShown(printout: Printout, throughSeconds: number, charsPerSecond: number): string[] {
  const shown: string[] = [];
  for (const line of printout.lines) {
    if (line.atSeconds === undefined) {
      shown.push(line.text);
      continue;
    }
    const typing = throughSeconds - line.atSeconds;
    if (typing < 0) {
      shown.push('');
      continue;
    }
    shown.push(line.text.slice(0, Math.floor(typing * charsPerSecond)));
  }
  return shown;
}

/**
 * The line being heard at `atSeconds`: the last one that has started.
 * -1 before the first line (or if no line has a time on it).
 */
export function livePrintNowLine(printout: Printout, atSeconds: number): number {
  let now = -1;
  for (let i = 0; i < printout.lines.length; i += 1) {
    const at = printout.lines[i].atSeconds;
    if (at !== undefined && at <= atSeconds) {
      now = i;
    }
  }
  return now;
}

/** A moment as the printer stamps it: minutes and seconds, like 01:07. */
export function printStamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes < 10 ? '0' : ''}${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}
