// THE PRETEND SERVER: the same handler as the cloud, run on your own computer
// and reading from the media/bucket folder instead of R2.
//
// Use it to try downloads before any Cloudflare account exists:
//   npm run local            (from the media folder)
// It prints the address to put in the app's MediaConfig.ts.
//
// To test unlocking, pretend it's another day:
//   npm run local -- --now 2027-06-01T12:00:00Z

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { handleRequest } from '../src/handler.ts';
import type { Storage } from '../src/handler.ts';

const PORT = 8787;
const PACKS_FOLDER = resolve(import.meta.dirname, '..', 'bucket');

function argument(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

const pretendNow = argument('--now');
const pretendMs = pretendNow === null ? null : Date.parse(pretendNow);
if (pretendNow !== null && !Number.isFinite(pretendMs)) {
  console.error(`--now needs a date like 2027-06-01T12:00:00Z, not "${pretendNow}"`);
  process.exit(1);
}

const storage: Storage = {
  async get(key) {
    const path = resolve(join(PACKS_FOLDER, key));
    // Never read outside the packs folder, whatever the name says.
    if (!path.startsWith(PACKS_FOLDER + sep)) {
      return null;
    }
    try {
      const info = await stat(path);
      const bytes = await readFile(path);
      return { body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, size: info.size };
    } catch {
      return null;
    }
  },
};

const server = createServer(async (incoming, outgoing) => {
  const request = new Request(`http://localhost${incoming.url ?? '/'}`, { method: incoming.method });
  const now = pretendMs ?? Date.now();
  const response = await handleRequest(request, storage, now);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
  console.log(`${response.status}  ${incoming.method} ${incoming.url}`);
});

server.listen(PORT, () => {
  console.log(`Pretend media server, serving ${PACKS_FOLDER}`);
  if (pretendNow !== null) {
    console.log(`Pretending it is ${new Date(pretendMs!).toISOString()}`);
  }
  console.log(`\nIn the browser preview on this computer, use:  http://localhost:${PORT}`);
  // A phone on the same Wi-Fi can't reach "localhost" (that means the phone
  // itself), so also print this computer's address on the network.
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`On a phone on the same Wi-Fi, use:       http://${net.address}:${PORT}`);
      }
    }
  }
});
