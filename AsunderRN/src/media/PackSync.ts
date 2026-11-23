import { catalogProblem, packsToFetch, withInstalledPack } from '../core';
import type { PackCatalog, PackEntry, Transmission } from '../core';
import type { PackStore } from './PackStore.types';

// CATCHING UP WITH THE SERVER: one pass of "what's unlocked that I don't
// have yet? fetch it."
//
//   1. Ask the server for the catalog (only unlocked packs are on it).
//   2. Compare it with what's already on the phone.
//   3. Download each missing pack, file by file, lowest number first.
//   4. Only when EVERY file of a pack has arrived at the right size is the
//      pack marked as installed. A pack cut off halfway (signal dropped, app
//      closed) just gets fetched again next time.
//
// No signal is normal, not an error: the app carries on with what it has.
// Packs already on the phone are never deleted here, even if the server
// stops listing them.

export type SyncResult =
  /** Couldn't reach the server (or it answered nonsense). Nothing changed. */
  | { kind: 'offline'; reason: string }
  /** Talked to the server. `fetched` = packs that just arrived. */
  | { kind: 'done'; fetched: string[]; failed: string[] };

/** Fetch some JSON, giving up after `timeoutMs`. Passed in so tests can fake it. */
export type FetchJson = (url: string, timeoutMs: number) => Promise<unknown>;

export const fetchJson: FetchJson = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`the server answered ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

async function fetchPack(serverUrl: string, entry: PackEntry, store: PackStore): Promise<void> {
  for (const file of entry.files) {
    const url = `${serverUrl}/packs/${entry.id}/${file.path}`;
    const bytes = await store.download(url, entry.id, file.path);
    if (bytes !== file.bytes) {
      throw new Error(`${entry.id}/${file.path} arrived at ${bytes} bytes, expected ${file.bytes}`);
    }
  }
}

export async function syncPacks(
  serverUrl: string,
  store: PackStore,
  getJson: FetchJson,
  timeoutMs: number,
  now: () => Date = () => new Date(),
): Promise<SyncResult> {
  let data: unknown;
  try {
    data = await getJson(`${serverUrl}/catalog`, timeoutMs);
  } catch (error) {
    return { kind: 'offline', reason: error instanceof Error ? error.message : String(error) };
  }
  const problem = catalogProblem(data);
  if (problem !== null) {
    return { kind: 'offline', reason: `the server's answer was wrong: ${problem}` };
  }
  const catalog = data as PackCatalog;

  const fetched: string[] = [];
  const failed: string[] = [];
  for (const entry of packsToFetch(catalog, store.loadInstalled())) {
    try {
      await fetchPack(serverUrl, entry, store);
      // Read the record again right before saving, so two packs finishing
      // close together can't overwrite each other.
      store.saveInstalled(withInstalledPack(store.loadInstalled(), entry, now().toISOString()));
      fetched.push(entry.id);
    } catch {
      failed.push(entry.id);
    }
  }
  return { kind: 'done', fetched, failed };
}

/**
 * A downloaded pack's transmission, ready for the instruments: its script,
 * with each voice's audioFile changed to an address on this device.
 */
export async function loadPackTransmission(store: PackStore, packId: string): Promise<Transmission> {
  const transmission = JSON.parse(await store.readText(packId, 'transmission.json')) as Transmission;
  const voices = await Promise.all(
    transmission.voices.map(async (voice) => ({
      ...voice,
      audioFile: voice.audioFile === null ? null : await store.fileUrl(packId, voice.audioFile),
    })),
  );
  return { ...transmission, voices };
}
