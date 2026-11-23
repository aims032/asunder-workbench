// THE CLOUDFLARE VERSION: plugs the R2 bucket into the shared handler.
//
// A "Worker" is a small program Cloudflare runs for you whenever someone
// visits its address. You don't rent a machine or keep anything switched on.
// `env.MEDIA` is the R2 bucket, connected by name in wrangler.toml.
//
// The bucket itself stays private. Phones can only reach it through here,
// which is what keeps locked transmissions locked.

import { handleRequest } from './handler.ts';
import type { Storage } from './handler.ts';

// The few bits of Cloudflare's R2 types this file uses, written out so the
// project doesn't need Cloudflare's type package.
interface R2Object {
  body: ReadableStream;
  size: number;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}
interface Env {
  MEDIA: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const storage: Storage = {
      async get(key) {
        const found = await env.MEDIA.get(key);
        return found === null ? null : { body: found.body, size: found.size };
      },
    };
    return handleRequest(request, storage, Date.now());
  },
};
