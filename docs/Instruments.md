# Asunder V2 — Instruments

Started Nov 6, 2026. What the app is before the first transmission, and the suite of instruments the Physicist cobbled together to see past the veil. Status tags: **Confirmed** (Evan decided), **Proposed** (Claude's recommendation), **Open**.

Updated in the repo Nov 12, 2026: the look, the dial and the analyzer (decisions 13–17). Where an older entry says "waterfall", read "the analyzer". Updated Nov 19, 2026: how the static and the Carrier sound (decisions 18–20), and the wide band (decision 21).

Decisions from the Nov 6 session:
1. **Confirmed:** No transmission at launch. The first transmission is an **event**, not a feature. The app has to stand on its own before it, as a toy and a game.
2. **Confirmed:** The dial is not the only instrument. The receiver is a **suite of monitoring equipment** with adjustable parameters. The dial was the first image, not the whole device.
3. **Confirmed:** First two instruments beyond the dial: the **waterfall spectrum analyzer** (already in the story: Transmission 1 has the Physicist and his partner talking about frequencies that act a certain way) and the **oscilloscope**. *The waterfall as a display was superseded Nov 12 (16); the two instruments stand.*
4. **Confirmed:** The static is **generated on the phone** in Swift (AVAudioEngine), not bounced from Logic. Audio quality is a priority; generation is not a compromise on that.
5. **Proposed:** The interference on the band runs on the **same rules** as transmissions will (Worldline, Light cone, Recurrence, the week, Still days). The band is lawful before anyone speaks on it.
6. **Proposed:** The oscilloscope's reward is the **26 Signs** from the brand kit, found as closed Lissajous figures.

Decisions from the Nov 6 evening session:
7. **Confirmed:** App structure is **two places**: **the bench** (dial, waterfall and scope together on one page) and **the terminal** on its own page.
8. **Confirmed:** **No login.** The app opens straight to the interface. Supersedes the login screen proposed earlier the same evening.
9. **Confirmed:** The Notebook is a **computer terminal**, and only **the Physicist writes in it**: his entries appear over time. The listener does not type there. Supersedes the notebook / dial-glass / scale-margin location options in Transmission Rules §11.
10. **Confirmed:** **No swiping between instruments.** All three stay on the bench at once.
11. ~~**Confirmed:** **The dial is small**, carried mostly by haptics. Most of the screen goes to the waterfall and the scope.~~ **Superseded Nov 12** (15). Haptics stay. How much room each instrument gets is Open (§0).
12. **Confirmed (direction):** **The Asunder can break into the terminal**, by way of the other instruments. Mechanics Open (§0).

Decisions from Nov 7 and Nov 12. Newest wins: these override anything older in this file.
13. **Confirmed (Nov 7, restated Nov 12):** The bench is drawn as **real hardware**: the Physicist's workbench, in the look of the UAD plug-ins. Black-and-white is for the website. (Color.md)
14. **Confirmed (Nov 12):** The app hosts all of the Asunder story media, packaged as the Physicist's workbench, with three things to touch: the dial, the spectrum analyzer and the oscilloscope.
15. **Confirmed (Nov 12):** **The dial is a real-looking radio dial you can see and spin forever.** A wheel with no end stop is the preferred form. It loops back on itself the way the experience of time does in the Asunder: circular, a snake eating its own tail. You tune through channels and pick out frequencies from or within the Asunder, and it is where the first pieces of dialogue are found, by accident or on purpose. Supersedes 11.
16. **Confirmed (Nov 12):** **The spectrum analyzer is a real-world analog instrument**, in keeping with the dial. Working read Evan accepted: a glowing CRT trace. Whether it also keeps a history on paper waits until it is built (§4). Supersedes the waterfall as the display.
17. **Evan's current read, not settled (Nov 12):** the oscilloscope is another dimension of what the analyzer is showing, and could be another visual sign that you have landed on a dialogue frequency (§5).

Decisions from Nov 19 (Phase 1 sound). Newest wins.
18. **Confirmed (Nov 19):** **Noise temperature reads as physics**, not studio talk. Hot = more energy = brighter: moving days hiss more and sound restless. Cold = Still days: the hiss drains out and leaves a lower, darker, quieter rumble. (§2)
19. **Confirmed (Nov 19):** **The Carrier is heard as a zero-beat whistle**, the way a shortwave set sounds: off to the side a whistle, its pitch sliding down as you tune toward center, settling to a low hum dead on. Strength still follows the bell curve. Refines "a faint, steady line" (§3) for the ear; on the analyzer it is still one steady line.
20. **Confirmed (Nov 19):** **The Carrier's day-turn kink is a dropout.** At every day turn it cuts out for a second or two, then comes back, on every phone at the same moment. Length is Proposed (1.5 s). (§3)
21. **Confirmed (Nov 19):** **The band is a wide spectrum, from radio up through infrared and visible light**, the bench Evan envisions for the Physicist and Hannah. Numbers are log-spaced, so every tenfold gets equal room, the way wideband analyzers draw it. One wheel with many more notches, not a band switch. The top stops at light: Evan chose not to stretch it to the string (Planck) scale, "it would already be too much to go that far." Exact ends are placeholders (3 kHz to 1,000 THz).
   - *Physics hygiene (Claude, Nov 19):* strings vibrate around 10⁴³ Hz, far past anything a bench can receive. The band is what the Physicist's equipment can hear, not what the Asunder is made of; strings stay his theory of the place (Theoretical Concepts). **Proposed:** the vibration idea lives on the bench in ratios, the simple ratios that close a figure on the scope and set the Breathers' rhythms (§5, §6), not in the band's range.

---

## 0. App structure

```
THE BENCH  ◄──►  THE TERMINAL
 analyzer         the Physicist's entries, appearing over time
 scope            (and, later, her intrusions)
 dial
```

- **The bench.** All three instruments on one page, so playing with one visibly moves the others (§1). No swiping. Drawn as real hardware (13).
- **Layout (Open since Nov 12).** All three stay on the bench at once (Confirmed). How much room each gets is Open now that the dial is a visible, real-looking control (15): three real-looking instruments on one phone screen is tight, and Evan wants it uncluttered. ~~Waterfall and scope take most of the screen. The dial is a small control under the thumb at the bottom; feel does the work, not size.~~ Superseded Nov 12.
- **Dial form.** A wheel with no end stop is preferred (15). Proposed Nov 6: an edge-on thumbwheel, a strip you roll sideways like the tuning wheel on an old pocket radio, because a thumb rolls a strip more precisely than it turns a small circle. The frequency readout and needle sit with it. Open: edge-on wheel, face-on wheel, or knob; analyzer above scope, or side by side in landscape.
- **The terminal.** Separate page. Entries by the Physicist appear over time. Somewhere to come back to and relate what you saw on the bench to what's written there.

**Open:**
- **What makes a new entry appear.** On a schedule (dated entries arriving on the real calendar), by what the listener has done (the ladder, Transmission Rules §12), or both.
- **How the Asunder breaks in.** Candidates, none chosen:
  - *She arrives through the analyzer.* Text drawn in the spectrum itself (a real technique: sound shaped so its spectrogram shows words or an image). Readable only at the right resolution, span and speed. Once seen, it shows up in the terminal as if the machine recorded it. *Needs a display that keeps a history, so it depends on §4's paper question.*
  - *She arrives through the scope.* A Lissajous trace that closes into a figure that isn't one of the 26 Signs. Her mark.
  - *She edits him.* An existing entry by the Physicist changes: a word replaced, a line added that he didn't write, an entry timestamped at an impossible time.
  - *Her call-out spills over.* When she calls across the whole band (Transmission Rules §6), the terminal records it too, as garbled or unformatted text.
- **When she can first break in.** Story logic says not before the first transmission: she is put on the line by the first entropy. Before then the terminal is his alone.

---

## 1. One signal, many windows (Proposed principle)

Every instrument looks at the *same* band from a different side. The dial hears it. The analyzer sees where its energy sits across the band (and how that moves over time, if it keeps a history: §4). The scope sees its shape. Nothing on any instrument exists that isn't on the band. That is the difference between a device and a menu of minigames: turn the dial and the analyzer's cursor moves; find a feature on the analyzer and the dial can go there.

Evan's own framing (Nov 12) points the same way: the scope is "another dimension" of what the analyzer is showing.

Settings on one instrument are allowed to change what the others show (a filter on the dial narrows what the analyzer draws), because that's how real equipment behaves and it's the kind of putzing the app is for.

---

## 2. The static (Proposed)

The noise bed is the floor everything sits on. It should never loop or repeat, which is why it's generated rather than played.

- **Source:** an AVAudioEngine source node generating noise at full sample rate. Three colors mixed: white (hiss), pink (room), brown (rumble). The mix is the **noise temperature**.
- **Temperature follows the clock.** Warm on moving days, cooler and quieter on Still days. The day turn is audible if you're listening and visible on the analyzer as a shift in the floor.
- **Which way is warm (Confirmed Nov 19, decision 18):** physics. Hot noise is brighter: moving days lean white, restless hiss. Still days are cold: the hiss drains out and a low, quiet brown rumble is left. At the turn the static glides from one to the other over about half a minute (Proposed).
- **Off-center tuning thins it** through the same EQ path a signal uses, so static and signal are one chain, not two.
- **Later:** blindness B raises the floor. At launch there is no B; the floor is just weather you learn to read.

---

## 3. Interference features: the weather (Proposed)

The "frequencies that act a certain way." These are structures in the noise, not voices. Four kinds at launch, three to five instances in total. Each has a position on the band, a per-feature seed, and a behavior.

| Feature | What it is | How it behaves | Which law it teaches |
| --- | --- | --- | --- |
| **Carrier** | A faint, steady line. Always there. Heard as a zero-beat whistle that slides down to a hum on center (Nov 19). | Never moves. A kink at every day turn: a dropout of a second or two (Nov 19). | Anchor. The band has a home. |
| **Pulse** | A tone that appears for a few seconds. | Same frequency, same second of the day, every moving day. Silent on Still days. | "When matters." (Rung 2.) |
| **Walker** | A tone that is somewhere new each day. | Steps across the band by the day's rule (§4 of Transmission Rules) from its own seed. Holds on Still days. | A shape: a walk, a flinging, a ritual. (Rung 3.) |
| **Breather** | A line whose brightness swells and fades. | Period fixed per feature; phase from the clock. Two breathers at a ratio are the scope's first target (§6). | Period. Two things in time with each other. |

Rules carried from Transmission Rules without change: the week and its three-day advance; Still days hold everything; positions wrap because the band is a loop.

**On hold (Evan, Nov 19):** no new features go on the band yet. Now that the band is a wide spectrum, radio through light (decision 21), Evan wants to develop the logic of *why* things behave the way they do on it before any are placed: what each feature is, why it lives where it does, why it moves. The table above stays as background. Lineup, voices and placement wait for him.

**Why run the real rules before launch.** A listener who has watched the analyzer for a month knows the band's habits the night the first transmission arrives, and sees at once that the new line *doesn't behave like interference*. The regulars recognize a stranger. That's what makes the first transmission an event. The terminal can carry the hints for these pages from day one; nothing on the band confirms a rule until there's a voice to confirm it with.

---

## 4. The analyzer (look Confirmed Nov 12; mechanics Proposed Nov 6)

**Confirmed (Nov 12):** a real-world analog spectrum analyzer, drawn as real hardware, in keeping with the dial. Working read Evan accepted: a glowing CRT trace. On such a trace frequency runs across and energy goes up, and the dial's position would be marked on it the way the cursor was on the waterfall. Reference instruments are in Color.md.

**Open: does it keep a history?** A real analog analyzer draws one live trace and keeps nothing but the glow of the tube. The Nov 6 design below was a *waterfall*, a scrolling picture of the recent past, and four things lean on that history:
- a Walker's daily steps reading as a staircase (Speed, below);
- seeing the day turn after the fact, as a line where the floor shifts (§2);
- the screenshot as the found-footage unit, which shows a stretch of time (Capture, below);
- the Asunder arriving as text drawn in the spectrum (§0).

The analog way to keep a history is paper: a recorder that draws or burns the picture onto a moving strip, as the Kay Sona-Graph did for sound. Options, none chosen: the trace alone, or the trace plus a paper strip. Agreed Nov 12: this waits until Phase 3 is built.

### The Nov 6 waterfall design (Proposed then; superseded as the display Nov 12)

Kept because its knobs and its trade-off carry over to an analog trace.

The band as a scrolling image: frequency across, time down, brightness is energy. The cursor is the dial's position. ~~Takes the largest share of the bench.~~ (Layout is Open, §0.)

**Knobs:**
- **Resolution.** One slider, with a real trade-off underneath it (the Gabor limit, signal processing, not quantum): sharpen frequency and time blurs; sharpen time and frequency blurs. You cannot see both clean. A pulse's exact second and its exact frequency can't both be read at one setting. This is the Physicist's condition as a slider and it's honest math.
- **Span.** Pinch to zoom the frequency range. Zoomed in, the band stops being a loop on screen and becomes a window; zoomed out, the ends meet.
- **Speed.** How fast time scrolls. Slow enough and a Walker's daily step reads as a staircase over a week.
- **Floor.** A threshold that hides everything below it. Set it high and only the carrier remains; set it low and the noise texture shows.

All four have real counterparts on analog analyzers: resolution bandwidth, span, sweep time, and a baseline clipper. On a swept analyzer the resolution trade-off shows up as a narrower filter needing a slower sweep. (Claude, Nov 12.)

**Color:** ~~per Color.md. Hue from band position; grayscale when there's nothing there. Features are the first colored things anyone sees.~~ Superseded Nov 7 with the black-and-white app. Whether signal color has any role in a trace is Open (Color.md).

**Capture:** a screenshot of the analyzer with its settings is the found-footage unit of this layer. People will post them.

---

## 5. The oscilloscope (Proposed)

**Evan's current read (Nov 12, not settled):** the scope is another dimension of what the analyzer is showing, and it could be another visual sign that you have landed on a dialogue frequency. In his words, "this item isn't as clear." The design below is still only Proposed. It fits that read in two places: the scope shows the same signal from another side (§1), and a transmission's Sign appearing on the scope (§6) would be that visual sign.

Drawn as a real analog oscilloscope, like the rest of the bench (Color.md).

Two modes.

**Time mode.** The waveform at the dial's position. Knobs: timebase (how much time across the screen), trigger level (where the trace locks), gain. Mostly a toy; it's what noise *looks like*, and a pulse arriving is unmistakable on it.

**Lissajous mode.** Two cursors on the band, the scope plots one against the other. If the two frequencies are in a simple ratio (2:3, 3:4, 1:2) the trace closes into a clean figure. Most pairs draw a smear. Knobs: the two cursors, phase, persistence (how long the trace lingers).

The closed figure is the loop, ∮, drawn by the signal itself. It belongs in this story because of that.

---

## 6. The Signs (Proposed)

The 26 Signs from the brand kit are the scope's collection. A closed Lissajous figure *is* a Sign: each Sign corresponds to a small-integer ratio and phase. Finding a pair of band features that closes shows the Sign and keeps it.

- Breathers are the launch targets: two breathers whose periods sit at a ratio. Find both on the analyzer, put the cursors on them, watch the trace close.
- Signs are kept privately on the receiver. No notice, no badge, no count on screen. You know what you have. (Open: whether kept Signs show up in the terminal.)
- Later: each transmission has a Sign (its ident). The scope on a transmission's home draws it.

**To settle:** which 26 ratio-and-phase pairs map to the 26 Signs, and whether the Sign's drawn form in the brand kit is the figure itself or an abstraction of it. Needs the brand kit open and a session of its own.

---

## 7. The first transmission as an event (Confirmed shape, Proposed mechanics)

- The band runs lawful and empty for its first stretch of life.
- The first transmission appears as a whole at a home, like any whole (Transmission Rules §2). On the analyzer it's a line that doesn't behave like any feature: wider, and it *speaks*. (~~Colored deep when locked~~: that cue went with the Nov 6 color rules, Color.md.)
- No announcement in the app. The announcement is the band. (Open: whether the terminal reacts.)
- The Shatter, the ledger, the server: none of it needs to exist until this moment. Ship the suite first; the Worker arrives with the first transmission.

---

## 8. Fiction vs. implementation, kept separate

- *In the story:* the Physicist built a bench of borrowed equipment to see into the Asunder. Certain frequencies act a certain way; those fluctuations are his evidence that there's something on the other side. He watched them for a long time before anything spoke. His terminal is where he wrote down what he saw. Later, something on the other side starts writing back. Evan, Nov 12: the spectrum analyzer picks up the audio of the transmissions going out to and coming back from the Asunder, and it is the same analyzer the Physicist and Her use to verify whether the "fractal" of the Asunder was truly a transmission or some broken piece from it.
- *In the code:* a noise generator shaped by the clock; a small set of feature objects (position, seed, behavior) computed from the same clock and rules as fragments; an FFT over the mixed output drawn as the analyzer's trace (and as a history, if §4 keeps one); two oscillators sampled against each other for the scope. No server. Everything identical on every phone. The terminal is a text view fed by entries that unlock by date or by what the listener has done; her intrusions are entries of a different kind, triggered by bench events.
- *Physics hygiene:* the resolution trade-off is Gabor/Fourier, real and fair game. Lissajous closure at rational ratios is real. Spectrogram text is a real audio technique. None of it is quantum. "Seeing past the veil" is the story's reading of a spectrum analyzer, not a claim about what one does.

---

## 9. Open questions

1. How the Asunder breaks into the terminal, and from when (§0).
2. What makes a new terminal entry appear: calendar, the ladder, or both (§0).
3. Dial form: a wheel with no end stop is preferred (Nov 12). Still Open: edge-on wheel, face-on wheel, or knob; bench orientation; how much room each instrument gets (§0).
4. Whether running the real placement rules on interference before launch gives the band's grammar away too early. (Claude's read: no, because nothing confirms a rule until a voice obeys it.)
5. Whether the scope's reward is the Signs, or something else, something only the Physicist would name.
6. The 26 ratio/phase → Sign mapping (§6).
7. Launch feature count and which rules they use.
8. Whether instrument settings persist between sessions (a real device remembers where you left the knobs).
9. ~~Which instrument is on screen first when the app opens.~~ Resolved Nov 6: the bench, all three together.
10. ~~What the login is.~~ Resolved Nov 6: no login.
11. ~~Who writes in the terminal.~~ Resolved Nov 6: the Physicist only; the Asunder intrudes.
12. Does the analyzer keep a history, and is it on paper? Waits for Phase 3 (§4).
13. Whether the two-mode scope design is what Evan wants the scope to do (§5).
14. Which real instruments the dial, the analyzer and the scope are modeled on (Color.md).
