# Asunder V2 — Receiver App

Handoff for Claude Code, written Nov 6, 2026 and updated Nov 12, 2026. Put this file at the root of the repo. The full design lives in `/docs` (copy the five project docs there: Build Foundation, Transmission Rules, Instruments, Color, Theoretical Concepts). When this file and `/docs` disagree, `/docs` wins. **When either disagrees with something newer Evan has decided, the newer decision wins** (Confirmed Nov 12): follow it and fix the doc. Ask Evan about anything that's still unclear.

## What this is

Asunder is a native iPhone app: a radio receiver that belongs to the story's world. It is the Physicist's workbench: a bench of instruments (a tuning dial, a spectrum analyzer, and an oscilloscope), drawn as real hardware and pointed at a shared band that obeys learnable laws. There are no transmissions at launch, so the app has to work on its own as a toy and a game. Transmissions come later, as in-world events.

## How Evan works (read this first)

- Evan is learning to code from scratch. He has ten years of synths and signal chains, so audio routing, sequencers and parameter locks are familiar to him. Swift is new. The plan is that **you write the code and he reads every line.** By Phase 2 he should be able to change the band range, add a feature, or adjust a rule on his own.
- Keep code readable over clever. Use short files, clear names, and a comment on anything that isn't obvious.
- **Put every feel number in one place** (`Tuning.swift`): friction, damping, detent spacing, bandwidth, noise mix. Give each one a comment saying what it does to the feel. He'll tune by changing these.
- After each change, explain in plain language what you did and why, and point to the constant he'd change to make it feel different.
- Talk to him like a peer. Be honest when something is weak. Ask before you build anything large or ambiguous.
- **Don't decide anything the docs mark Open.** Build a placeholder behind a named constant or protocol, and tell him what you assumed.
- Don't write story content (lyrics, terminal entries, equations, dialogue). Evan writes all of it.

Status tags in `/docs`: **Confirmed** means Evan decided it. **Proposed** is a recommendation, fine to build but easy to change. **Open** means don't choose.

## Stack (Confirmed)

Swift + SwiftUI, AVAudioEngine, Core Haptics, Xcode → TestFlight → App Store. GitHub for source. iPhone only for now; Android comes later as a Kotlin port. Use no third-party dependencies unless Evan agrees to one. No server until the first transmission (Phase 8).

## Look (Confirmed Nov 7, restated Nov 12)

- **Real hardware**, in the style of the UAD plug-ins Evan uses: realistic knobs and buttons, cream faceplates, wood, worn paint, amber VU lights. Warm, lived in, uncluttered. Black-and-white is for the website, not the app. Details in `docs/Color.md`.
- **Evan makes the artwork.** Until the look phase (Phase 4), build plain placeholders, and keep each control's behavior separate from its picture so his art can drop in. Don't generate final art, and don't style ahead of it.

## Current job: Phase 0 → Phase 1

**Phase 0 (Evan, with your help):** Xcode installed, Apple Developer account, an empty SwiftUI app running on his iPhone, repo pushed.

**Phase 1, the dial + static.** Done when Evan can hand the phone to someone with no explanation and they keep playing with it for a minute.

Build:
1. **The band.** A loop, with positions normalized to 0–1 that wrap (Confirmed). Show frequency through a separate display mapping, because whether it's a real FM band (87.5–108.0) or an invented one is still Open. Default to FM-looking numbers behind one function.
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

- `Asunder.xcodeproj` + `Asunder/`: the iPhone app (SwiftUI, audio, haptics). `Asunder/` is a synced folder, so new files join the target automatically.
- `AsunderCore/`: a local Swift package with the pure logic (band, clock, dial physics, `Tuning.swift`). It must not import UIKit, SwiftUI or AVFoundation, so it keeps building and testing on Linux CI.
- `docs/`: the design docs (source of truth). `materials/`: Evan's poetry and channel maps, reference only.
- CI (`.github/workflows/ci.yml`) runs the core tests on every push and builds the app on PRs.
