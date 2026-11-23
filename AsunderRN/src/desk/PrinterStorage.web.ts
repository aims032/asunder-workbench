import type { PrinterStorage } from './PrinterStorage.types';

// THE BROWSER PREVIEW: the roll is kept in the browser's own storage
// (localStorage), so reloading the page counts as closing the app.

const KEY = 'asunder.printer.roll';

export function createPrinterStorage(): PrinterStorage {
  return {
    load: () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    save: (text) => {
      try {
        localStorage.setItem(KEY, text);
      } catch {
        // Private windows can refuse; the roll just isn't saved.
      }
    },
  };
}
