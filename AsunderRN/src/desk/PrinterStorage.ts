// WHERE THE PRINTER'S LOG IS KEPT.
//
// Only in memory, on purpose (Evan, Nov 23): print-outs stay while the app is
// open, so you can scroll back and reread them, and they're gone when the app
// closes. That goes for phones and the web preview alike.
//
// If that ever changes, anything that saves only has to fill in these two
// functions (and the printer already reads its log back through them).

export interface PrinterStorage {
  /** The saved text, or null if nothing has been saved. */
  load(): string | null;
  save(text: string): void;
}

export function createPrinterStorage(): PrinterStorage {
  let kept: string | null = null;
  return {
    load: () => kept,
    save: (text) => {
      kept = text;
    },
  };
}
