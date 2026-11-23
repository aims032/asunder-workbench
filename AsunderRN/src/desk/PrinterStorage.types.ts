// WHERE THE PRINTER'S ROLL IS SAVED BETWEEN APP CLOSES.
//
// The roll has to be saved, because the paper fades a little every time the
// app is closed (Evan, Nov 23), and the app can only count closes if it
// remembers the roll from last time.
//
// There are two versions of the saving code, and the build picks the right one:
//   PrinterStorage.native.ts  phones: a small file in the app's own folder
//   PrinterStorage.web.ts     the browser preview: the browser's storage

export interface PrinterStorage {
  /** The saved text, or null if nothing has been saved. */
  load(): string | null;
  save(text: string): void;
}
