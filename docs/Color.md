# Asunder V2 — Color and look

Started Nov 6, 2026. Rewritten in the repo Nov 12, 2026 for Evan's Nov 7 and Nov 12 decisions. How the receiver app looks. Status tags: **Confirmed** (Evan decided), **Proposed** (Claude's recommendation), **Open**.

Sync note: the claude.ai project's own docs may hold more detail on the Nov 7 look decision than this copy. They were not re-exported for this update, which was written from Evan's stated decisions. If the two differ, the newer decision wins (docs/README.md).

## Confirmed (Nov 7, restated Nov 12)

- **The app looks like real hardware.** It is the Physicist's workbench: a hidden, clandestine workstation. The reference is the UAD plug-ins Evan runs on his Apollo Twin and in Console: realistic knobs and buttons, cream faceplates, wood, worn paint, metal and plastic parts, amber VU lights.
- **Why real materials.** They make the bench feel lived in. The look should carry the Physicist's obsession, and it should make the things you touch fun to play with.
- **Warm on purpose.** The warmth of the hardware sits against Asunder's dark, bleak themes. The contrast is intended.
- **Uncluttered.** Real-looking, but not crowded. Evan dislikes how cluttered UAD gets in his sessions.
- **Black-and-white is for the website**, not the app.
- **Amber is back in the app**, as light: the VU lights.
- **Album art for proper music releases** stays Evan's own drawings and photographs, outside this system. (Nov 6, unchanged.)

## How the art gets made

- **Evan's plan (Nov 7):** he builds most of the visuals by hand, AI builds the prototype, and he adds his own embellishments so the app doesn't look AI-generated.
- **Proposed, for builders:** until the look phase (Build Foundation §9, Phase 4), screens are plain placeholders. Keep each control's behavior in code and its picture separate, so Evan's artwork can drop in. Don't generate final art, and don't style ahead of it.
- **Flag (Claude, Nov 12):** this is the most art-heavy direction. Looks like UAD's are typically made from 3D renders and photographs rather than drawn. Nothing before the look phase depends on it.

## Reference instruments

**Confirmed (Nov 20): the analyzer is modeled on the Keysight N9032B**, a modern swept signal analyzer: a big digital screen in a hardware chassis with hard keys and a rotary knob. Evan's words: "a hybrid between a digital and analogue interface." The screen is built in Phase 3 (dark glass, a 10 x 10 grid, an amber glowing trace, a spectrogram in amber); the chassis waits for his art. Amber for the trace and spectrogram is a placeholder in `AsunderRN/src/analyzer/AnalyzerScreen.tsx`.

Offered Nov 12, before the N9032B was chosen: real analog gear Claude showed Evan as starting points for the analyzer. He accepted "a glowing CRT trace" as the working read then.

- **Sequerra Model 1**, a 1970s FM tuner: a scope built in beside the tuning dial. One mode shows nearby stations as spikes.
- **HP 141T**, a lab spectrum analyzer: one glowing trace on a small CRT, with knobs all around it.
- **Kay Sona-Graph**, a sound spectrograph: a stylus burns a picture of the sound onto paper on a drum. The analog way to keep a history.

## Open

1. Which real instruments the dial and the scope are each modeled on. (The analyzer: the Keysight N9032B, Nov 20.)
2. Whether color from the signal (the Nov 6 rules below) has any role in the app, for example in a trace or an indicator lamp.
3. Whether the app's hardware look joins the existing "Asunder" Design System artifact as a second surface, or gets its own system (Build Foundation §7).

## Superseded for the app (the Nov 6 direction)

The Nov 6 direction was a black-and-white app where color came only from the signal. On Nov 7 that direction moved to the website. The rules below were written around tuning and locking in the app, so how they translate to a website is Open, and so is whether any of them return to the app (Open 2). Kept for the record, in their original wording.

Reversed outright:
- ~~**The ground is black and white.** Color is never decoration. It shows up only when a signal is present, and the signal sets it. Off-signal, the app is grayscale.~~ The app is real hardware.
- ~~**Amber is retired in the app.** This supersedes Build Foundation §7's "story surface, amber allowed" for the app only. Amber's status on other surfaces (stream, Discord, manuscript) is unchanged and not decided here.~~ Amber is back in the app, as light.

Were Confirmed Nov 6:
- **Scope:** the app, and possibly album art for ambient Asunder releases.
- **One constraint holds it together:** lightness and intensity follow fixed rules; only hue varies. Any two signals carry the same visual weight.
- **Distance is pastel, clean is deep.** Echoes and off-center signals read as hazy pastel; a clean lock or chase reaches the deep, full version of the same hue.
- **Locking on darkens, and that's intended.** On black, deep colors read dimmer than pastels. Embraced, not corrected: tuning in is the haze clearing into something dense. A clean lock does not get brighter; it gets richer and heavier.
- **Static pieces wear their transmission's color** (e.g., an ambient release cover takes the hue of the transmission it came from).

Were Proposed Nov 6:
- **Hue from the band.** The band is a loop and the color wheel is a loop: hue = home position × 360°. A transmission's color is where it lives. Drift (ε = 1/24) shifts it 15° per cycle, so a piece that has been heard through many times has visibly changed color. Color becomes a tracking clue.
- **Fragments keep their parent's hue**, but echoes are too pale to read hue reliably. Only primaries show it clearly. That's a built-in difficulty layer: you can tell which piece a fragment belongs to only when you're close.
- **Her call-out:** the one moment every hue is on the band at once.
- **Live audio as a small nudge (optional):** the sound's brightness shifts the hue a few degrees around its home, so color breathes the way it does in Lumen, without losing identity.
- **Feel of the lock (follows from the darkening):** pair the visual weight with the haptic lock pulse and the EQ opening up, so the lock still feels like arrival even though the light drops.

Were Open Nov 6:
1. Hue by band position (above) or set by hand per transmission?
2. Whether live audio moves the color at all.
3. Starting values for the pastel and deep levels; test them on a phone, not on a monitor. The deep end must stay legible on black.
- ~~Open: embrace the dimming on black, or make a clean lock glow/spread instead.~~ Resolved Nov 6: embrace it.
