// MAKE A PACK: turn one transmission's master files into the small files
// phones download, and add it to the catalog.
//
//   npm run pack -- t001 --number 1 --unlocks 2027-05-25T11:45:00Z
//
// Reads   media/masters/t001/        your originals (WAVs, clips, photos...)
// Writes  media/bucket/packs/t001/   the small copies
//         media/bucket/catalog.json  the list, with this pack added/updated
//
// Your masters are never changed. The bucket folder is an exact copy of what
// goes up to R2, so you can try it with the local server first.
//
// What happens to each kind of file:
//   .wav .aif .aiff .flac   -> .m4a (AAC). Mono at 64 kbps (voices, room
//                              tone), stereo at 128 kbps (music). Each file
//                              stays its own file: voices are never mixed.
//   .mov .mp4 .m4v          -> .mp4, shrunk to fit 320x240, sound removed
//                              (the sound comes from the audio files).
//   .jpg .jpeg .png .heic   -> .jpg, at most 640 pixels on the long side.
//   .svg .json .txt         -> copied as they are.
// In transmission.json, any audioFile that names a master (voice-1.wav) is
// changed to the new name (voice-1.m4a).
//
// Needs ffmpeg (the standard free tool for converting audio and video).
// On a Mac:  brew install ffmpeg

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

import { catalogProblems } from '../src/catalog.ts';
import type { Catalog, PackFile } from '../src/catalog.ts';

// THE QUALITY NUMBERS. Change these to trade size against quality.
const MONO_AUDIO_KBPS = 64;
const STEREO_AUDIO_KBPS = 128;
const CLIP_WIDTH = 320;
const CLIP_HEIGHT = 240;
/** Video quality, 18 (big, sharp) to 35 (tiny, smeary). The CRT look hides a lot. */
const CLIP_QUALITY = 28;
const PHOTO_LONG_SIDE = 640;

const MEDIA = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function option(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

function channels(file: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', file,
  ]).toString().trim();
  return Number(out) || 1;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

// --- read what was asked for ---

const id = process.argv[2];
if (!id || id.startsWith('-')) {
  fail('Which pack? Example:  npm run pack -- t001 --number 1 --unlocks 2027-05-25T11:45:00Z');
}
const number = Number(option('--number'));
const unlocksAt = option('--unlocks');
if (!(number > 0)) {
  fail('Add --number, the transmission number (1 for Transmission 001).');
}
if (unlocksAt === null || !Number.isFinite(Date.parse(unlocksAt))) {
  fail('Add --unlocks, the real-world time it unlocks, like 2027-05-25T11:45:00Z (Z = UTC).');
}
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  fail('ffmpeg isn\'t installed. On a Mac:  brew install ffmpeg');
}

const mastersFolder = join(MEDIA, 'masters', id);
const packFolder = join(MEDIA, 'bucket', 'packs', id);
const catalogFile = join(MEDIA, 'bucket', 'catalog.json');
if (!existsSync(mastersFolder)) {
  fail(`There's no folder ${mastersFolder}. Put the transmission's master files there first.`);
}

// Start the pack folder fresh, so a file you removed from the masters doesn't linger.
rmSync(packFolder, { recursive: true, force: true });
mkdirSync(packFolder, { recursive: true });

// --- convert every master ---

const renamed = new Map<string, string>(); // master name -> pack name
let mastersBytes = 0;

for (const name of readdirSync(mastersFolder).sort()) {
  const source = join(mastersFolder, name);
  if (name.startsWith('.') || !statSync(source).isFile()) {
    continue;
  }
  mastersBytes += statSync(source).size;
  const kind = extname(name).toLowerCase();
  const stem = basename(name, extname(name));
  let output: string | null = null;

  if (['.wav', '.aif', '.aiff', '.flac'].includes(kind)) {
    output = `${stem}.m4a`;
    const stereo = channels(source) >= 2;
    ffmpeg([
      '-i', source, '-vn',
      '-c:a', 'aac', '-b:a', `${stereo ? STEREO_AUDIO_KBPS : MONO_AUDIO_KBPS}k`,
      '-ar', '48000', '-ac', stereo ? '2' : '1',
      '-movflags', '+faststart',
      join(packFolder, output),
    ]);
  } else if (['.mov', '.mp4', '.m4v'].includes(kind)) {
    output = `${stem}.mp4`;
    ffmpeg([
      '-i', source, '-an',
      // Fit inside the box without stretching, and keep both sides even
      // (the video format needs that).
      '-vf', `scale=${CLIP_WIDTH}:${CLIP_HEIGHT}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v', 'libx264', '-crf', String(CLIP_QUALITY), '-preset', 'slow', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      join(packFolder, output),
    ]);
  } else if (['.jpg', '.jpeg', '.png', '.heic'].includes(kind)) {
    output = `${stem}.jpg`;
    ffmpeg([
      '-i', source,
      '-vf', `scale='min(${PHOTO_LONG_SIDE},iw)':'min(${PHOTO_LONG_SIDE},ih)':force_original_aspect_ratio=decrease`,
      '-q:v', '4', '-frames:v', '1',
      join(packFolder, output),
    ]);
  } else if (['.svg', '.json', '.txt'].includes(kind)) {
    output = name;
    copyFileSync(source, join(packFolder, output));
  } else {
    console.warn(`  skipped ${name}: I don't know what to do with ${kind || 'files with no ending'}`);
    continue;
  }
  if (renamed.has(name) || [...renamed.values()].includes(output)) {
    fail(`Two masters would both become ${output}. Rename one of them.`);
  }
  renamed.set(name, output);
}

// --- point transmission.json at the new file names ---

const scriptFile = join(packFolder, 'transmission.json');
if (existsSync(scriptFile)) {
  const transmission = JSON.parse(readFileSync(scriptFile, 'utf8'));
  for (const voice of transmission.voices ?? []) {
    if (typeof voice.audioFile === 'string') {
      const now = renamed.get(voice.audioFile);
      if (now === undefined) {
        fail(`transmission.json says ${voice.id} is in "${voice.audioFile}", but there's no such master file.`);
      }
      voice.audioFile = now;
    }
  }
  writeFileSync(scriptFile, `${JSON.stringify(transmission, null, 2)}\n`);
} else {
  console.warn('  note: no transmission.json in the masters, so the app will get the files but no script.');
}

// --- list the files and add the pack to the catalog ---

const files: PackFile[] = [...renamed.values()].sort().map((path) => ({
  path,
  bytes: statSync(join(packFolder, path)).size,
}));

const catalog: Catalog = existsSync(catalogFile)
  ? JSON.parse(readFileSync(catalogFile, 'utf8'))
  : { version: 1, transmissions: [] };
catalog.transmissions = catalog.transmissions.filter((entry) => entry.id !== id);
catalog.transmissions.push({ id, number, unlocksAt: new Date(Date.parse(unlocksAt)).toISOString(), files });
catalog.transmissions.sort((a, b) => a.number - b.number);

const problems = catalogProblems(catalog);
if (problems.length > 0) {
  fail(`The catalog would be broken, so it wasn't saved:\n  ${problems.join('\n  ')}`);
}
writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);

// --- report ---

const packBytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(`\nPack ${id} (Transmission ${String(number).padStart(3, '0')}), unlocks ${unlocksAt}`);
for (const file of files) {
  console.log(`  ${file.path.padEnd(28)} ${megabytes(file.bytes)}`);
}
console.log(`\n  masters: ${megabytes(mastersBytes)}   pack: ${megabytes(packBytes)}`);
console.log(`\nTry it:   npm run local -- --now ${unlocksAt}`);
console.log(`Send it:  npm run upload -- ${id}\n`);
