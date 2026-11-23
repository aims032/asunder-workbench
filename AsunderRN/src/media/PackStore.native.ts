import { Directory, File, Paths } from 'expo-file-system';

import { parseInstalledPacks } from '../core';
import type { PackStore } from './PackStore.types';

// PHONES: each pack is a folder of ordinary files in the app's own documents
// folder, like  Documents/packs/t001/voice-1.m4a
// The phone keeps them until the app is deleted, so they play offline.
// (expo-file-system is the Expo library for reading and writing files.)

function packsFolder(): Directory {
  return new Directory(Paths.document, 'packs');
}

function packFile(packId: string, path: string): File {
  return new File(packsFolder(), packId, path);
}

export function createPackStore(): PackStore {
  const record = new File(Paths.document, 'packs-installed.json');
  return {
    loadInstalled: () => {
      try {
        return parseInstalledPacks(record.exists ? record.textSync() : null);
      } catch {
        return parseInstalledPacks(null);
      }
    },
    saveInstalled: (installed) => {
      if (!record.exists) {
        record.create();
      }
      record.writeSync(JSON.stringify(installed));
    },
    download: async (url, packId, path) => {
      const file = packFile(packId, path);
      // Make the folder (and any folders inside it the file name needs).
      file.parentDirectory.create({ intermediates: true, idempotent: true });
      // idempotent: replace a half-finished file from an earlier try.
      const saved = await File.downloadFileAsync(url, file, { idempotent: true });
      return saved.size;
    },
    fileUrl: async (packId, path) => packFile(packId, path).uri,
    readText: async (packId, path) => packFile(packId, path).text(),
  };
}
