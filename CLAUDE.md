# Asunder V2 — Receiver App

Handoff for Claude Code, written Nov 6, 2026 and updated Nov 12, 2026. Put this file at the root of the repo. The full design lives in `/docs` (copy the five project docs there: Build Foundation, Transmission Rules, Instruments, Color, Theoretical Concepts). When this file and `/docs` disagree, `/docs` wins. **When either disagrees with something newer Evan has decided, the newer decision wins** (Confirmed Nov 12): follow it and fix the doc. Ask Evan about anything that's still unclear.

## What this is

Asunder is a phone app (iPhone and Android; see Stack): a radio receiver that belongs to the story's world. It is the Physicist's workbench: a bench of instruments (a tuning dial, a spectrum analyzer, and an oscilloscope), drawn as real hardware and pointed at a shared band that obeys learnable laws. There are no transmissions at launch, so the app has to work on its own as a toy and a game. Transmissions come later, as in-world events.

## How Evan works (read this first)

- Evan is learning to code from scratch. He has ten years of synths and signal chains, so audio routing, sequencers and parameter locks are familiar to him. Swift is new. The plan is that **you write the code and he reads every line.** By Phase 2 he should be able to change the band range, add a feature, or adjust a rule on his own.
- Keep code readable over clever. Use short files, clear names, and a comment on anything that isn't obvious.
- **Put every feel number in one place** (`Tuning.swift`): friction, damping, detent spacing, bandwidth, noise mix. Give each one a comment saying what it does to the feel. He'll tune by changing these.
- After each change, explain in plain language what you did and why, and point to the constant he'd change to make it feel different.
- Talk to him like a peer. Be honest when something is weak. Ask before you build anything large or ambiguous.
- **Don't decide anything the docs mark Open.** Build a placeholder behind a named constant or protocol, and tell him what you assumed.
- Don't write story content (lyrics, terminal entries, equations, dialogue). Evan writes all of it.

Status tags in `/docs`: **Confirmed** means Evan decided it. **Proposed** is a recommendation, fine to build but easy to change. **Open** means don't choose.

## Stack (Confirmed Nov 19; supersedes "Swift on iPhone only")

**React Native with Expo, in TypeScript: one codebase for iPhone and Android.** Those two are the product. The same code also runs in a web browser, which is a preview only (handy for a quick look, not something to ship). The app is in `AsunderRN/`.

- Expo and third-party libraries are approved (Confirmed Nov 19; supersedes "no third-party dependencies"). The ones in use: Reanimated and Gesture Handler (the dial, running on the screen thread), Skia (drawing), react-native-audio-api and react-native-audio-worklets (the sound, generated sample by sample on the audio thread), and a small native module of our own in `AsunderRN/modules/asunder-haptics` (Core Haptics on iPhone, the vibrator on Android). When you add another, tell Evan what it is for.
- **The Swift app stays in the repo, untouched**, so the two can be compared side by side: `Asunder/`, `AsunderCore/`, `Asunder.xcodeproj`. Don't edit it as part of React Native work. Whether and when it is retired is not decided.
- The TypeScript core (`AsunderRN/src/core`) is a file-for-file port of `AsunderCore`. A test (`SwiftParity.test.ts`) checks it against numbers saved from the real Swift code.
- The feel numbers for the React Native app are in `AsunderRN/src/core/Tuning.ts` (the port of `Tuning.swift`). Where this file says `Tuning.swift`, read `Tuning.ts` for React Native work.
- These libraries change fast and are newer than what you remember. Check the version in `AsunderRN/package.json` and read the types in `node_modules` or the current docs before using an API.
- GitHub for source. ~~No server until the first transmission (Phase 8).~~ Decided Nov 23 (Evan): transmission media lives on Cloudflare (R2 bucket + a small Worker that only hands out unlocked packs), downloaded by the phone when each transmission unlocks and kept for offline play. The app ships small, with only the first transmission inside. Code and setup steps: `media/README.md`; app side: `AsunderRN/src/media`.

## Look (Confirmed Nov 7, restated Nov 12)

- **Real hardware**, in the style of the UAD plug-ins Evan uses: realistic knobs and buttons, cream faceplates, wood, worn paint, amber VU lights. Warm, lived in, uncluttered. Black-and-white is for the website, not the app. Details in `docs/Color.md`.
- **Evan makes the artwork.** Until the look phase (Phase 4), build plain placeholders, and keep each control's behavior separate from its picture so his art can drop in. Don't generate final art, and don't style ahead of it.

## Current job: Phase 0 → Phase 1

**Phase 0 (Evan, with your help):** Xcode installed, Apple Developer account, an empty SwiftUI app running on his iPhone, repo pushed.

**Phase 1, the dial + static.** Done when Evan can hand the phone to someone with no explanation and they keep playing with it for a minute.

Build:
1. **The band.** A loop, with positions normalized to 0–1 that wrap (Confirmed). Show frequency through a separate display mapping. ~~Whether it's a real FM band (87.5–108.0) or an invented one is still Open.~~ Confirmed Nov 19: a wide spectrum, radio up through visible light, log-spaced, on one wheel with many more notches (`SpectrumDisplay`). Not up to the Planck scale.
2. **The dial.** A real-looking radio dial you can see and spin forever (Confirmed Nov 12; supersedes "small, mostly felt"). A wheel with no end stop is the preferred form. Which kind of wheel is Open, so build the proposed **edge-on thumbwheel** (a strip rolled sideways) behind a protocol so a face-on wheel or a knob can be swapped in. Its size and place on the bench are Open too. It has inertia and friction: a flick spins and coasts, and a slow drag tracks the finger exactly. There's no end stop because the band is a loop. A needle and readout lag the hand slightly (damping). Most of what "satisfying" means comes from this. In Phase 1 the dial is a plain placeholder drawing; the feel is the job.
3. **Haptics.** A detent tick at regular intervals, and a distinct pulse when you're centered on a feature.
4. **Generated static.** An AVAudioSourceNode at full sample rate. It never loops. It mixes white, pink and brown noise; that mix is the "noise temperature." It runs warmer on moving days and cooler and quieter on Still days, read as physics (Confirmed Nov 19): hot = brighter, more hiss; Still days drain to a low, quiet rumble. Static and signal share one chain: tuning off-center thins it through the same EQ path a signal will use later.
5. **The shared clock.** UTC minus an Asunder epoch. The epoch is Open, so use a placeholder constant set to a Sunday 00:00 UTC. The day turns at 00:00 UTC (Proposed). The week rule (Transmission Rules §4):
   ```
   P = [W, L, S, R, W, S, L]      // S = Still day
   rule(k, w) = P[(k + 3w) mod 7] // k = day of week (0 = Sunday, UTC), w = weeks since epoch
   ```
6. **One Carrier feature.** A faint, steady tone at a fixed position that never moves, with a kink at every day turn (Instruments §3). Its strength is a bell curve on the distance from the dial to center. Confirmed Nov 19: it's heard as a zero-beat whistle (pitch slides down as you tune in, a low hum dead on), and the kink is a dropout of a second or two.
7. **Background audio.** Declare the audio background mode so it keeps playing with the screen off. Test it as a radio, not a toy.

**Status (Nov 19):** Phase 1 is built (PR #4, waiting for Evan to hear it on his phone). Phase 2 has started on its own branch (PR #5, stacked on #4) with the wide band only. **Weather features are on hold** until Evan has worked out why things behave the way they do on the spectrum (Instruments §3). Don't place features or pick their behavior before then.

**Status (Nov 20):** Phase 3 has started with the spectrum analyzer (`AsunderRN/src/analyzer`, core in `src/core/Analyzer.ts`): a hybrid digital/analog instrument modeled on the Keysight N9032B, swept from the band (not an FFT of the sound), with a spectrogram, above the dial (Instruments decisions 22–25). Its feel numbers are `AnalyzerTuning` in `Tuning.ts`, kept apart from `Tuning` because the Swift parity test checks `Tuning`'s names against `Tuning.swift`. The scope is next.

Out of scope for Phase 1: the analyzer, scope and terminal (Phases 3+), the finished look (Phase 4; Phase 1 screens are plain placeholders, see Look above), transmissions, the Shatter, the server, and login (there is none, Confirmed).

Suggested shape: `BandModel` (positions, wrap, display mapping), `AsunderClock` (epoch, day index, rule of the day), `DialView` + `DialPhysics`, `AudioEngine` (noise source → EQ → mixer, plus a feature oscillator), `Haptics`, `Tuning.swift`. Write unit tests for the clock and the wrap math, since every phone has to compute the same band.

## Rules that hold across the whole build

- **Deterministic and shared.** Every phone computes the same band from the clock. Use no randomness without a seed derived from the clock or ids.
- **Patterns must be learnable**, never pure random.
- **Keep fiction and code separate.** In code, use plain names (`position`, `strength`, `seed`). Don't use "collapse" or "superposition" for any mechanic. "Observation" is the word for a whole listen.
- **Audio quality is a priority.** Generated audio is not a compromise.

## Phase map (Build Foundation §9)

0 Setup → 1 Dial + static → 2 Weather (pulse, walker, breathers, the three rules, Still days) → 3 Analyzer + scope → 4 Receiver shell (the real-hardware look) → 5 Ship v1, no transmissions → 6 Signal engine + content pipeline → 7 First transmission → 8 The Shatter + server → 9 Story layer.

## Repo layout

Branches (Nov 19): **`main`** is the React Native app, with the Swift code kept beside it for comparison. **`swift`** is the Swift-only app frozen as of Phase 2a (the wide band); don't build on it. New work branches off `main`. The first, unmerged Phase 1 attempt is saved as the tag `archive/phase1-first-attempt`.

- `AsunderRN/`: **the React Native app (iPhone, Android, web preview).** Start with `AsunderRN/README.md`, which says how to run it.
  - `src/core/`: the pure logic (band, clock, dial physics, the sound chain, `Tuning.ts`). It must not import React, React Native or any library, so it tests anywhere. Every file starts with `'worklet';` so it can also run on the audio and screen threads; because of that, a helper function must be written ABOVE the first place it is used.
  - `src/dial/`, `src/audio/`, `src/haptics/`, `App.tsx`: the app itself. A file ending `.native.ts` is for phones and `.web.ts` is for the browser.
  - `modules/asunder-haptics/`: our own small native module for haptics (Swift and Kotlin).
  - `tools/swift-golden/`: the Swift program that writes the numbers `SwiftParity.test.ts` checks against (`npm run golden`).
  - `ios/` and `android/` are generated by Expo and not kept in git. Never edit them by hand: change `app.json` or a plugin in `plugins/`.
- `Asunder.xcodeproj` + `Asunder/`: the Swift iPhone app (SwiftUI, audio, haptics), kept for comparison. `Asunder/` is a synced folder, so new files join the target automatically.
- `AsunderCore/`: a local Swift package with the pure logic (band, clock, dial physics, `Tuning.swift`). It must not import UIKit, SwiftUI or AVFoundation, so it keeps building and testing on Linux CI.
- `docs/`: the design docs (source of truth). `materials/`: Evan's poetry and channel maps, reference only.
- CI (`.github/workflows/ci.yml`) runs the Swift core tests and the React Native type-check and tests on every push, and builds the Swift app on PRs. It does not build the React Native app for a phone yet.
