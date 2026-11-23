// WHERE DOWNLOADED PACKS ARE KEPT ON THE DEVICE.
//
// Two versions, and the build picks the right one (same idea as the
// printer's storage):
//   PackStore.native.ts  phones: real files in the app's own folder, kept
//                        until the app is deleted
//   PackStore.web.ts     the browser preview: the browser's download cache
//
// Everything else (PackSync.ts) only talks to this shape, so it doesn't care
// which one it has.

import type { InstalledPacks } from '../core';

export interface PackStore {
  /** The record of which packs are fully on the device. */
  loadInstalled(): InstalledPacks;
  saveInstalled(installed: InstalledPacks): void;
  /**
   * Download one file of a pack from `url` and keep it. Resolves to how many
   * bytes were saved; rejects if the download failed.
   */
  download(url: string, packId: string, path: string): Promise<number>;
  /** An address a player can open for a kept file. */
  fileUrl(packId: string, path: string): Promise<string>;
  /** The text of a kept file (for transmission.json). */
  readText(packId: string, path: string): Promise<string>;
}
