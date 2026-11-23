import { AppState } from 'react-native';

import { installedPackIds } from '../core';
import { createStore } from '../desk/Store';
import type { Store } from '../desk/Store';
import { CATALOG_TIMEOUT_MS, MEDIA_SERVER_URL } from './MediaConfig';
import { createPackStore } from './PackStore';
import type { PackStore } from './PackStore.types';
import { fetchJson, syncPacks } from './PackSync';
import type { SyncResult } from './PackSync';

// THE APP'S SHELF OF TRANSMISSIONS: made once with the bench.
//
// It checks the server when the app opens and each time the app comes back
// to the front, so a transmission that unlocked while the phone was in a
// pocket arrives the next time someone looks. Nothing on screen uses it yet:
// when a transmission starts, and how the listener finds it on the band, is
// still Evan's to decide. For now it just keeps the shelf stocked.

export interface MediaLibrary {
  /** The packs fully on this device, lowest number first. */
  installed: Store<string[]>;
  /** How the last check went, or null before the first one finishes. */
  lastSync: Store<SyncResult | null>;
  /** Check the server now. Does nothing if a check is already running. */
  sync(): Promise<void>;
  store: PackStore;
}

export function createMediaLibrary(serverUrl: string | null = MEDIA_SERVER_URL): MediaLibrary {
  const store = createPackStore();
  const installed = createStore<string[]>(installedPackIds(store.loadInstalled()));
  const lastSync = createStore<SyncResult | null>(null);
  let running: Promise<void> | null = null;

  const sync = (): Promise<void> => {
    if (serverUrl === null) {
      return Promise.resolve();
    }
    if (running === null) {
      running = syncPacks(serverUrl, store, fetchJson, CATALOG_TIMEOUT_MS)
        .then((result) => {
          lastSync.set(result);
          installed.set(installedPackIds(store.loadInstalled()));
        })
        .finally(() => {
          running = null;
        });
    }
    return running;
  };

  if (serverUrl !== null) {
    void sync();
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void sync();
      }
    });
  }

  return { installed, lastSync, sync, store };
}
