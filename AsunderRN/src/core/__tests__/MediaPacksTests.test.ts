import { catalogProblem, installedPackIds, NO_PACKS, packsToFetch, parseInstalledPacks, withInstalledPack } from '../MediaPacks';
import type { PackCatalog, PackEntry } from '../MediaPacks';

const T1: PackEntry = { id: 't001', number: 1, unlocksAt: '2027-05-25T11:45:00Z', files: [{ path: 'voice-1.m4a', bytes: 100 }] };
const T2: PackEntry = { id: 't002', number: 2, unlocksAt: '2027-05-26T11:45:00Z', files: [{ path: 'voice-1.m4a', bytes: 200 }] };
const CATALOG: PackCatalog = { version: 1, serverTime: '2027-05-27T00:00:00Z', transmissions: [T2, T1] };

describe('which packs to download', () => {
  it('fetches everything when the phone has nothing, lowest number first', () => {
    expect(packsToFetch(CATALOG, NO_PACKS).map((t) => t.id)).toEqual(['t001', 't002']);
  });

  it('skips packs already on the phone', () => {
    const have = withInstalledPack(NO_PACKS, T1, '2027-05-25T12:00:00Z');
    expect(packsToFetch(CATALOG, have).map((t) => t.id)).toEqual(['t002']);
  });

  it('fetches a pack again when Evan re-makes it', () => {
    const have = withInstalledPack(NO_PACKS, T1, '2027-05-25T12:00:00Z');
    const remade: PackCatalog = { ...CATALOG, transmissions: [{ ...T1, files: [{ path: 'voice-1.m4a', bytes: 101 }] }] };
    expect(packsToFetch(remade, have).map((t) => t.id)).toEqual(['t001']);
  });

  it('lists installed packs in number order', () => {
    const have = withInstalledPack(withInstalledPack(NO_PACKS, T2, 'x'), T1, 'y');
    expect(installedPackIds(have)).toEqual(['t001', 't002']);
  });
});

describe('the saved record', () => {
  it('reads back what was saved', () => {
    const have = withInstalledPack(NO_PACKS, T1, '2027-05-25T12:00:00Z');
    expect(parseInstalledPacks(JSON.stringify(have))).toEqual(have);
  });

  it('treats missing or broken records as empty instead of crashing', () => {
    expect(parseInstalledPacks(null)).toEqual(NO_PACKS);
    expect(parseInstalledPacks('{not json')).toEqual(NO_PACKS);
    expect(parseInstalledPacks('{"version":7}')).toEqual(NO_PACKS);
  });
});

describe('checking what the server sent', () => {
  it('accepts a real catalog', () => {
    expect(catalogProblem(CATALOG)).toBeNull();
  });

  it('refuses a Wi-Fi login page or other nonsense', () => {
    expect(catalogProblem('<html>Sign in to Cafe WiFi</html>')).not.toBeNull();
    expect(catalogProblem({ version: 2, transmissions: [] })).not.toBeNull();
  });

  it('refuses file names that could escape the pack folder', () => {
    const sneaky = { ...CATALOG, transmissions: [{ ...T1, files: [{ path: '../../evil', bytes: 1 }] }] };
    expect(catalogProblem(sneaky)).toMatch(/bad file name/);
    const badId = { ...CATALOG, transmissions: [{ ...T1, id: '../t001' }] };
    expect(catalogProblem(badId)).toMatch(/bad id/);
  });
});
