import {
  printerLogAdd,
  printerLogAfterClose,
  printerLogFromText,
  printerLogMarkRead,
  printerLogToText,
  printoutShouldCue,
} from '../core';
import type { PrinterLog, Printout } from '../core';
import type { PrinterStorage } from './PrinterStorage.types';
import { createStore } from './Store';
import type { Store } from './Store';

// THE LIVE PRINTER: the log, saved as it changes, plus the cue hook.
//
// Print-outs come in through `receive`. Where they come FROM is not decided
// yet (with a transmission, unlocked by date, sent by a server later), so
// anything can call it: for now only the test buttons on the desk do.

/** Something that happens when a print-out arrives that deserves the cue. */
export type PrintoutCueListener = (printout: Printout) => void;

export interface PrinterModel {
  log: Store<PrinterLog>;
  /**
   * A print-out arrived. Adds it, saves, and fires the cue if it's due one.
   * Sending one that's already on the roll is a reprint: it goes back to full ink.
   */
  receive(printout: Printout): void;
  markRead(id: string): void;
  /**
   * The hook for the "new print-out" cue. The page switch listens here to
   * glow; a sound can listen here too once Evan picks one.
   * Returns a function that stops listening.
   */
  onCue(listener: PrintoutCueListener): () => void;
}

export function createPrinterModel(storage: PrinterStorage): PrinterModel {
  // An app can't reliably notice the moment it is closed, so the close is
  // counted on the way back in: if there's a saved roll, the app was closed
  // once since it was saved, and every slip fades one step (or is gone).
  const saved = storage.load();
  const startingLog = saved === null ? printerLogFromText(null) : printerLogAfterClose(printerLogFromText(saved));
  const log = createStore(startingLog);
  const cueListeners = new Set<PrintoutCueListener>();
  storage.save(printerLogToText(startingLog));

  // Every change to the log is saved straight away.
  log.subscribe(() => storage.save(printerLogToText(log.get())));

  return {
    log,
    receive(printout) {
      const result = printerLogAdd(log.get(), printout);
      log.set(result.log);
      if (result.isNew && printoutShouldCue(printout)) {
        cueListeners.forEach((listener) => listener(printout));
      }
    },
    markRead(id) {
      log.set(printerLogMarkRead(log.get(), id));
    },
    onCue(listener) {
      cueListeners.add(listener);
      return () => cueListeners.delete(listener);
    },
  };
}
