// WHERE THE PRINTER'S LOG IS SAVED.
//
// In a web browser it's saved in the browser (localStorage), so a reload
// keeps your print-outs. On a phone it's only kept in memory for now, so
// closing the app clears it. A real phone save needs a small library (for
// example expo-file-system or AsyncStorage); none is installed yet, so that's
// a question for Evan before it's added. Anything that saves only has to fill
// in these two functions.

export interface PrinterStorage {
  /** The saved text, or null if nothing has been saved. */
  load(): string | null;
  save(text: string): void;
}

const KEY = 'asunder.printer.log';

/** The browser's storage if there is one, otherwise null. */
function browserStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null {
  const maybe = (globalThis as { localStorage?: unknown }).localStorage;
  return maybe ? (maybe as { getItem(k: string): string | null; setItem(k: string, v: string): void }) : null;
}

export function createPrinterStorage(): PrinterStorage {
  const browser = browserStorage();
  if (browser) {
    return {
      load: () => browser.getItem(KEY),
      save: (text) => browser.setItem(KEY, text),
    };
  }
  let kept: string | null = null;
  return {
    load: () => kept,
    save: (text) => {
      kept = text;
    },
  };
}
