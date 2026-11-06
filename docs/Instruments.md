# Asunder V2 — Instruments

Started Nov 6, 2026. What the app is before the first transmission, and the suite of instruments the Physicist cobbled together to see past the veil. Status tags: **Confirmed** (Evan decided), **Proposed** (Claude's recommendation), **Open**.

Decisions from the Nov 6 session:
1. **Confirmed:** No transmission at launch. The first transmission is an **event**, not a feature. The app has to stand on its own before it, as a toy and a game.
2. **Confirmed:** The dial is not the only instrument. The receiver is a **suite of monitoring equipment** with adjustable parameters. The dial was the first image, not the whole device.
3. **Confirmed:** First two instruments beyond the dial: the **waterfall spectrum analyzer** (already in the story: Transmission 1 has the Physicist and his partner talking about frequencies that act a certain way) and the **oscilloscope**.
4. **Confirmed:** The static is **generated on the phone** in Swift (AVAudioEngine), not bounced from Logic. Audio quality is a priority; generation is not a compromise on that.
5. **Proposed:** The interference on the band runs on the **same rules** as transmissions will (Worldline, Light cone, Recurrence, the week, Still days). The band is lawful before anyone speaks on it.
6. **Proposed:** The oscilloscope's reward is the **26 Signs** from the brand kit, found as closed Lissajous figures.

Decisions from the Nov 6 evening session:
7. **Confirmed:** App structure is **two places**: **the bench** (dial, waterfall and scope together on one page) and **the terminal** on its own page.
8. **Confirmed:** **No login.** The app opens straight to the interface. Supersedes the login screen proposed earlier the same evening.
9. **Confirmed:** The Notebook is a **computer terminal**, and only **the Physicist writes in it**: his entries appear over time. The listener does not type there. Supersedes the notebook / dial-glass / scale-margin location options in Transmission Rules §11.
10. **Confirmed:** **No swiping between instruments.** All three stay on the bench at once.
11. **Confirmed:** **The dial is small**, carried mostly by haptics. Most of the screen goes to the waterfall and the scope.
12. **Confirmed (direction):** **The Asunder can break into the terminal**, by way of the other instruments. Mechanics Open (§0).

---

## 0. App structure

```
THE BENCH  ◄──►  THE TERMINAL
 waterfall        the Physicist's entries, appearing over time
 scope            (and, later, her intrusions)
 dial (small)
```

- **The bench.** All three instruments on one page, so playing with one visibly moves the others (§1). No swiping.
- **Layout (Confirmed direction, Proposed detail).** Waterfall and scope take most of the screen. The dial is a small control under the thumb at the bottom; feel does the work, not size. Proposed: an edge-on thumbwheel (a strip you roll sideways, like the tuning wheel on an old pocket radio) rather than a small round knob, because a thumb rolls a strip more precisely than it turns a tiny circle. The frequency readout and needle sit with it. Open: thumbwheel or knob; waterfall above scope or side by side in landscape.
- **The terminal.** Separate page. Entries by the Physicist appear over time. Somewhere to come back to and relate what you saw on the bench to what's written there.

**Open:**
- **What makes a new entry appear.** On a schedule (dated entries arriving on the real calendar), by what the listener has done (the ladder, Transmission Rules §12), or both.
- **How the Asunder breaks in.** Candidates, none chosen:
  - *She arrives through the waterfall.* Text drawn in the spectrum itself (a real technique: sound shaped so its spectrogram shows words or an image). Readable only at the right resolution, span and speed. Once seen, it shows up in the terminal as if the machine recorded it.
  - *She arrives through the scope.* A Lissajous trace that closes into a figure that isn't one of the 26 Signs. Her mark.
  - *She edits him.* An existing entry by the Physicist changes: a word replaced, a line added that he didn't write, an entry timestamped at an impossible time.
  - *Her call-out spills over.* When she calls across the whole band (Transmission Rules §6), the terminal records it too, as garbled or unformatted text.
- **When she can first break in.** Story logic says not before the first transmission: she is put on the line by the first entropy. Before then the terminal is his alone.

---

## 1. One signal, many windows (Proposed principle)

Every instrument looks at the *same* band from a different side. The dial hears it. The waterfall sees it over time. The scope sees its shape. Nothing on any instrument exists that isn't on the band. That is the difference between a device and a menu of minigames: turn the dial and the waterfall's cursor moves; find a feature on the waterfall and the dial can go there.

Settings on one instrument are allowed to change what the others show (a filter on the dial narrows what the waterfall draws), because that's how real equipment behaves and it's the kind of putzing the app is for.

---

## 2. The static (Proposed)

The noise bed is the floor everything sits on. It should never loop or repeat, which is why it's generated rather than played.

- **Source:** an AVAudioEngine source node generating noise at full sample rate. Three colors mixed: white (hiss), pink (room), brown (rumble). The mix is the **noise temperature**.
- **Temperature follows the clock.** Warm on moving days, cooler and quieter on Still days. The day turn is audible if you're listening and visible on the waterfall as a shift in the floor.
- **Off-center tuning thins it** through the same EQ path a signal uses, so static and signal are one chain, not two.
- **Later:** blindness B raises the floor. At launch there is no B; the floor is just weather you learn to read.

---

## 3. Interference features: the weather (Proposed)

The "frequencies that act a certain way." These are structures in the noise, not voices. Four kinds at launch, three to five instances in total. Each has a position on the band, a per-feature seed, and a behavior.

| Feature | What it is | How it behaves | Which law it teaches |
| --- | --- | --- | --- |
| **Carrier** | A faint, steady line. Always there. | Never moves. A kink at every day turn. | Anchor. The band has a home. |
| **Pulse** | A tone that appears for a few seconds. | Same frequency, same second of the day, every moving day. Silent on Still days. | "When matters." (Rung 2.) |
| **Walker** | A tone that is somewhere new each day. | Steps across the band by the day's rule (§4 of Transmission Rules) from its own seed. Holds on Still days. | A shape: a walk, a flinging, a ritual. (Rung 3.) |
| **Breather** | A line whose brightness swells and fades. | Period fixed per feature; phase from the clock. Two breathers at a ratio are the scope's first target (§6). | Period. Two things in time with each other. |

Rules carried from Transmission Rules without change: the week and its three-day advance; Still days hold everything; positions wrap because the band is a loop.

**Why run the real rules before launch.** A listener who has watched the waterfall for a month knows the band's habits the night the first transmission arrives, and sees at once that the new line *doesn't behave like interference*. The regulars recognize a stranger. That's what makes the first transmission an event. The terminal can carry the hints for these pages from day one; nothing on the band confirms a rule until there's a voice to confirm it with.

---

## 4. The waterfall (Proposed)

The band as a scrolling image: frequency across, time down, brightness is energy. The cursor is the dial's position. Takes the largest share of the bench.

**Knobs:**
- **Resolution.** One slider, with a real trade-off underneath it (the Gabor limit, signal processing, not quantum): sharpen frequency and time blurs; sharpen time and frequency blurs. You cannot see both clean. A pulse's exact second and its exact frequency can't both be read at one setting. This is the Physicist's condition as a slider and it's honest math.
- **Span.** Pinch to zoom the frequency range. Zoomed in, the band stops being a loop on screen and becomes a window; zoomed out, the ends meet.
- **Speed.** How fast time scrolls. Slow enough and a Walker's daily step reads as a staircase over a week.
- **Floor.** A threshold that hides everything below it. Set it high and only the carrier remains; set it low and the noise texture shows.

**Color:** per Color.md. Hue from band position; grayscale when there's nothing there. Features are the first colored things anyone sees.

**Capture:** a screenshot of the waterfall with its settings is the found-footage unit of this layer. People will post them.

---

## 5. The oscilloscope (Proposed)

Two modes.

**Time mode.** The waveform at the dial's position. Knobs: timebase (how much time across the screen), trigger level (where the trace locks), gain. Mostly a toy; it's what noise *looks like*, and a pulse arriving is unmistakable on it.

**Lissajous mode.** Two cursors on the band, the scope plots one against the other. If the two frequencies are in a simple ratio (2:3, 3:4, 1:2) the trace closes into a clean figure. Most pairs draw a smear. Knobs: the two cursors, phase, persistence (how long the trace lingers).

The closed figure is the loop, ∮, drawn by the signal itself. It belongs in this story because of that.

---

## 6. The Signs (Proposed)

The 26 Signs from the brand kit are the scope's collection. A closed Lissajous figure *is* a Sign: each Sign corresponds to a small-integer ratio and phase. Finding a pair of band features that closes shows the Sign and keeps it.

- Breathers are the launch targets: two breathers whose periods sit at a ratio. Find both on the waterfall, put the cursors on them, watch the trace close.
- Signs are kept privately on the receiver. No notice, no badge, no count on screen. You know what you have. (Open: whether kept Signs show up in the terminal.)
- Later: each transmission has a Sign (its ident). The scope on a transmission's home draws it.

**To settle:** which 26 ratio-and-phase pairs map to the 26 Signs, and whether the Sign's drawn form in the brand kit is the figure itself or an abstraction of it. Needs the brand kit open and a session of its own.

---

## 7. The first transmission as an event (Confirmed shape, Proposed mechanics)

- The band runs lawful and empty for its first stretch of life.
- The first transmission appears as a whole at a home, like any whole (Transmission Rules §2). On the waterfall it's a line that doesn't behave like any feature: wider, colored deep when locked, and it *speaks*.
- No announcement in the app. The announcement is the band. (Open: whether the terminal reacts.)
- The Shatter, the ledger, the server: none of it needs to exist until this moment. Ship the suite first; the Worker arrives with the first transmission.

---

## 8. Fiction vs. implementation, kept separate

- *In the story:* the Physicist built a bench of borrowed equipment to see into the Asunder. Certain frequencies act a certain way; those fluctuations are his evidence that there's something on the other side. He watched them for a long time before anything spoke. His terminal is where he wrote down what he saw. Later, something on the other side starts writing back.
- *In the code:* a noise generator shaped by the clock; a small set of feature objects (position, seed, behavior) computed from the same clock and rules as fragments; an FFT over the mixed output drawn as a waterfall; two oscillators sampled against each other for the scope. No server. Everything identical on every phone. The terminal is a text view fed by entries that unlock by date or by what the listener has done; her intrusions are entries of a different kind, triggered by bench events.
- *Physics hygiene:* the resolution trade-off is Gabor/Fourier, real and fair game. Lissajous closure at rational ratios is real. Spectrogram text is a real audio technique. None of it is quantum. "Seeing past the veil" is the story's reading of a spectrum analyzer, not a claim about what one does.

---

## 9. Open questions

1. How the Asunder breaks into the terminal, and from when (§0).
2. What makes a new terminal entry appear: calendar, the ladder, or both (§0).
3. Dial form: thumbwheel or small knob; bench orientation (§0).
4. Whether running the real placement rules on interference before launch gives the band's grammar away too early. (Claude's read: no, because nothing confirms a rule until a voice obeys it.)
5. Whether the scope's reward is the Signs, or something else, something only the Physicist would name.
6. The 26 ratio/phase → Sign mapping (§6).
7. Launch feature count and which rules they use.
8. Whether instrument settings persist between sessions (a real device remembers where you left the knobs).
9. ~~Which instrument is on screen first when the app opens.~~ Resolved Nov 6: the bench, all three together.
10. ~~What the login is.~~ Resolved Nov 6: no login.
11. ~~Who writes in the terminal.~~ Resolved Nov 6: the Physicist only; the Asunder intrudes.
