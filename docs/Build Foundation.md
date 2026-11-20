# Asunder V2 — Build Foundation

Started Nov 5, 2026. Running reference for how the app gets built. Status tags: **Confirmed** (Evan decided), **Proposed** (Claude's recommendation, not yet decided), **Open** (needs an answer before it matters).

Revision log:
- Nov 5 — first draft proposed Expo for iOS + Android. Same night, Evan chose Swift on iPhone first, Android later. Expo kept in §3 for the record.
- Nov 5 — shared world confirmed over personal receivers. Tracking (working out where and when a transmission will appear) adopted as a design principle.
- Nov 5 — **the Shatter** adopted: a transmission plays whole until the first time anyone observes it; observation shatters it into fragments that scatter across the band and fade, making room for new ones. Requires a small server (§4), superseding "no server for v1."
- Nov 5 — **observation defined**: hearing a transmission through to the end constitutes a whole listen. Mechanics proposed in §5.
- Nov 5 (late) — **the 3-day cycle** supersedes "fade over weeks, then gone." Shattered transmissions return whole after 3 moving days, drifted, and the cycle repeats. Fragment placement rules, the weekly rule rotation, Still days, the live chase, and the Asunder's gated voice are all in **Transmission Rules.md**. §5 below is marked where it's superseded; the pattern menu stays as background.
- Nov 6 — **No transmission at launch; the receiver is a suite of instruments.** The app ships as a toy and a game before anyone speaks on the band: generated static, lawful interference, a waterfall spectrum analyzer and an oscilloscope beside the dial. The first transmission is an event. Details in **Instruments.md**. The "ten listeners" question (what's good single-player) is answered by this: the band is alive from the clock alone. Phases in §9 reordered: the Shatter and the server move *after* the suite.
- Nov 7 — **The look is real hardware.** The receiver is drawn as the Physicist's hidden workstation, in the style of the UAD plug-ins: realistic controls, cream faceplates, wood, worn paint, amber VU lights, uncluttered. Black-and-white moves to the website. Supersedes the Nov 6 black-and-white app direction and settles device-vs-geometry (§7). Details in **Color.md**. (Entered here Nov 12.)
- Nov 12 — **Newest decision wins** when sources disagree; the repo docs were brought up to date on that rule. The dial is a real-looking wheel you can see and spin forever, superseding "small, mostly felt." The spectrum analyzer is a real analog instrument, superseding the waterfall as the display. Details in **Instruments.md**.
- Nov 19 — **Phase 1 sound decisions.** Noise temperature reads as physics (hot = brighter; Still days drain to a low, quiet rumble). The Carrier is heard as a zero-beat whistle that slides down to a hum on center. Its day-turn kink is a dropout. Sound details in **Instruments.md** (decisions 18–20). Detent ticks were also softened after Evan's first feel on the phone (the numbers are in `Tuning.swift`).
- Nov 19 — **The band is a wide spectrum, radio through light**, not FM. It is what Evan envisions for the Physicist and Hannah. Log-spaced, tuned with one wheel with many more notches. The top stops at light; Evan decided against stretching it to the string (Planck) scale: "it would already be too much to go that far." Details in **Instruments.md** (decision 21).

---

## 1. What an app is made of

Six layers. Every app has all six, even if some are tiny at first.

| Layer | Plain meaning | For Asunder |
| --- | --- | --- |
| **Client** | The thing on the phone. Screens, touch, sound out of the speaker. | The receiver: dial, analyzer, scope, needle, static, playback. |
| **Content** | The stuff the client shows or plays. | Music, dialogue fragments, transmissions, and a list describing each one (where it lives on the band, when, how long). Before the first transmission: the interference features (Instruments §3). |
| **Clock / rules** | The logic that decides what's happening right now. | Which transmissions and features are live, where, how far in, and whether transmissions are whole or shattered. |
| **Backend** | A computer somewhere else that the client talks to. | One small job: remember when each transmission was first observed (§4). Not needed until the first transmission. |
| **Pipeline** | How content gets from your desk into the app. | Logic Pro → bounce → tag → upload → appears in the app without a new release. |
| **Distribution** | Getting it onto strangers' phones. | App Store, via Xcode and TestFlight. |

Plus one thing that cuts across all of them: the **design system**, the shared vocabulary of color, type, motion, sound and haptics so every part feels like one device.

**What a "stack" is:** the set of tools you pick for those layers, stacked on each other. Your live rig is a stack (Octatrack as hub, Logic for recording, OBS for streaming, DistroKid for distribution). Swap one and the others adjust.

---

## 2. Decisions so far

- **Confirmed:** Native iPhone app in Swift first. Android later, as a port, once the design has stopped moving.
- **Confirmed:** First milestone is the dial itself: a satisfying wheel people want to play with, with precise frequencies to catch.
- **Confirmed (Nov 6):** **The receiver is a suite of instruments**, not a dial alone. Dial, spectrum analyzer, oscilloscope first. (Instruments.md) *The analyzer was a waterfall on Nov 6; as a display that was superseded Nov 12.*
- **Confirmed (Nov 6):** **No transmission at launch.** The app stands on its own as a toy and a game; the first transmission is an in-world event. (Instruments §7)
- **Confirmed (Nov 6):** **Static is generated on the phone**, not bounced from Logic. (Instruments §2)
- **Confirmed:** Frequencies move around the band according to algorithms we design. → Now specified: three rules on a weekly rotation (Transmission Rules §3–4). Proposed: the same rules drive the interference before launch (Instruments §3).
- **Confirmed:** **Shared world.** Everyone's receiver shows the same band at the same moment. Listeners can compare notes.
- **Confirmed:** **Tracking is the game.** The audience can work out, over time, where and when a transmission is likely to appear. Patterns are learnable, not random.
- **Confirmed:** **The Shatter.** A new transmission plays whole on the band until the first time anyone observes it. Observation shatters it: fragments scatter across the band. In-world: looking into the Asunder has a price; observation produces a result, and a result produces entropy.
- **Confirmed (Nov 5, late):** **The 3-day cycle.** Fragments last 3 moving days, then the whole returns, drifted, and the cycle repeats. Nothing is ever gone. Replaces fade-and-vanish.
- **Confirmed:** **Observation = a whole listen.** A transmission counts as observed when someone has heard it through to the end. Brushing past it, or catching part of it, does not shatter it. A completed **live chase** (following fragments across the band on the clock) also counts.
- **Confirmed:** **Both capture layers.** Live chase for solvers; after-the-fact stitching from recordings for everyone else.
- **Confirmed:** **The Asunder's voice is gated.** Reachable only by computing her position from the state of the band. Mystique first; the band may open at a story beat.
- **Confirmed (inherited):** Pirate-radio principle. Broadcasts run whether anyone listens; tuning joins something already underway. (Still true: the whole transmission is broadcasting before anyone finds it. Observation doesn't start it; it breaks it.)
- **Confirmed (inherited):** The receiver is in the story's world, not a menu around it.
- **Confirmed (Nov 7, restated Nov 12):** **The app looks like real hardware**: the Physicist's workbench, UAD-style. Black-and-white is for the website. (Color.md)
- **Confirmed (Nov 12):** **The dial is a real-looking wheel you can see and spin forever. The analyzer is a real-world analog instrument.** (Instruments.md)
- **Confirmed (Nov 12):** **Newest decision wins.** When the docs, the repo or an older decision disagree with something newer Evan has decided, the newer decision stands and the doc gets fixed.
- **Confirmed (Nov 19):** **The band is a wide spectrum, from radio up through infrared and visible light**, log-spaced, tuned with one bigger wheel. Not the FM band, and not up to the Planck scale. (Instruments decision 21)
- **Proposed:** A minimal server whose only job is the observation ledger (§4). Everything else stays deterministic on the phone. Not built until the first transmission.
- **Proposed (Nov 5; in question since Nov 7):** Extend the existing "Asunder" Design System artifact rather than start a new one. Its black-and-white ground now belongs to the website, so whether the app's hardware look joins it or gets its own system is Open (§7, Color.md). ~~Amber retired in the app.~~
- **Proposed:** The oscilloscope's collection is the 26 Signs, as closed Lissajous figures (Instruments §6).
- **Open:** Lock tolerance and dropout grace for a whole listen (§5). ~~Device look vs abstract geometry (§7).~~ Resolved Nov 7: device, real hardware. ~~Band range (§5).~~ Resolved Nov 19: radio through light. What the first observer is given (§5). Instruments open list (Instruments §9).

---

## 3. Stack (Confirmed: Swift on iPhone)

| Layer | Tool | What it is |
| --- | --- | --- |
| Language | **Swift** | Apple's language. Clean, modern, and the only first-class way to reach the audio engine. |
| Screens | **SwiftUI** | Describe what the screen should look like given its state; Apple redraws it. |
| Audio | **AVAudioEngine** | A node graph: generators, players, filters, mixer, output. A modular rack in code. This is why we chose Swift. Also the noise generator and the FFT tap for the analyzer. |
| Haptics | **Core Haptics** | Custom vibration patterns: detent ticks, lock-on pulse, signal-lost flutter. |
| Purchases | **StoreKit 2** | Apple's in-app purchase API. No third party needed. |
| Files online | **Cloudflare R2** | Cheap object storage, no egress fees, account already connected. Audio and the manifest live here. |
| Observation ledger | **Cloudflare Worker + KV** (Proposed) | A few lines of code that store one timestamp per transmission. Same account as R2. |
| Source | **GitHub** | Version history and backup for the code. |
| Build & ship | **Xcode → TestFlight → App Store** | Xcode is the one Mac app you write and build in; TestFlight is the beta channel; App Store is launch. |

What this costs: Apple Developer Program $99/year. Cloudflare's free tier covers the Worker and KV at any audience size you'll see in year one. Your Mac needs a recent macOS for the current Xcode.

**Why Swift won.** Real-time audio. AVAudioEngine lets the app *generate* static with a source node, play a station through a player node, run it through an EQ node that thins it out as you drift off-center, and mix the result, all live. That's the difference between a device and a jukebox.

**What it costs you.** No Android in year one (about half of US phones; Apple users spend more on apps so the revenue gap is narrower than the headcount). Swift skills carry to Mac, iPad, and Logic plugins, but not to the web.

**Kept for the record:** Expo/React Native (one TypeScript codebase for both stores, weaker audio) and Flutter (same, in Dart) were the cross-platform options. The Android port, when it comes, is Kotlin.

---

## 4. Architecture: how it fits together

```
Logic Pro ──bounce──> audio files + manifest.json ──upload──> Cloudflare R2
                                                                   │
                        iPhone app <────── downloads manifest + caches audio
                           │       <────── fetches observation ledger
                           │       ──────> reports a completed whole listen
                           │                        (Cloudflare Worker + KV)
                 ┌─────────┴──────────┐
              dial engine        signal engine
          (angle → frequency)   (clock + ledger → what's live, where,
                                 whole or shattered, how far in;
                                 interference features from the clock)
                           │
                     AVAudioEngine graph
         noise source ─┐
         feature oscillators ─┤
         station player ─ EQ ─┤─ mixer ─┬─ speaker
         (gains driven by signal strength) └─ FFT tap → analyzer / scope
```

**The shared clock.** Each transmission has a loop of fixed length. The app takes the real time (UTC), subtracts a fixed epoch, and takes the remainder against the loop length; that's the playhead. Two people on opposite coasts tuning the same frequency at the same second hear the same moment. Where a transmission *is* on the band, and *whether it's on*, come from the same clock through rules we write. Every phone computes the same band independently. The interference features (Instruments §3) run off the same clock and need no manifest and no server.

**Why there's a server, and why it's tiny.** The Shatter depends on one fact the clock can't know: *has anyone completed a whole listen yet, and when?* That has to live somewhere shared. So: a Worker with two jobs. "Tell me the ledger" (transmission id → first-observed timestamp). "Record an observation" (if none exists yet, write the timestamp). That's all. The phone fetches the ledger on launch and whenever it reconnects. With the 3-day cycle, the ledger holds the *latest* shatter timestamp per transmission plus a shatter count (for drift); the Worker accepts a new observation only once the current cycle has returned the whole. **The server is not needed until the first transmission exists.**

**The shatter itself needs no server.** Once a phone knows the observation timestamp, it seeds the scatter from (transmission id, timestamp) and computes where every fragment lands, when, and how fast it fades. Every phone gets the same scatter from the same one number.

**Offline.** The phone uses the last ledger it saw. Worst case, someone offline hears a whole transmission that has already shattered for everyone else; if they complete a listen, the server already has an earlier timestamp and ignores theirs. Acceptable; arguably in character.

**Background audio.** The app should keep playing with the screen off and when the user switches apps. iOS allows this with a declared "audio" background mode. Do it in Phase 1 so the dial is tested as a radio, not a toy. A whole listen with the screen off still counts.

**Fiction vs. implementation, kept separate:**
- *In the story:* a spectrum analyzer intercepts transmissions from the Asunder when the frequency is right. Observing one has a cost, paid in entropy: the transmission breaks.
- *In the code:* clock + ledger → which transmissions are live, where, and in what state → dial angle → frequency → per-fragment strength from distance to center → gains on the audio graph. A whole listen is a timer that runs while locked and reports to the Worker on completion.
- *Physics hygiene (from Theoretical Concepts):* the cost-of-knowing idea is Landauer and Maxwell's demon, which is thermodynamics and fair game for the Asunder's mechanics. It is *not* quantum collapse, which the notes reserve for the Physicist's vocabulary only. Keep the word "observation"; avoid "collapse" and "superposition" when describing the Shatter.

---

## 5. The receiver: dial and signal engine (first milestone)

### The dial
- **Confirmed (Nov 12):** it looks like a real radio dial and you can see it: a wheel you spin forever. Its size and place on the bench are Open. (Instruments §0)
- ~~A band with a range (a real-looking FM band like 87.5–108.0, or an invented one). **Open.**~~ **Confirmed Nov 19:** a wide spectrum, radio through light (placeholder ends 3 kHz to 1,000 THz), log-spaced so every tenfold gets equal room. The band is a loop (Confirmed Nov 6, Transmission Rules §8): a wheel with no end stop.
- Rotation has **inertia and friction**: a flick spins and slows; a slow drag tracks the finger exactly.
- **Detents**: subtle haptic ticks at regular intervals, with a different pulse when a signal locks.
- The **needle** lags the hand slightly (damping). This is most of what "satisfying" means.
- Precision: a signal has a center frequency and a **bandwidth**. Strength falls off with distance from center (a bell curve). Close is audible-through-static; dead-on is clean. Narrow bandwidth = harder to catch.

### Signal strength → sound
- Full static at strength 0, clean signal at strength 1, mixed between.
- With AVAudioEngine this can be real radio behavior: as strength drops, the signal gets thinner and narrower (EQ) before the noise swallows it.

### The life of a transmission

**Superseded Nov 5 (late).** The current life cycle (whole → shatter → 3 moving days → return, drifted → repeat) is in Transmission Rules §2. The original steps are kept here for the record:

1. ~~Whole.~~ (still true; see Transmission Rules)
2. ~~Observation.~~ (still true; see Transmission Rules)
3. ~~Shattered: fragments get their own where and when, seeded from the observation timestamp.~~ Now: positions come from the day's rule and the seed q (Transmission Rules §3).
4. ~~Fading over weeks; per-transmission half-life.~~ **Superseded.** Fragments last 3 moving days, no fade.
5. ~~Gone; what exists is what people caught.~~ **Superseded.** Nothing is ever gone. The whole returns.

### What counts as a whole listen (Confirmed definition, Proposed mechanics)

Heard through to the end. Because the broadcast loops and you join it in progress, the cleanest implementation is: **held in lock for one full loop length, continuously.** Join at minute three of a six-minute piece, stay locked through the wrap and back to minute three, and you have heard every second of it. This also means the end of a whole listen is wherever you came in, which is a nice found-audio detail: your "ending" is someone else's middle.

A live chase through all of a shattered transmission's primaries also counts (Transmission Rules §7).

Mechanics to settle (Open):
- **Lock tolerance.** How close to center counts as "in lock"? Proposed: strength above a threshold (say 0.9), which translates to a small window around center. Too tight and nobody completes one; too loose and brushing past half-counts.
- **Dropout grace.** A hand slips, the needle wanders, the signal dips for a second. Proposed: a short grace (a second or two) before the timer resets; longer breaks reset it. Reset should be felt (haptic) so the listener knows. Transmission Rules proposes 3 seconds, shared with the chase grace.
- **Length.** The loop length *is* the difficulty. A ninety-second transmission will shatter the day it appears; a twelve-minute one might survive for days. Treat length as a design knob per transmission, not just a musical choice.

### Consequences worth knowing
- **The first observer's experience is unique for that cycle.** No one else hears that transmission whole from the band until it returns. **Open: is that acknowledged (a private mark on their receiver, nothing at all), and does anyone else ever learn it was them?**
- **Screen recordings will circulate.** Someone will record a whole play and post it. That's found footage, and it's fine.
- **Release cadence and length are the two knobs** that set the rhythm of the whole community. The 3-day cycle adds a third: how many transmissions are on the band at once.

### Tracking: where and when (Confirmed principle)

Every transmission and fragment has two coordinates: **where** on the band and **when** in time. Both come from the shared clock (and, after a shatter, the shatter timestamp), so both can be worked out by anyone paying attention. The band is mostly silence and static.

Design rules (Proposed):
- **Patterns must be learnable.** Pure randomness kills tracking. Every rule should be discoverable by someone keeping notes for a week or two.
- **Layer the difficulty.** Some signals have obvious habits. Others take real work. The easy ones teach people that patterns exist.
- **Partial catches count.** Someone who tunes in halfway through gets half. Nothing explains what they missed.
- **The community is part of the receiver.** People will post "94.3, 11pm, Tuesdays." Intended. The Discord (#the-line, #transmissions) is where comparing happens. **Open: whether the app ever acknowledges this layer or stays silent.**

**Pattern menu (background).** The original menu of where/when behaviors. The three shipped rules (Worldline, Light cone, Recurrence) and the weekly rotation replace this as the mechanism; the menu is kept because several entries map onto what shipped or might later:

| Name | Behavior | Status |
| --- | --- | --- |
| **Anchor** | Always on, never moves. | A whole at home, between shatters, is effectively this. Also the Carrier feature (Instruments §3). |
| **Appointment** | Same frequency, fixed times. | The whole's return at the shatter's time-of-day is this. Also the Pulse feature. |
| **Hop** | Position changes on a schedule, by a rule. | Became the three rules. Also the Walker feature. |
| **Tidal** | Varies with time of day or week. | Became Still days and the weekly rotation. |
| **Drift** | Wanders slowly by small steps. | Became the whole's drift per cycle. |
| **Evasive** | Slides away once locked. | Not adopted. Keep as a fourth-rule candidate. |
| **Harmonic** | Hides at a frequency related to another. | Became the Asunder's gate (sum of seeds). Also the Breather pairs on the scope. |

---

## 6. Content pipeline (Proposed)

1. **Make** in Logic Pro. Bounce music and dialogue as separate files.
2. **Mark fragment boundaries**: timestamps where a shatter may cut (phrase ends, section changes). Musical cuts, not arbitrary ones.
3. **Loudness-match** everything to one target so the static-to-signal balance behaves the same across signals. One number for the whole catalog, picked once.
4. **Encode** to AAC (.m4a). Native on iPhone, small files.
5. **Describe** each file in `manifest.json`: id, strand (present / past / Asunder), duration, file URL, home frequency, fragment boundaries. (Fade half-life removed; drift and placement come from the rules.)
6. **Upload** to R2. The app fetches the manifest at launch and caches audio for offline use.
7. New content = new files + a manifest edit. No app release, no store review.

Later: a tiny private tool so step 5 is a form instead of a text file.

The interference features are *not* content in this sense: they're code, not files. Changing them is an app update.

---

## 7. Design system for the app (Proposed)

**Updated Nov 12.** The app's look was settled on Nov 7: real hardware, UAD-style (Color.md). What follows was written before that. The existing "Asunder" Design System artifact is built on a black-and-white ground, which now belongs to the website. Open: whether the app's hardware look is added to that artifact as a second surface or gets its own system. The Signs still matter to the app either way (Instruments §6).

Don't start a new one. The "Asunder" Design System artifact (Oct 22) already has the ground: black primary surface, the Seam, the 26 Signs, the Figures, Lora + Courier Prime, plate / transmission card / evidence block. ~~**Color for the app is now in Color.md** (black-and-white ground, hue from the signal, amber retired in the app), superseding "story surface, amber allowed" for the app only.~~ Superseded Nov 7.

What the system doesn't yet have, because it was built for screens you look at rather than a device you hold:

- **Motion tokens:** dial friction, needle damping, settle time, lock-on snap; analyzer sweep; scope persistence.
- **Haptic tokens:** detent tick, lock pulse, signal-lost flutter, listen-timer reset, **the shatter**, the Still-day texture (if any).
- **Sound tokens:** the static bed (generated; Instruments §2), detent click, the lock-on sound (candidate: the sound ident, the tone that parts and rejoins), **the shatter**.
- **New components:** Dial, Scale/needle, Analyzer, Scope, Signal meter (spectrum or meter? **Open**), Now-receiving card (reuses transmission card), the Signs as signal marks and as Lissajous figures.

~~**Open: what does the receiver look like?**~~ **Resolved Nov 7: a device, drawn as real hardware** (Color.md). For the record, the two directions were a *device* (knobs, glass, a built-in-the-garage object, closer to what The Physicist cobbled together) or *abstract geometry* (Flatland plates, the Sign lattice, a dial that's a drawn figure). The brand kit leaned geometric; the manuscript and the suite-of-instruments decision leaned device.

---

## 8. Monetization and the store (facts as of Nov 2026; verify before launch)

- Apple Developer Program: $99/year.
- Digital content sold inside the app goes through StoreKit. Apple takes 15% for developers under $1M/yr, 30% above.
- Possible models (none chosen): one-time unlock of additional bands; a subscription to the archive; tip-the-station; physical artifacts sold outside the app, which Apple doesn't tax.
- Streaming your own music inside the app is fine; it's yours. DistroKid distribution doesn't restrict this.

---

## 9. Build phases (reordered Nov 6)

| Phase | What exists at the end | Rough time |
| --- | --- | --- |
| **0 — Setup** | Open questions in §2 settled enough to start. Apple Developer account, GitHub, Xcode installed. An empty SwiftUI app running on your iPhone. | 1 week |
| **1 — Dial + static** | A dial with inertia, detents, haptics, needle, generated static with the clock-driven temperature, one carrier feature, playing in the background. No story. **Test: hand it to someone with no explanation; do they play with it for a minute?** | 3–4 weeks |
| **2 — Weather** | The interference features (pulse, walker, breathers) on the shared clock, the three rules and the weekly rotation, Still days. The band is lawful and empty. | 2–3 weeks |
| **3 — Analyzer + scope** | The FFT tap, the analyzer with its knobs (and its history, if it keeps one: Instruments §4), the scope in both modes, Lissajous closure, Signs kept on the receiver. | 3–4 weeks |
| **4 — Receiver shell** | The real-hardware look applied (Color.md), with Evan's artwork. It looks and sounds like Asunder. **This is the launchable toy.** | 2–4 weeks was estimated before the hardware look; the art is likely the longest job in the build (Claude, Nov 12) |
| **5 — Ship v1** | TestFlight beta → App Review → launch. No transmissions. | 2–3 weeks |
| **6 — Signal engine + pipeline** | Station playback, EQ thinning, the lock timer, the manifest, R2. Built while v1 is in the wild. | 2–3 weeks |
| **7 — The first transmission** | Appears on the band as an event. Whole only. | — |
| **8 — The Shatter** | The Worker + ledger, whole-listen detection, fragment placement, primaries and echoes, the 3-day return, the live chase. | 3–4 weeks |
| **9 — Story layer** | Strands, the Notebook, the Asunder's gate and call-outs, the first-observer question. | TBD |
| **Later — Android** | Kotlin port once the design is stable. | — |

Times assume evenings and weekends with AI writing most of the code.

---

## 10. Learning path (how you actually execute this)

Straight talk: you won't hand-type a production app from zero in a few months, and you don't need to. The realistic path is **you direct, AI writes, you read every line and learn to change it**. The goal: by Phase 2 you can open the dial code and change the band range, add a signal, or alter a pattern rule without asking anyone.

Order, each with a reason:
1. **How a program thinks** (2–3 weeks): variables, functions, conditions, loops, arrays, structs. Apple's own *Swift Playgrounds* app (Mac/iPad) teaches this interactively. Paul Hudson's free *100 Days of SwiftUI* is the standard self-taught route and covers steps 1–3 in one sequence.
2. **Types and optionals** (a few days): Swift's way of making "this might be empty" explicit. It'll annoy you, then save you.
3. **SwiftUI's mental model** (1–2 weeks): a view is a function of its state. Change the state, the screen follows.
4. **AVAudioEngine basics** (a weekend, hands-on): build a node graph that plays a file through a filter. You already think this way; it's a modular rack.
5. **Read the dial** (ongoing): one constant at a time. Friction, damping, bandwidth. Feel what each number does.

You have an edge: ten years of signal chains and sequencers. Audio routing is dataflow, an Octatrack pattern is a loop over state, a parameter lock is a conditional.

---

## 11. Open questions, in priority order

1. ~~Device look or abstract geometry?~~ Resolved Nov 7: device, real hardware (Color.md). Left over: which real instruments the three are modeled on, and how much room each gets on the bench (Instruments §9).
2. Whether knob settings persist. (Instruments §9) ~~Which instrument is on screen when the app opens.~~ Resolved Nov 6: the bench, all three.
3. The 26 ratio/phase → Sign mapping. (Instruments §6)
4. ~~Real FM band or invented band?~~ Resolved Nov 19: a wide spectrum, radio through light.
5. Lock tolerance and dropout grace for a whole listen; whether the chase grace is the same number. (Transmission Rules §7, §9) — matters at Phase 6+.
6. **What does the first observer get?** — matters at Phase 8.
7. Day-turn hour. (Transmission Rules §4)
8. Does observing the Asunder cost anything? (Transmission Rules §6)
9. Does the app acknowledge the community layer, or stay silent?
10. Signal meter: spectrum display or simple meter? (Partly answered by the analyzer.)
11. Does the analyzer keep a history, on paper? Waits for Phase 3. (Instruments §4)

Resolved since first draft: moving patterns for wholes (wholes sit at home; only fragments move); which patterns ship first (the three rules); fragment cuts (at marked boundaries); the band is a loop; what's good with ten listeners (the band is alive from the clock alone; see Instruments.md); the look (a device, real hardware; Nov 7).
