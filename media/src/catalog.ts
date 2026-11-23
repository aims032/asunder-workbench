// THE CATALOG: the master list of every transmission pack, and the rule for
// which ones a listener is allowed to have yet.
//
// The full catalog (every pack, with its unlock time) lives privately in the
// R2 bucket as `catalog.json`. Phones never see it whole. They ask the server
// for the catalog, and the server cuts it down to the packs whose time has
// already come (see `unlockedCatalog`). So a pack that hasn't unlocked yet
// can't be found from a phone at all, even by someone who changes their
// phone's clock: the date that counts is the server's.
//
// The app has its own copy of these shapes in AsunderRN/src/core/MediaPacks.ts.
// If you change one, change the other.

/** One file inside a pack, like "voice-1.m4a". */
export interface PackFile {
  /** The file's name inside the pack. Letters, numbers, - _ . and / only. */
  path: string;
  /** Its size in bytes, so the phone can tell a download finished properly. */
  bytes: number;
}

/** One transmission's pack: everything the app needs to play it. */
export interface PackEntry {
  /** Stable id, also the pack's folder name, like "t001". */
  id: string;
  /** 1 = Transmission 001. */
  number: number;
  /**
   * When it unlocks, in REAL-WORLD time, written like "2027-05-25T11:45:00Z"
   * (the Z means UTC). This is not the in-story date: that's the app's
   * clock's job.
   */
  unlocksAt: string;
  files: PackFile[];
}

export interface Catalog {
  /** Bumped only if the shape of this file ever changes. */
  version: 1;
  transmissions: PackEntry[];
}

/** What a phone is sent: only what has unlocked, plus the server's time. */
export interface PublicCatalog extends Catalog {
  /** The server's clock when it answered, in the same format as unlocksAt. */
  serverTime: string;
}

/** True once a pack's unlock time has passed (by the clock you pass in). */
export function isUnlocked(entry: PackEntry, nowMs: number): boolean {
  const at = Date.parse(entry.unlocksAt);
  return Number.isFinite(at) && at <= nowMs;
}

/** The catalog a phone gets: unlocked packs only, in order. */
export function unlockedCatalog(catalog: Catalog, nowMs: number): PublicCatalog {
  return {
    version: 1,
    serverTime: new Date(nowMs).toISOString(),
    transmissions: catalog.transmissions
      .filter((entry) => isUnlocked(entry, nowMs))
      .sort((a, b) => a.number - b.number),
  };
}

/**
 * May a phone download this file right now? Only if its pack has unlocked
 * AND the file is listed in that pack (so nothing else in the bucket, like
 * catalog.json itself, can be fetched by guessing a name).
 */
export function fileAllowed(catalog: Catalog, packId: string, path: string, nowMs: number): boolean {
  for (const entry of catalog.transmissions) {
    if (entry.id === packId) {
      return isUnlocked(entry, nowMs) && entry.files.some((file) => file.path === path);
    }
  }
  return false;
}

const SAFE_NAME = /^[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.]+)*$/;

/** Everything wrong with a catalog, as plain sentences (empty = it's fine). */
export function catalogProblems(catalog: Catalog): string[] {
  const problems: string[] = [];
  if (catalog.version !== 1) {
    problems.push('version must be 1');
  }
  const ids = new Set<string>();
  for (const entry of catalog.transmissions) {
    const where = `pack ${entry.id}`;
    if (!SAFE_NAME.test(entry.id) || entry.id.includes('/')) {
      problems.push(`${where}: the id may only use letters, numbers, - _ and .`);
    }
    if (ids.has(entry.id)) {
      problems.push(`${where}: two packs have this id`);
    }
    ids.add(entry.id);
    if (!Number.isFinite(Date.parse(entry.unlocksAt))) {
      problems.push(`${where}: unlocksAt isn't a date like 2027-05-25T11:45:00Z`);
    }
    if (entry.files.length === 0) {
      problems.push(`${where}: it has no files`);
    }
    for (const file of entry.files) {
      if (!SAFE_NAME.test(file.path) || file.path.split('/').includes('..')) {
        problems.push(`${where}: the file name "${file.path}" has characters it shouldn't`);
      }
      if (!(file.bytes > 0)) {
        problems.push(`${where}: ${file.path} has no size`);
      }
    }
  }
  return problems;
}
