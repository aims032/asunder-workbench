// SEND A PACK UP: copy one pack from media/bucket to the real R2 bucket,
// then the catalog.
//
//   npm run upload -- t001
//
// The catalog goes last on purpose: phones only learn a pack exists from the
// catalog, so by the time they can see it, every file is already there.
//
// Uses `wrangler`, Cloudflare's command-line tool (installed with npm install).
// The first time, it opens your browser to sign in to Cloudflare.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { catalogProblems } from '../src/catalog.ts';
import type { Catalog } from '../src/catalog.ts';

/** Must match bucket_name in wrangler.toml. */
const BUCKET = 'asunder-media';
const MEDIA = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function put(key: string, file: string): void {
  console.log(`  uploading ${key}`);
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--remote'], {
    cwd: MEDIA,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

const id = process.argv[2];
if (!id) {
  fail('Which pack? Example:  npm run upload -- t001');
}
const catalogFile = join(MEDIA, 'bucket', 'catalog.json');
if (!existsSync(catalogFile)) {
  fail('There\'s no media/bucket/catalog.json yet. Make a pack first:  npm run pack -- ...');
}
const catalog: Catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const problems = catalogProblems(catalog);
if (problems.length > 0) {
  fail(`The catalog has problems, so nothing was sent:\n  ${problems.join('\n  ')}`);
}
const entry = catalog.transmissions.find((t) => t.id === id);
if (entry === undefined) {
  fail(`${id} isn't in the catalog. Make it first:  npm run pack -- ${id} ...`);
}

for (const file of entry.files) {
  const local = join(MEDIA, 'bucket', 'packs', id, file.path);
  if (!existsSync(local)) {
    fail(`${local} is missing. Run npm run pack for ${id} again.`);
  }
}
for (const file of entry.files) {
  put(`packs/${id}/${file.path}`, join(MEDIA, 'bucket', 'packs', id, file.path));
}
put('catalog.json', catalogFile);
console.log(`\nDone. ${id} will reach phones from ${entry.unlocksAt}.\n`);
