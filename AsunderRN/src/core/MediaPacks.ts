// TRANSMISSION PACKS: what the app keeps on the phone, and how it works out
// what to download next.
//
// Decided (Evan, Nov 23): the app stays small. Each transmission is a "pack"
// (its voice tracks, room tone, clips, photos and script) that the phone
// downloads from the media server once that transmission has unlocked, and
// then keeps, so it plays with no signal afterwards.
//
// The server decides what has unlocked (by its own clock, so changing the
// phone's clock doesn't help). It sends a catalog listing only unlocked
// packs. This file compares that list with what's already on the phone.
//
// The server's copy of these shapes is media/src/catalog.ts. If you change
// one, change the other.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

/** One file inside a pack, like "voice-1.m4a". */
export interface PackFile {
  path: string;
  /** Its size in bytes, to check a download finished properly. */
  bytes: number;
}

/** One transmission's pack, as the server lists it. */
export interface PackEntry {
  /** Stable id, also the pack's folder name, like "t001". */
  id: string;
  /** 1 = Transmission 001. */
  number: number;
  /** When it unlocked, real-world time, like "2027-05-25T11:45:00Z". */
  unlocksAt: string;
  files: PackFile[];
}

/** What the server sends: the packs that have unlocked, plus its clock. */
export interface PackCatalog {
  version: 1;
  serverTime: string;
  transmissions: PackEntry[];
}

/** One pack that is fully on the phone. */
export interface InstalledPack {
  number: number;
  /** Which version of the pack it is (see packSignature). */
  signature: string;
  /** Real-world time it finished downloading. */
  installedAt: string;
}

/** Everything on the phone, saved as one small file. */
export interface InstalledPacks {
  version: 1;
  packs: Record<string, InstalledPack>;
}

export const NO_PACKS: InstalledPacks = { version: 1, packs: {} };

/**
 * A short fingerprint of a pack's file list. If Evan re-makes a pack (say, a
 * better take of one voice), its files change size, the fingerprint changes,
 * and phones fetch it again.
 */
export function packSignature(entry: PackEntry): string {
  return entry.files
    .map((file) => `${file.path}:${file.bytes}`)
    .sort()
    .join('|');
}

/** The packs to download now, lowest number first. */
export function packsToFetch(catalog: PackCatalog, installed: InstalledPacks): PackEntry[] {
  const wanted: PackEntry[] = [];
  for (const entry of catalog.transmissions) {
    const have = installed.packs[entry.id];
    if (have === undefined || have.signature !== packSignature(entry)) {
      wanted.push(entry);
    }
  }
  return wanted.sort((a, b) => a.number - b.number);
}

/** The record after one more pack has finished downloading. */
export function withInstalledPack(installed: InstalledPacks, entry: PackEntry, nowIso: string): InstalledPacks {
  return {
    version: 1,
    packs: {
      ...installed.packs,
      [entry.id]: { number: entry.number, signature: packSignature(entry), installedAt: nowIso },
    },
  };
}

/** The ids of the packs on the phone, lowest number first. */
export function installedPackIds(installed: InstalledPacks): string[] {
  return Object.keys(installed.packs).sort((a, b) => installed.packs[a].number - installed.packs[b].number);
}

/** Reads the saved record. Anything missing or unreadable counts as "no packs yet". */
export function parseInstalledPacks(text: string | null): InstalledPacks {
  if (text === null) {
    return NO_PACKS;
  }
  try {
    const data = JSON.parse(text);
    if (data && data.version === 1 && typeof data.packs === 'object' && data.packs !== null) {
      return data as InstalledPacks;
    }
  } catch {
    // Fall through: start fresh rather than crash.
  }
  return NO_PACKS;
}

const SAFE_NAME = /^[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.]+)*$/;

/**
 * Is this really a catalog? Checked before trusting anything from the
 * network, so a broken answer (or a captive Wi-Fi login page) can't make the
 * app write files in odd places. Returns null when it's fine, otherwise what's
 * wrong, in a plain sentence.
 */
export function catalogProblem(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return 'it is not a catalog';
  }
  const catalog = data as Partial<PackCatalog>;
  if (catalog.version !== 1 || !Array.isArray(catalog.transmissions)) {
    return 'it is not a version 1 catalog';
  }
  for (const entry of catalog.transmissions) {
    if (typeof entry?.id !== 'string' || !SAFE_NAME.test(entry.id) || entry.id.includes('/')) {
      return 'a pack has a bad id';
    }
    if (typeof entry.number !== 'number' || !Array.isArray(entry.files) || entry.files.length === 0) {
      return `pack ${entry.id} is missing its number or files`;
    }
    for (const file of entry.files) {
      if (typeof file?.path !== 'string' || !SAFE_NAME.test(file.path) || file.path.split('/').includes('..')) {
        return `pack ${entry.id} has a bad file name`;
      }
      if (typeof file.bytes !== 'number' || !(file.bytes > 0)) {
        return `pack ${entry.id} has a file with no size`;
      }
    }
  }
  return null;
}
