# Media: how transmissions get onto phones

Decided (Evan, Nov 23): the app download stays small. Each transmission is a **pack** (its voice tracks, room tone, clips, photos and script), kept on Cloudflare and downloaded by the phone once that transmission has unlocked. After that the pack lives on the phone and plays with no signal. The CRT look isn't in the files: the phone draws it live.

```
your Mac                         Cloudflare                     a phone
masters/t001/  --npm run pack-->  R2 bucket (private)
 (WAVs, clips)   bucket/ folder     |
                 --npm run upload-> Worker  <--"what's unlocked?"-- app opens
                                    (checks the date) --t001 files-->  kept in the app
```

- **R2** is Cloudflare's file storage. The bucket is private: nobody can read it directly.
- The **Worker** is a tiny program Cloudflare runs whenever a phone asks. It reads the clock and only hands out packs whose unlock time has passed. A locked pack looks exactly like one that doesn't exist, and changing your phone's clock doesn't help, because the date that counts is the server's.
- The **app** (`AsunderRN/src/media`) asks when it opens and whenever it comes back to the front, downloads what's new, and keeps it.

## What's in this folder

| Path | What it is |
|---|---|
| `src/catalog.ts` | The catalog's shape and the unlock rule |
| `src/handler.ts` | The server's whole job: answer `/catalog` and `/packs/<id>/<file>` |
| `src/worker.ts` | The Cloudflare version (reads from R2) |
| `dev/serve-local.ts` | The pretend version for your Mac (reads from `bucket/`) |
| `tools/make-pack.ts` | Turns masters into a pack |
| `tools/upload-pack.ts` | Sends a pack up to R2 |
| `test/` | Checks that locked packs stay locked |
| `wrangler.toml` | Cloudflare's settings (names the Worker and the bucket) |
| `masters/` | **Your originals.** Not in git (too big, and they're yours). Back them up. |
| `bucket/` | The packs the tool makes: an exact copy of what goes in R2. Not in git. |

## One-time setup on your Mac

From the `media` folder:

```bash
npm install
```

That fetches the tools, including `wrangler` (Cloudflare's command-line tool). You also need ffmpeg, the standard free tool for converting audio and video:

```bash
brew install ffmpeg
```

## Make a pack

1. Put one transmission's masters in `media/masters/t001/`: one WAV per voice (never mixed), room tone, sound effects, music, clips (`.mov`/`.mp4`), photos, vector art (`.svg`), and `transmission.json` (the script; see `AsunderRN/src/core/Transmission.ts`). In `transmission.json`, each voice's `audioFile` names its master, like `"voice-1.wav"`.
2. Run:

   ```bash
   npm run pack -- t001 --number 1 --unlocks 2027-05-25T11:45:00Z
   ```

   `--unlocks` is **real-world** time, when listeners get it. `Z` means UTC, and 11:45 UTC is 7:45 AM in New York in summer. The in-story date is the app clock's job, not this.

It prints every file's size. To trade size against quality, change the numbers at the top of `tools/make-pack.ts` (`MONO_AUDIO_KBPS`, `CLIP_QUALITY` and the rest).

A test with three 5-minute WAV tracks, a 20-second 1080p clip and a 12-megapixel photo: **155 MB of masters became a 7.6 MB pack.**

## Try it before any account exists

1. Start the pretend server, pretending it's a day when the pack has unlocked:

   ```bash
   npm run local -- --now 2027-05-25T12:00:00Z
   ```

   It prints two addresses. Leave it running.
2. In `AsunderRN/src/media/MediaConfig.ts`, set `MEDIA_SERVER_URL` to one of them:
   - `http://localhost:8787` for the browser preview on the same Mac
   - the "On a phone" address for a phone on the same Wi-Fi
3. Open the app. The server window logs each request, and you'll see the pack's files go by.

Try `--now` with a date before the unlock to see the pack stay hidden. Put `MEDIA_SERVER_URL` back to `null` when you're done, so the app doesn't keep looking for your Mac.

## Set up the real one on Cloudflare

Nothing here has been done yet. Each step is yours to say yes to.

1. **Make a free Cloudflare account** at dash.cloudflare.com.
2. **Turn on R2.** Heads up: Cloudflare asks for a card or PayPal before it lets you turn on R2, even though the free allowance covers what Asunder needs and nothing gets charged within it. If that's a problem, say so. There's a no-card fallback (the Worker can carry the files itself, up to 25 MB each), but it's more fiddly.
3. **Make a bucket** called `asunder-media` (R2, then Create bucket). Leave public access **off**. The Worker is the only way in.
4. **Sign wrangler in** (it opens your browser once):

   ```bash
   npx wrangler login
   ```

5. **Put the Worker online:**

   ```bash
   npm run deploy
   ```

   It prints its address, like `https://asunder-media.<your-account>.workers.dev`.
6. **Send a pack up:**

   ```bash
   npm run upload -- t001
   ```

   The files go first and the catalog last, so a phone never sees a pack that's only half there.
7. **Point the app at it:** put that address in `MEDIA_SERVER_URL`.

### What it costs

Free allowances, as Cloudflare listed them in Nov 2026 (they can change, so check before you rely on them):

- R2: 10 GB stored, and downloads cost nothing (no "egress" fee). A whole season is about 0.5 GB.
- Workers: 100,000 requests a day. Each phone makes a few per visit.

At Asunder's size this should stay at $0. To be safe, set a billing alert in the Cloudflare dashboard.

## Fixing or replacing a pack

Change the masters, then run `npm run pack` and `npm run upload` again with the same id. Phones spot that the files changed and download the pack again. Packs already on a phone are never deleted, even if you remove one from the catalog.

## Not done yet

- **The first transmission inside the app.** The plan is to ship T001 in the app download, so a brand-new listener has something with no signal. That waits for a real recording.
- **Playing a pack.** The app downloads and keeps packs, and can load one with its voices pointing at the files on the phone (`loadPackTransmission`). When a transmission starts, and how the listener finds it on the band, is still yours to decide, so nothing plays them yet.
- **Tested on a real phone.** The download code is checked by tests and against the pretend server, but it hasn't run on an iPhone or Android yet.
