import { NO_PACKS } from '../../core';
import type { InstalledPacks, PackCatalog } from '../../core';
import type { PackStore } from '../PackStore.types';
import { loadPackTransmission, syncPacks } from '../PackSync';
import type { FetchJson } from '../PackSync';

// A pretend server and a pretend phone, so the whole catch-up can be checked
// without a network or a device.

const CATALOG: PackCatalog = {
  version: 1,
  serverTime: '2027-05-27T00:00:00Z',
  transmissions: [
    { id: 't001', number: 1, unlocksAt: '2027-05-25T11:45:00Z', files: [{ path: 'voice-1.m4a', bytes: 5 }, { path: 'transmission.json', bytes: 9 }] },
    { id: 't002', number: 2, unlocksAt: '2027-05-26T11:45:00Z', files: [{ path: 'voice-1.m4a', bytes: 7 }] },
  ],
};

function fakePhone(serverFiles: Record<string, string>) {
  let installed: InstalledPacks = NO_PACKS;
  const kept: Record<string, string> = {};
  const asked: string[] = [];
  const store: PackStore = {
    loadInstalled: () => installed,
    saveInstalled: (next) => {
      installed = next;
    },
    download: async (url, packId, path) => {
      asked.push(url);
      const body = serverFiles[url];
      if (body === undefined) {
        throw new Error('404');
      }
      kept[`${packId}/${path}`] = body;
      return body.length;
    },
    fileUrl: async (packId, path) => `file:///phone/${packId}/${path}`,
    readText: async (packId, path) => kept[`${packId}/${path}`],
  };
  return { store, asked, installed: () => installed };
}

const SERVER = 'https://media.test';
const SCRIPT = JSON.stringify({ id: 't001', number: 1, durationSeconds: 5, voices: [{ id: 'voice-1', audioFile: 'voice-1.m4a', standIn: { pitchHz: 100, formantsHz: [], breath: 0 } }], script: [] });
const FILES = {
  [`${SERVER}/packs/t001/voice-1.m4a`]: 'AUDIO',
  [`${SERVER}/packs/t001/transmission.json`]: SCRIPT.padEnd(9).slice(0, 9),
  [`${SERVER}/packs/t002/voice-1.m4a`]: 'AUDIO-2',
};
const serverSays = (answer: unknown): FetchJson => async () => answer;

describe('catching up with the server', () => {
  it('downloads every unlocked pack and remembers them', async () => {
    const phone = fakePhone(FILES);
    const result = await syncPacks(SERVER, phone.store, serverSays(CATALOG), 1000);
    expect(result).toEqual({ kind: 'done', fetched: ['t001', 't002'], failed: [] });
    expect(Object.keys(phone.installed().packs).sort()).toEqual(['t001', 't002']);
  });

  it('downloads nothing the second time', async () => {
    const phone = fakePhone(FILES);
    await syncPacks(SERVER, phone.store, serverSays(CATALOG), 1000);
    phone.asked.length = 0;
    const again = await syncPacks(SERVER, phone.store, serverSays(CATALOG), 1000);
    expect(again).toEqual({ kind: 'done', fetched: [], failed: [] });
    expect(phone.asked).toEqual([]);
  });

  it('with no signal, changes nothing and says so', async () => {
    const phone = fakePhone(FILES);
    const noSignal: FetchJson = async () => {
      throw new Error('Network request failed');
    };
    const result = await syncPacks(SERVER, phone.store, noSignal, 1000);
    expect(result.kind).toBe('offline');
    expect(phone.installed()).toEqual(NO_PACKS);
  });

  it("doesn't trust a Wi-Fi login page pretending to be the catalog", async () => {
    const phone = fakePhone(FILES);
    const result = await syncPacks(SERVER, phone.store, serverSays('<html>log in</html>'), 1000);
    expect(result.kind).toBe('offline');
  });

  it('a pack cut off halfway is not marked installed, and the others still arrive', async () => {
    const { [`${SERVER}/packs/t001/transmission.json`]: _gone, ...missingOne } = FILES;
    const phone = fakePhone(missingOne);
    const result = await syncPacks(SERVER, phone.store, serverSays(CATALOG), 1000);
    expect(result).toEqual({ kind: 'done', fetched: ['t002'], failed: ['t001'] });
    expect(Object.keys(phone.installed().packs)).toEqual(['t002']);
  });

  it('a file that arrives at the wrong size counts as a failed download', async () => {
    const phone = fakePhone({ ...FILES, [`${SERVER}/packs/t002/voice-1.m4a`]: 'SHORT' });
    const result = await syncPacks(SERVER, phone.store, serverSays(CATALOG), 1000);
    expect(result.kind === 'done' && result.failed).toEqual(['t002']);
  });
});

describe('loading a downloaded transmission', () => {
  it('points each voice at the copy on the phone', async () => {
    const phone = fakePhone({});
    phone.store.readText = async () => SCRIPT;
    const transmission = await loadPackTransmission(phone.store, 't001');
    expect(transmission.voices[0].audioFile).toBe('file:///phone/t001/voice-1.m4a');
  });
});
