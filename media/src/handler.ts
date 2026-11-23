// THE SERVER'S WHOLE JOB, in one function: answer a phone's request.
//
// It only knows two addresses:
//   GET /catalog                  the list of packs that have unlocked
//   GET /packs/<id>/<file name>   one file from an unlocked pack
// Anything else gets "not found".
//
// Where the files actually come from is passed in as `storage`, so the same
// code runs in two places:
//   src/worker.ts        on Cloudflare, reading from the R2 bucket
//   dev/serve-local.ts   on your Mac, reading from the media/packs folder
// That way, what you test at home is exactly what runs in the cloud.

import { catalogProblems, fileAllowed, unlockedCatalog } from './catalog.ts';
import type { Catalog } from './catalog.ts';

/** Somewhere files can be read from, by name ("key"). */
export interface Storage {
  /** The file's bytes as a stream, or null if there's no such file. */
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer | string; size: number } | null>;
}

/** The private master list, kept at the top of the bucket. */
export const CATALOG_KEY = 'catalog.json';

const PACK_ADDRESS = /^\/packs\/([A-Za-z0-9_\-.]+)\/(.+)$/;

// Phones and the browser preview may call this from any web page (the
// preview runs on a different address than the server).
const OPEN_TO_ALL = { 'access-control-allow-origin': '*' };

function plain(status: number, text: string): Response {
  return new Response(text, { status, headers: { 'content-type': 'text/plain', ...OPEN_TO_ALL } });
}

async function readCatalog(storage: Storage): Promise<Catalog | null> {
  const found = await storage.get(CATALOG_KEY);
  if (found === null) {
    return null;
  }
  const text = await new Response(found.body).text();
  const catalog = JSON.parse(text) as Catalog;
  return catalogProblems(catalog).length === 0 ? catalog : null;
}

export async function handleRequest(request: Request, storage: Storage, nowMs: number): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'only GET');
  }
  const url = new URL(request.url);

  let catalog: Catalog | null;
  try {
    catalog = await readCatalog(storage);
  } catch {
    catalog = null;
  }
  if (catalog === null) {
    // Missing or broken catalog: say so plainly rather than guess.
    return plain(503, 'the catalog is missing or broken');
  }

  if (url.pathname === '/catalog') {
    return new Response(JSON.stringify(unlockedCatalog(catalog, nowMs)), {
      headers: {
        'content-type': 'application/json',
        // Don't let anything in between keep an old list: a new pack must
        // show up the moment it unlocks.
        'cache-control': 'no-store',
        ...OPEN_TO_ALL,
      },
    });
  }

  const match = PACK_ADDRESS.exec(url.pathname);
  if (match !== null) {
    const [, packId, path] = match;
    // Locked, or not a file in that pack: answer exactly as if it didn't
    // exist, so nobody can learn what's coming by poking at names.
    if (!fileAllowed(catalog, packId, path, nowMs)) {
      return plain(404, 'not found');
    }
    const file = await storage.get(`packs/${packId}/${path}`);
    if (file === null) {
      return plain(404, 'not found');
    }
    return new Response(request.method === 'HEAD' ? null : file.body, {
      headers: {
        'content-type': contentType(path),
        'content-length': String(file.size),
        // An unlocked file never changes under the same name, so phones and
        // Cloudflare's cache may keep it.
        'cache-control': 'public, max-age=86400',
        ...OPEN_TO_ALL,
      },
    });
  }

  return plain(404, 'not found');
}

/** The kind of file, from the end of its name, so players know how to open it. */
export function contentType(path: string): string {
  const ending = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const kinds: Record<string, string> = {
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    json: 'application/json',
    txt: 'text/plain',
  };
  return kinds[ending] ?? 'application/octet-stream';
}
