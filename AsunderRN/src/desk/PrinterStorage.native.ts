import { File, Paths } from 'expo-file-system';

import type { PrinterStorage } from './PrinterStorage.types';

// PHONES: the roll is one small text file in the app's own documents folder.
// (expo-file-system is the Expo library for reading and writing files.)
// If the file can't be read or written, the printer carries on without
// saving rather than crashing the app.

export function createPrinterStorage(): PrinterStorage {
  const file = new File(Paths.document, 'printer-roll.json');
  return {
    load: () => {
      try {
        return file.exists ? file.textSync() : null;
      } catch {
        return null;
      }
    },
    save: (text) => {
      try {
        if (!file.exists) {
          file.create();
        }
        file.writeSync(text);
      } catch {
        // Nothing to do: the roll just isn't saved this time.
      }
    },
  };
}
