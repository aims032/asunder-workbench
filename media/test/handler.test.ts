// Checks the server hands out unlocked packs and nothing else.
// Run with:  npm test   (from media)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { catalogProblems, unlockedCatalog } from '../src/catalog.ts';
import type { Catalog } from '../src/catalog.ts';
import { handleRequest } from '../src/handler.ts';
import type { Storage } from '../src/handler.ts';

const CATALOG: Catalog = {
  version: 1,
  transmissions: [
    { id: 't002', number: 2, unlocksAt: '2027-06-01T12:00:00Z', files: [{ path: 'voice-1.m4a', bytes: 5 }] },
    { id: 't001', number: 1, unlocksAt: '2027-05-25T12:00:00Z', files: [{ path: 'voice-1.m4a', bytes: 5 }] },
  ],
};

function fakeStorage(files: Record<string, string>): Storage {
  return {
    async get(key) {
      return key in files ? { body: files[key], size: files[key].length } : null;
    },
  };
}

const STORAGE = fakeStorage({
  'catalog.json': JSON.stringify(CATALOG),
  'packs/t001/voice-1.m4a': 'AUDIO',
  'packs/t002/voice-1.m4a': 'LATER',
});

const MAY_30 = Date.parse('2027-05-30T00:00:00Z');

function get(path: string, nowMs = MAY_30): Promise<Response> {
  return handleRequest(new Request(`https://example.test${path}`), STORAGE, nowMs);
}

test('the catalog only lists packs that have unlocked', async () => {
  const response = await get('/catalog');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.transmissions.map((t: { id: string }) => t.id), ['t001']);
  assert.equal(body.serverTime, '2027-05-30T00:00:00.000Z');
});

test('the catalog is in number order once more unlock', () => {
  const later = unlockedCatalog(CATALOG, Date.parse('2027-07-01T00:00:00Z'));
  assert.deepEqual(later.transmissions.map((t) => t.id), ['t001', 't002']);
});

test('an unlocked file downloads', async () => {
  const response = await get('/packs/t001/voice-1.m4a');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'AUDIO');
  assert.equal(response.headers.get('content-type'), 'audio/mp4');
});

test('a locked file looks exactly like a missing one', async () => {
  const locked = await get('/packs/t002/voice-1.m4a');
  const missing = await get('/packs/t999/voice-1.m4a');
  assert.equal(locked.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(await locked.text(), await missing.text());
});

test('it unlocks on the dot', async () => {
  const response = await get('/packs/t002/voice-1.m4a', Date.parse('2027-06-01T12:00:00Z'));
  assert.equal(response.status, 200);
});

test('files not listed in a pack, and the master catalog, can not be fetched', async () => {
  assert.equal((await get('/packs/t001/secret.m4a')).status, 404);
  assert.equal((await get('/catalog.json')).status, 404);
  assert.equal((await get('/packs/t001/../catalog.json')).status, 404);
});

test('a missing catalog says so instead of guessing', async () => {
  const response = await handleRequest(new Request('https://example.test/catalog'), fakeStorage({}), MAY_30);
  assert.equal(response.status, 503);
});

test('catalogProblems catches the usual mistakes', () => {
  assert.deepEqual(catalogProblems(CATALOG), []);
  const broken: Catalog = {
    version: 1,
    transmissions: [
      { id: 't001', number: 1, unlocksAt: 'next tuesday', files: [{ path: '../x', bytes: 0 }] },
      { id: 't001', number: 2, unlocksAt: '2027-01-01T00:00:00Z', files: [] },
    ],
  };
  const problems = catalogProblems(broken);
  assert.ok(problems.some((p) => p.includes('unlocksAt')));
  assert.ok(problems.some((p) => p.includes('characters')));
  assert.ok(problems.some((p) => p.includes('no size')));
  assert.ok(problems.some((p) => p.includes('two packs')));
  assert.ok(problems.some((p) => p.includes('no files')));
});
