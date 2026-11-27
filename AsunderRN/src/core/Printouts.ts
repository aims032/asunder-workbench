// THE PRINTER'S LOG: every print-out that has arrived, and which ones the
// listener has looked at. Pure logic, no screen: the desk screen
// (src/desk) draws it, and the test file checks it.
//
// Nothing here decides what a print-out looks like or what it says. Evan
// writes every word; until then a print-out carries placeholder lines like
// "[TRANSMISSION TEXT: Evan]". What's still Open (memory bay, Nov 20):
// screen only or a real printer someday, whether it prints only during
// transmissions, what happens after printing, and what tapping a line does.
//
// Every function here returns a NEW log and leaves the old one alone
// ("immutable"). That makes it easy to save, compare and test.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import { DeskTuning } from './Tuning';

/** One line of a print-out. */
export interface PrintoutLine {
  /** The words. Evan's, or a marked placeholder. */
  text: string;
  /**
   * When the line prints, in seconds from the start of the transmission's
   * audio (Nov 15: the printer prints in sync with the audio). Leave it out
   * for a line that prints straight away.
   */
  atSeconds?: number;
}

/** One slip of thermal paper. */
export interface Printout {
  /** Unique and stable, so the same print-out never lands twice. */
  id: string;
  /** Which transmission it belongs to (1 = Transmission 001). */
  transmission: number;
  /** When it arrived, in Unix seconds (Date.now() / 1000). */
  arrivedAtSeconds: number;
  lines: PrintoutLine[];
}

/** Everything the printer has printed, oldest first, and what's been read. */
export interface PrinterLog {
  printouts: Printout[];
  /** Ids of the print-outs the listener has opened. */
  readIds: string[];
}

/** A printer that hasn't printed anything yet. */
export function emptyPrinterLog(): PrinterLog {
  return { printouts: [], readIds: [] };
}

/** Is a print-out with this id already in the log? */
export function printerLogHas(log: PrinterLog, id: string): boolean {
  return log.printouts.some((p) => p.id === id);
}

/**
 * Add a print-out that just arrived. If one with the same id is already
 * there, nothing changes and `isNew` is false (so a print-out delivered twice,
 * say after the app restarts, doesn't cue twice).
 * The log stays in arrival order; if it grows past DeskTuning.printerKeeps,
 * the oldest slips fall off the end of the roll.
 */
export function printerLogAdd(log: PrinterLog, printout: Printout): { log: PrinterLog; isNew: boolean } {
  if (printerLogHas(log, printout.id)) {
    return { log: log, isNew: false };
  }
  const all = [...log.printouts, printout].sort((a, b) => a.arrivedAtSeconds - b.arrivedAtSeconds);
  const kept = all.slice(Math.max(0, all.length - DeskTuning.printerKeeps));
  const keptIds = kept.map((p) => p.id);
  return {
    log: { printouts: kept, readIds: log.readIds.filter((id) => keptIds.includes(id)) },
    isNew: true,
  };
}

/** Mark one print-out as read. */
export function printerLogMarkRead(log: PrinterLog, id: string): PrinterLog {
  if (!printerLogHas(log, id) || log.readIds.includes(id)) {
    return log;
  }
  return { printouts: log.printouts, readIds: [...log.readIds, id] };
}

/** Has the listener opened this one? */
export function printerLogIsRead(log: PrinterLog, id: string): boolean {
  return log.readIds.includes(id);
}

/** How many print-outs haven't been opened yet. */
export function printerLogUnreadCount(log: PrinterLog): number {
  return log.printouts.filter((p) => !log.readIds.includes(p.id)).length;
}

/** Newest first, the way a roll of paper reads from the top. */
export function printerLogNewestFirst(log: PrinterLog): Printout[] {
  return [...log.printouts].reverse();
}

/**
 * Should the "new print-out" cue play for this one? Only from the
 * transmission set in DeskTuning.cueFromTransmission onward (Evan, Nov 23:
 * the cue only matters once Asunder is introduced, about 30 transmissions in),
 * and only if the cue is switched on at all.
 */
export function printoutShouldCue(printout: Printout): boolean {
  return DeskTuning.cueEnabled && printout.transmission >= DeskTuning.cueFromTransmission;
}

/** The version number written into saved logs, so old saves can be upgraded later. */
export const PRINTER_LOG_SAVE_VERSION = 1;

/** The log as text, ready to save on the phone. */
export function printerLogToText(log: PrinterLog): string {
  return JSON.stringify({ version: PRINTER_LOG_SAVE_VERSION, printouts: log.printouts, readIds: log.readIds });
}

/**
 * Read a saved log back. Anything broken or from an unknown version gives
 * an empty log rather than crashing the app.
 */
export function printerLogFromText(text: string | null): PrinterLog {
  if (text === null) {
    return emptyPrinterLog();
  }
  try {
    const saved = JSON.parse(text);
    if (saved.version !== PRINTER_LOG_SAVE_VERSION || !Array.isArray(saved.printouts) || !Array.isArray(saved.readIds)) {
      return emptyPrinterLog();
    }
    return { printouts: saved.printouts, readIds: saved.readIds };
  } catch {
    return emptyPrinterLog();
  }
}
