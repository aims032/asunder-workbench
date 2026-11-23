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
// THE PAPER FADES (Evan, Nov 23). Every time the app is closed, every slip
// on the roll fades a little. After DeskTuning.fadeCloses closes (33) a slip
// has faded off the paper and is gone, unless Bess prints a fresh copy first
// (the listener finding that transmission on the band again), which starts
// it over at full ink.
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
  /**
   * How many times the app has been closed since each print-out was last
   * printed: id -> count. A slip that isn't listed hasn't faded at all.
   */
  closesById: Record<string, number>;
}

/** A printer that hasn't printed anything yet. */
export function emptyPrinterLog(): PrinterLog {
  return { printouts: [], readIds: [], closesById: {} };
}

/** Is a print-out with this id already in the log? */
export function printerLogHas(log: PrinterLog, id: string): boolean {
  return log.printouts.some((p) => p.id === id);
}

/** A copy of the fade counts with only the listed ids kept. */
function closesFor(closesById: Record<string, number>, keptIds: string[]): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const id of keptIds) {
    if (closesById[id] !== undefined) {
      kept[id] = closesById[id];
    }
  }
  return kept;
}

/**
 * Add a print-out that just arrived.
 *
 * If one with the same id is already on the roll, this is a REPRINT: the
 * slip goes back to full ink (its fade count is cleared) and `isNew` is false,
 * so a reprint doesn't play the cue again. It stays marked read if it was.
 *
 * The log stays in arrival order; if it grows past DeskTuning.printerKeeps,
 * the oldest slips fall off the end of the roll.
 */
export function printerLogAdd(log: PrinterLog, printout: Printout): { log: PrinterLog; isNew: boolean } {
  if (printerLogHas(log, printout.id)) {
    const closesById = { ...log.closesById };
    delete closesById[printout.id];
    return { log: { printouts: log.printouts, readIds: log.readIds, closesById: closesById }, isNew: false };
  }
  const all = [...log.printouts, printout].sort((a, b) => a.arrivedAtSeconds - b.arrivedAtSeconds);
  const kept = all.slice(Math.max(0, all.length - DeskTuning.printerKeeps));
  const keptIds = kept.map((p) => p.id);
  return {
    log: {
      printouts: kept,
      readIds: log.readIds.filter((id) => keptIds.includes(id)),
      closesById: closesFor(log.closesById, keptIds),
    },
    isNew: true,
  };
}

/** How many times the app has closed since this slip was last printed. */
export function printerLogCloses(log: PrinterLog, id: string): number {
  return log.closesById[id] ?? 0;
}

/**
 * The app was closed once: every slip fades one step, and any slip that has
 * now seen DeskTuning.fadeCloses closes is gone from the roll.
 */
export function printerLogAfterClose(log: PrinterLog): PrinterLog {
  const kept = log.printouts.filter((p) => printerLogCloses(log, p.id) + 1 < DeskTuning.fadeCloses);
  const keptIds = kept.map((p) => p.id);
  const closesById: Record<string, number> = {};
  for (const id of keptIds) {
    closesById[id] = printerLogCloses(log, id) + 1;
  }
  return { printouts: kept, readIds: log.readIds.filter((id) => keptIds.includes(id)), closesById: closesById };
}

/**
 * How dark a slip's ink is right now: 1 = freshly printed, sliding down
 * evenly with each close toward DeskTuning.fadeFloor on its last close before
 * it disappears. The floor is there so a faded slip can still be read.
 */
export function printerLogInk(log: PrinterLog, id: string): number {
  const lastStep = Math.max(1, DeskTuning.fadeCloses - 1);
  const faded = Math.min(1, printerLogCloses(log, id) / lastStep);
  return 1 - (1 - DeskTuning.fadeFloor) * faded;
}

/** Mark one print-out as read. */
export function printerLogMarkRead(log: PrinterLog, id: string): PrinterLog {
  if (!printerLogHas(log, id) || log.readIds.includes(id)) {
    return log;
  }
  return { printouts: log.printouts, readIds: [...log.readIds, id], closesById: log.closesById };
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
export const PRINTER_LOG_SAVE_VERSION = 2;

/** The log as text, ready to save on the phone. */
export function printerLogToText(log: PrinterLog): string {
  return JSON.stringify({
    version: PRINTER_LOG_SAVE_VERSION,
    printouts: log.printouts,
    readIds: log.readIds,
    closesById: log.closesById,
  });
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
    if (
      saved.version !== PRINTER_LOG_SAVE_VERSION ||
      !Array.isArray(saved.printouts) ||
      !Array.isArray(saved.readIds) ||
      typeof saved.closesById !== 'object' ||
      saved.closesById === null
    ) {
      return emptyPrinterLog();
    }
    return { printouts: saved.printouts, readIds: saved.readIds, closesById: saved.closesById };
  } catch {
    return emptyPrinterLog();
  }
}
