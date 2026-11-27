# Changelog

A plain-language record of what changed in the app and why, newest first.
It covers the `dev` branch, where new work lands. (`main` is the last good version.)

**How this file stays up to date:** a scheduled Claude task runs every evening (about 9:45 PM Eastern).
It looks at what reached `dev` since the last run, whether through a pull request (PR) or a direct commit,
writes a line or two for each change here, refreshes the "What's new" box at the top of the README,
and commits both straight to `dev`. If nothing changed, it does nothing.

*A few words that come up:* a **PR** (pull request) is a proposed change waiting to be accepted.
**Merged** means it was accepted and is now part of the branch. Numbers like **#12** are PR numbers on GitHub.

<!-- changelog:last-checked 2e263f7 2026-11-27T02:50:00Z -->

## 2026-11-26

- **Tuning in to transmissions** (#22). Each transmission now sits at one fixed frequency on the band, the same on every phone. Far off, the analyzer shows a faint bump; a notch or two away, the voice's shape starts to form and the static thins; right on it, a new LOCK lamp lights and after a moment Bess prints the transmission. A small zoomed-in trace in the analyzer's corner shows the area around the dial up close, and Bess prints a bare "SIGNAL" slip when something new comes on the band. Frequencies and voices are placeholders. Why: finding transmissions is a skill, and this gives the analyzer its purpose. (This replaces #19, which waited on the field log.)
- **The scope gets a mode switch and knobs** (#23). A WAVEFORM · XY · PICTURE switch, plus eight controls shown as keys: tap one, then turn the one big knob, like the analyzer. They stretch and squeeze the wave, move it, and change how bright and sharp the beam is. Why: Evan picked keys plus one big knob over a row of small knobs, which was too tight. Placeholder look.
- **The scope's XY mode** (#24, fixed by #25). In XY the beam draws a figure from a stereo sound: the left channel moves it sideways, the right up and down, and it glows brighter where it moves slowly, like a real tube. For now every line carries one test figure, a slowly turning figure-eight. #25 was a one-line fix so the app builds again after #22 and #24 landed together. Why: step 4 of the scope plan, for Evan's vector art later.
- **Set aside, not merged:** the field log (#18, kept on its own branch for later), the first try at tuning in (#19, replaced by #22) and transmission downloads (#17) were closed without merging. Why: Evan put the field log on hold; no reason was written down for #17.

## 2026-11-25

- **The oscilloscope: a TV-style screen on the bench** (#16). A small screen under the analyzer shows the picture on whichever phone line is patched into its jack: a photo, a looping clip, or a line drawing traced by one glowing green beam. Off the signal it is all snow; tune closer and the picture settles. A switch can swap the tube for crisp, flat pixels for Asunder (empty for now). Why: the scope is the next instrument, and it shows the scene feeds. Placeholder pictures only.
- **The scope listens to a phone line** (#20). Behind the scenes, the scope gets the sound on whichever line is patched into its jack. Nothing patched in, or the tape stopped, gives a flat line. Why: step 1 of the scope plan, the signal it draws.
- **The scope draws the voice as a wave** (#21). A glowing green line on a grid shows the sound on the patched line. A "trigger" (the point where each sweep starts) keeps a repeating wave standing still. Off the signal it is fuzz; tuned in, a voice-shaped wave comes through. Why: step 2 of the scope plan, seeing the voices.

## 2026-11-23

- **The live print-out** (#15). While a transmission plays, the printer types each line at the moment it is spoken, stamped with its time. A small mark shows the line being heard. Tap a printed line and the transmission jumps back to it, and the analyzer jumps with it. Why: Evan wants the paper to keep step with the voices. There is no sound yet and the words are placeholders; a test button on the desk plays a 16 second stand-in.
- **A cord board you drag** (#14). The switchboard is now an operator's cord board. Three cords (analyzer, scope, ear) rest in a shelf at the bottom. Drag a plug up to a jack and it springs in; let go in open space and it springs back. Each phone line has two holes, so two instruments can share a line. The printer moved to sit beside the board. Why: Evan chose the 1940s cord board as the desk's final look. The shapes are still plain placeholders, and the feel has not been tried on a real phone yet.
- **The analyzer can listen to a phone line** (#13). A new INPUT key switches the analyzer between BAND (what it always showed) and LINE (the sound on whichever line is patched into it on the switchboard). Why: so voices can be seen as their own shapes on screen. The two voices are computed stand-ins until real recordings exist.
- **The paper fades every time the app closes** (#12). Each print-out gets a little fainter with every close, and after 33 closes it is gone, unless Bess prints a fresh copy when you find that transmission on the band again. Why: Evan's rule for the printer. It adds one small library for saving a file on the phone, so the phone app needs a rebuild.
- **New `dev` branch.** From now on new work goes to `dev`, and `main` stays as the last good version until Evan says to bring `dev` over. Why: so experiments never break the version that works.
- **The desk: a second screen** (#11). The switchboard sits on top and the printer's read-outs underneath, with a BENCH · DESK switch to flip between the bench and the desk. You can patch cables and mark print-outs as read. Everything on it is a placeholder look. Why: Evan decided the switchboard and the printer share a screen, since both are visual story pieces.
- **The spectrum analyzer is in the main app** (#10). The second instrument on the bench, modeled on a real Keysight analyzer: a live trace and a scrolling history under it, with keys and a knob. Why: it is the next instrument in the build plan.
- **Fix: the iPhone build.** A security setting in Xcode (Apple's app-building tool) was blocking one of the build steps. It is now switched off automatically. Why: the app would not build on the phone without it.
- **Fix: no vibration on iPhone.** The part that drives the phone's vibration was started too early, before the sound was set up, so it ran silently. It now starts after the sound does. Why: you should feel the dial's ticks.

## 2026-11-20

- **First version of the spectrum analyzer** (#9). Added the analyzer screen above the dial. (#10 on Nov 23 finished it off.)
- **The React Native app becomes the main app** (#7). React Native is a way to write one app that runs on iPhone, Android and the web. The older Swift (iPhone-only) app is kept untouched on the `swift` branch for comparison. Why: one set of code instead of one per phone.
- **Less work for the phone's sound engine** (#8). The code that makes the radio's sound was tidied so it uses less of the phone's processor. Why: so the sound doesn't stutter and the battery lasts longer.
- **The wide band and the weather** (#4, #5). The radio's sound, the Carrier, the pulse when you lock onto a signal, sound that keeps playing in the background, and a dial that runs from radio to light. Why: the receiver's core feel.
- **Quieter build logs** (#6). A helper that trims long, noisy output when installing or testing, so Claude can work faster. No change to the app itself.

## 2026-11-17 to 2026-11-18

- **The foundation** (#1, #3). The project set up, then the band, the shared clock (every phone agrees on the time in the story), the weekly rule, and the dial. Why: everything else is built on these.
