import { parseInstalledPacks } from '../core';
import type { PackStore } from './PackStore.types';

// THE BROWSER PREVIEW: downloaded files go in the browser's Cache Storage (a
// place web pages can keep whole downloads), and the record of what's
// installed goes in localStorage, like the printer's roll.
//
// Warning (see the decision doc): Safari on iPhone may wipe all of this if
// the site isn't opened for 7 days, unless it was added to the home screen.
// Phones running the real app don't have that problem.

const CACHE = 'asunder-packs';
const RECORD_KEY = 'asunder.packs.installed';

/** The made-up address each file is filed under in the cache. */
function cacheKey(packId: string, path: string): string {
  return `/asunder-packs/${packId}/${path}`;
}

async function cachedFile(packId: string, path: string): Promise<Response> {
  const cache = await caches.open(CACHE);
  const found = await cache.match(cacheKey(packId, path));
  if (found === undefined) {
    throw new Error(`${packId}/${path} isn't downloaded`);
  }
  return found;
}

export function createPackStore(): PackStore {
  return {
    loadInstalled: () => {
      try {
        return parseInstalledPacks(localStorage.getItem(RECORD_KEY));
      } catch {
        return parseInstalledPacks(null);
      }
    },
    saveInstalled: (installed) => {
      localStorage.setItem(RECORD_KEY, JSON.stringify(installed));
    },
    download: async (url, packId, path) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`the server answered ${response.status}`);
      }
      const blob = await response.blob();
      const cache = await caches.open(CACHE);
      await cache.put(cacheKey(packId, path), new Response(blob, { headers: response.headers }));
      return blob.size;
    },
    fileUrl: async (packId, path) => URL.createObjectURL(await (await cachedFile(packId, path)).blob()),
    readText: async (packId, path) => (await cachedFile(packId, path)).text(),
  };
}
