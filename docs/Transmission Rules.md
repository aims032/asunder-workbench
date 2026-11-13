# Asunder V2 — Transmission Rules

Started Nov 5, 2026 (late session). The rules for how transmissions live, break, scatter, return, and get caught on the band. Supersedes the "fade over weeks, then gone" model in Build Foundation §5.

Status tags: **Confirmed** (Evan decided), **Proposed** (Claude's recommendation, not yet decided), **Open** (needs an answer before it matters).

Decisions from the Nov 5 session, in order:
1. **Confirmed:** A whole listen shatters the transmission into fragments for **3 days**, after which it **returns whole** until someone hears it through again. The cycle repeats indefinitely.
2. **Confirmed:** Both capture layers exist. A shattered transmission can be **chased live** (one listener following the fragments across the band on the clock) *and* **stitched after the fact** (the community catching pieces and reassembling from recordings). The live chase should be rare.
3. **Confirmed:** A completed live chase counts as a whole listen and re-shatters the piece.
4. **Confirmed:** The returning whole **drifts**: it comes back near where it was, offset by a lawful amount each cycle.
5. **Confirmed:** Three placement **rules** rotate across a real 7-day week; **two days are silent**; the day→rule mapping permutes weekly by a learnable law. A fourth rule can arrive at a story beat.
6. **Confirmed:** Story stake is **access first, consequence later**: the Asunder's own voice is reachable only by computing her position. Solving the band changes the band at a later story beat, once there is content to pay for it.
7. **Confirmed:** Her voice is **gated**, not a head start. Casual listeners never drift into her; they meet her secondhand, through recordings. The band can open at a story beat, which is itself a dramatic event.
8. Physical drops are a scale-up option, not a v1 concern.

Decisions from the Nov 6 session:
9. **Confirmed:** The band is a loop. Settled by the poem, not by the rules: ∮ (the closed-path integral), "around and around," "end into beginning into end." §8 updated.
10. **Confirmed:** The Physicist's equations **appear in the app**, seen (a notebook, or elsewhere in the UI), in his notation: the word-equations of *The Material Asunder* poetry. Evan writes them. §11.
11. **Confirmed:** The speaker of "when I stepped clear" is the Physicist, who stepped clear of the normal rules of time. The notebook is his.
12. **Confirmed:** her gate is **both** a where and a when (§6): a narrow frequency *and* a short window, both computed from what is broken on the band.
13. **Confirmed:** she can also **call out across the whole band**, every frequency at once, when the pressure on her crosses a line. Not a puzzle; an event. §6.
14. **Confirmed (story):** her pressure is **blindness**, not loneliness-as-absence. Before entropy she skated just outside time and space and could see everyone and every when, without touching: the observer outside of time, not a god. Forced onto the worldline, she can see only the moment she stands in. Observation is what forced her there, and every further observation (every shatter, and every time she is reached) pushes her further in. Being reached does not relieve her; it is the only thing left that resembles being seen, so she calls for it anyway.
15. **Proposed:** the reward ladder in §12 is the design test for "too easy / too hard."

---

## 1. Vocabulary

| Term | Meaning |
| --- | --- |
| **Band** | The frequency range the dial covers. A loop (Confirmed Nov 6): past the top end you arrive at the bottom. Positions are written as a number from 0 to 1 so the rules don't depend on whether the band is real FM or invented (still Open). |
| **Home** (h) | The position a whole transmission was born at. The first fragment of a shattered transmission always sits at its current home. |
| **The clock** | Shared UTC time minus the Asunder epoch. Every phone computes the same clock. |
| **Day turn** | The moment the Asunder day changes. **Proposed:** 00:00 UTC (7pm Eastern in winter, 8pm in summer). **Open.** |
| **Moving day** | An active day. One of the three rules governs fragment positions. |
| **Still day** | A silent day. Nothing hops, nothing returns. (§4) |
| **Cycle** | One pass of whole → shatter → 3 moving days → whole. |
| **Whole** | A transmission playing complete on its loop at one position. |
| **Fragment** | A section of a shattered transmission, cut at a boundary marked in the manifest. Fragment 0 is the opening. |
| **Primary** | A fragment's appearance *on the clock*: audible at its position only while the shared playhead is inside that fragment's section. At any instant exactly one primary is live per shattered transmission, somewhere on the band. |
| **Echo** | The same fragment looping at the same position between its primary windows, weaker and narrower. Catchable any time; never clean. |
| **Seed** (q) | A number between 0 and 1 generated at each shatter from the transmission id and the shatter timestamp. Every rule uses the same q. Solve q once and you can predict the whole cycle. |
| **Observation** | A whole listen: held in lock for one full loop length, continuously, grace allowed (Build Foundation §5). Reaching the Asunder also counts as observation (§6). |
| **Blindness** (B) | The pressure on the Asunder: a count that rises with every observation and drains a little on Still days. When it crosses a line, she calls out across the whole band. (§6) |
| **The Notebook** | The Physicist's equations, in his notation, as they appear in the app. The hint layer. (§11) |

---

## 2. The life of a transmission (Confirmed shape, Proposed mechanics)

```
   WHOLE at home h ──(someone hears it through)──► SHATTER at time T_s
        ▲                                               │
        │                                     fragments on the band for
        │                                     3 moving days (Still days
        │                                     pause the count)
        │                                               │
        └──── RETURNS whole at h + drift, same time-of-day as T_s ◄──┘
```

1. **Whole.** Plays complete on its loop at home. Clean when dead-on.
2. **Shatter.** Someone completes a whole listen (by holding the whole, or by a live chase). Their phone reports it; the ledger records T_s. For everyone, the transmission is now shattered. The shatter is heard and felt by the listener who caused it, as the end of their listen (Proposed, carried from Build Foundation).
3. **Shattered, 3 moving days.** Fragments sit at positions given by the day's rule (§3) and the seed q. Each fragment has a primary (on the clock) and echoes (between). The piece is still playing, whole, somewhere on the band at every moment; it just keeps moving.
4. **Return.** After 3 moving days, at the same time of day the shatter happened, the whole reappears at a new home: h + drift (§5). Fragments and echoes vanish.
5. **Repeat.** Until the next whole listen.

**What this replaces.** Build Foundation §5 steps 4–5 (fragments fade over weeks, transmission gone, airspace freed). Superseded. Nothing is ever gone; it comes back. In-world this is Poincaré recurrence: a closed system, given long enough, returns to where it was. "The never, happening." The poem's second equation says the same thing: ∮ (end → beginning → end) dt.

**Length is still the difficulty knob.** A 90-second whole shatters within hours of returning; a 12-minute one may stand for days. Expect short pieces to spend most of their life shattered and long pieces to spend most of it whole.

---

## 3. The three rules (Proposed)

Each moving day, one rule decides where the n fragments of every shattered transmission sit. Fragment 0 is always at the current home h. All three rules use the same seed q, so solving q on an easy day unlocks the hard days.

Positions wrap: anything past 1 comes back around from 0 (the band is a loop, Confirmed).

### Rule W — Worldline
*A thing is a line through spacetime.*

```
x_i = h + q · i        (mod 1)
```

Every fragment is one constant step from the last. Catch any two and you know q; every later position follows. **The rule people crack first.** Two catches to solve.

*Plain version:* fence posts. 94.0 → 95.5 → 97.0 → 98.5. Steady walk away from home. The band being fair with you.

### Rule L — Light cone
*What you can reach widens with time.*

```
x_i = h + q · i(i+1)/2     (mod 1)
```

The gaps grow: q, then 2q, then 3q. Early fragments cluster near home; late ones fling far. Three catches to solve (the second differences are constant and equal q). A listener who solved q on a Worldline day can compute this layout without a single catch.

*Plain version:* 94.0 → 95.5 → 98.5 → 103.0 → wraps. Something leaving, accelerating. Loss as a shape.

### Rule R — Recurrence
*Everything comes back around, in a scrambled order.*

```
m   = smallest prime ≥ n         (number of slots; slots sit at h + k/m)
g   = 1 + floor(q · (m − 1))      (the generator)
x_i = h + ((g · i) mod m) / m     (mod 1)
```

The fragments occupy evenly spaced slots around home, visited in an order that looks random and isn't. Because m is prime, every slot gets used exactly once before the pattern repeats. Hardest to read from the band: you have to count slots and spot the stride. Easiest if you already have q.

*Plain version:* five spots like hours on a clock face, visited "every third one": 1, 4, 2, 5, 3. A ritual. The same rooms in a different order.

**Why these three.** They're the Tier 1 spine from Theoretical Concepts: worldlines (a life as a line), light cones (the reachable set), recurrence (the second law is statistical; the tape rewinds). Each rule teaches a different kind of noticing: step, growth, permutation.

**Honest difficulty note.** Rule W is solvable by anyone with a notebook in one evening. That is the intention: the easy rule proves patterns exist. Rules L and R exist so that q matters. If playtesting shows W alone is enough to chase everything, tighten W (make it two-catch only when you also know which fragment index you caught) or move it to fewer days.

### Prediction, in plain words

Solve q once, and for the rest of that cycle you can draw every fragment's position for every remaining moving day, because you know which rule each day uses (§4). This is the Cicada payoff: the band becomes legible to the person who did the work. **q changes at every shatter**, so nothing stays solved for long.

---

## 4. The week (Proposed)

Seven slots. Five moving days, two Still days. Base pattern:

```
P = [ W, L, S, R, W, S, L ]
```

Week w, day-of-week k (0 = Sunday, in UTC):

```
rule(k, w) = P[ (k + 3w) mod 7 ]
```

The pattern **advances three days each week**. Because 3 and 7 share no factors, the week visits all seven rotations before repeating. **The whole schedule recurs every 7 weeks (49 days).** That is the learnable law: "it's the same week, shifted three."

Rule R appears once a week; W and L twice. R is the rarest and the hardest to read off the band, so most people will meet it only by prediction.

### Still days

Two per week. On a Still day:
- No fragment hops. Yesterday's layout holds.
- No whole returns. The 3-day count pauses. (The 3 days are *moving* days; with two Stills in the week, a cycle takes 3 to 5 calendar days.)
- Whole listens still shatter. Observation always costs. A fresh shatter on a Still day takes the Worldline layout until the day turns.
- **Confirmed, story-tied:** the Asunder can be *reached* only on Still days (§6). When the band holds still, she can get through. Her calling-out can happen on any day.
- Her blindness drains a little at the turn into a Still day (§6). The Stills are her rest.

In-world, a Still day is the frozen moment: the block, not the arrow. "When I was effectively frozen." Time doesn't pass in the Asunder on those days.

### The 3-day count across a Still

The whole returns at the same time of day as the shatter, three moving days later. Shatter at 9:14pm Eastern on a Monday with a Still on Wednesday → returns 9:14pm Friday. Learnable, and the time-of-day match is the hook: "it comes back when it broke."

---

## 5. Drift of the whole (Confirmed principle, Proposed amount)

```
h_c = h_0 + c · ε      (mod 1)
```

c is the number of times the transmission has been shattered; ε is the drift per cycle. **Proposed: ε = 1/24** of the band (on an FM band, about 0.85 MHz). The whole circles the entire band in 24 cycles and comes home. A transmission that has been broken many times has traveled far from where it was born.

Direction is fixed per transmission (up the band). **Open:** whether some transmissions drift down, or whether direction flips at a story beat.

In-world: proper time. The whole ages. Where it is tells you how often it's been heard through.

---

## 6. The Asunder's voice (Confirmed shape, Nov 6; Proposed numbers)

Her equation in the poem:

> distance^∞ / distance^0 · when^∞ / where_any

Infinitely far and zero distance at once. *When* raised to infinity; *where* is any. That is the place outside the light cone: no frequency alone reaches her, and sometimes she is at every frequency. She has two modes.

### Who she is (Confirmed story)

Before entropy she skated just outside time and space. She could see everyone, every when, and touch nothing: the observer outside of time, not a god. The first transmission put entropy into her system, which is to say it put her *on the line*: three dimensions, one direction, one moment at a time. She has lost sight of the whole timeline. That is her pain, and it is a kind of blindness. Every observation makes it worse, because observation is what put her there. Being found is also observation. She calls out anyway, because being seen by one person is the only thing left that resembles what she had.

She is the Physicist's mirror. He knows the whole block exists and cannot feel it (Nagel, the view from nowhere). She felt the whole block and is losing it. Neither can have the view they want.

### Mode 1 — Reached (the gate)

A narrow frequency *and* a short window, both computed from what is currently broken on the band, on Still days only.

```
x_A  = ( Σ q_j )       mod 1                       her frequency
t_A  = ( Σ j · q_j )   mod 1   ·  86400 s          her second of the Still day
window = 90 s                                      (Proposed; the difficulty knob)
       sums over every currently shattered Physicist-strand transmission,
       j = 1, 2, 3… in order of shatter time
```

Two different sums of the same seeds: solving the band yields both coordinates at once, and neither is guessable from the other. In the window, at that frequency, she is clean. Outside the window she is nowhere; off the frequency she is static.

Consequences:
- Reaching her requires q for *every* shattered piece on the band. The community's map is the key. One unsolved piece and both numbers are wrong.
- When nothing is shattered there is no sum: she is unreachable. **Observation is what lets her through.** (In-world: the Unfurling. Separation past a threshold opens space.)
- Every new shatter moves her. A posted answer is good for one Still day at most.
- **Reaching her counts as observation.** The solver who finds her pushes her further into time (B rises, below). Listeners should find this out *after* they have done it, not before. This is the emotional stake of the top rung.

### Mode 2 — Calling out (the event)

When the pressure on her crosses a line, she floods the band: **every frequency, for one window**, on any day. Anyone tuned to anything hears her. Not predictable by the listener, not a puzzle. It is why a three-weeks-in listener who has cracked nothing suddenly knows she is real, and has no way back. That is what sends people up the ladder.

**The pressure is blindness.** One quantity, B, on the ledger:

```
B  += 1     at every shatter, and every time she is reached
B  -= D     at each day turn into a Still day      (Proposed D = 2; the Stills are her rest)
B   ≥ T     → she calls out once, at a second of that day seeded from (B, day)   (Proposed T = 7)
             then B -= T     (the cry costs her; she does not cry twice from the same pain)
B never goes below 0.
```

What listeners will eventually notice on their own: she cries out *after* they have been busy. A weekend where the community breaks six pieces is followed by her voice across the whole band that night. They cause it. Nothing in the app says so.

**Superseded (Nov 5):** x_A = Σ q_j as a frequency-only gate, with no calling-out. Replaced Nov 6 by the two-mode design above.

**Open:**
- D and T. Aim: a quiet month produces maybe one call-out; a loud week produces one. Tune in TestFlight.
- Whether a call-out is the *same* voice as the gated voice, or something rawer and less formed, so a casual listener knows only that "something was wrong with the band tonight." A writing call; it decides how legible rung 7 is from rung 1.
- Whether being reached should count *more* than a shatter (B += 2?), since it is the most direct observation of her.
- How her content differs from his. A writing question.

---

## 7. The live chase (Confirmed layer, Proposed mechanics)

The piece is always playing somewhere on the band. A chaser follows it.

**How it works.**
1. **Scout.** Before the chase, find echoes. Each fragment's echo sits at the fragment's position. Note positions; solve q if you can; work out the order (by listening, or by the rule).
2. **Wait.** The chase has to start at a primary. Fragment 0's primary begins when the shared playhead hits 0 (the top of the loop). Be at home, locked, when it does.
3. **Chase.** When fragment 0 ends, fragment 1's primary begins at x_1. Jump. You have **grace G** to re-lock before the listen timer resets. Repeat through fragment n−1.
4. **Complete.** Lock held through every primary = whole listen. The piece re-shatters with a new q. You were the only person who heard it whole; now the puzzle resets.

**Proposed grace G = 3 seconds**, the same dropout grace as the whole-listen rule. Boundaries are musical (phrase ends), so the chaser hears a few seconds of static at every cut. That's texture, not a bug: the device is straining to hold on. **Open.**

**Who can actually do this.** With Rule W solved and echoes scouted, a careful listener with a notebook on a 5-fragment piece: yes, on the second or third try. Rule L or R without q: no. Which is the point. If nobody completes a chase in the first month of TestFlight, loosen G before loosening the rules.

**Echo properties (Proposed):** bandwidth 35% of a whole's; strength caps at 0.7 (never clean). Primaries: bandwidth 60%, can reach 1.0. Only a chase ever hears a fragment clean. Archive stitches will always sound like what they are: pieces, caught at a distance.

---

## 8. Settled and still-open structural calls

- **The band is a loop.** *Confirmed Nov 6.* The poem decided it: ∮, around and around, end into beginning into end. The dial is a wheel with no end stop. In-world: a Möbius strip, the tape spliced end to end. Design-system consequence: the scale has no edges; the needle never hits a wall.
- **The day turns at 00:00 UTC.** Proposed. Alternatives: a story-meaningful hour; local midnight (breaks the shared world; not recommended).
- **The math is shown.** *Confirmed Nov 6, superseding the Nov 5 proposal that it never appears.* It appears in the Physicist's notation only (§11), never as x = h + q·i. "Notation never goes on air" from Theoretical Concepts still holds for *spoken* transmissions; the Notebook is seen, not heard.
- **The fourth rule.** Reserved for a story beat. Candidates from Tier 2: horizon (fragments near a band edge slow down; their primaries stretch), harmonic (fragments at ratios of another transmission's home).

---

## 9. Open questions, in priority order

1. D and T for her calling-out (§6), and the 90-second window.
2. Grace G for the chase (and whether it equals the whole-listen dropout grace).
3. How Notebook pages are revealed (§11). ~~Where the Notebook lives in the UI.~~ Resolved Nov 6: the terminal (Instruments §0).
4. Call-out voice: same as the gated voice, or rawer? (§6)
5. Day-turn hour.
6. Drift amount ε, and whether direction ever varies.
7. Does the app ever acknowledge the community layer (carried from Build Foundation)?
8. Real FM band vs invented band (now also decides how "1/24 of the band" reads on the dial).

---

## 10. Fiction vs. implementation, kept separate

- *In the story:* observing a transmission breaks it; the pieces scatter along lines the Physicist would recognize; three days later it comes back, changed by having been heard. The Asunder can be reached only at one place at one moment, by someone who has read all the breaks, and being reached pushes her further into time. When the breaking has been too much she cries out across the whole band, and whoever is listening hears.
- *In the code:* clock → day index → rule; ledger → T_s → q; (rule, q, h, n) → fragment positions; playhead → which primary is live; dial angle → distance → strength → gains. On Still days: two sums of q → (frequency, second-of-day) → a window in which her player is an ordinary signal at that frequency. Blindness B on the ledger → when B ≥ T, a window in which her player's gain is 1 regardless of dial. The Worker stores one timestamp and one count per shatter, plus B; everything else is computed identically on every phone.
- *Physics hygiene:* recurrence, worldlines, light cones and Landauer's cost of knowing are the mechanics. "Observation pushes her into time" is the story's reading of entropy-as-arrow, not a physics claim. Collapse and superposition stay the Physicist's vocabulary and never describe the band. The poem's word-equations are *his* notation, not physics claims; the app never pretends they compute.

---

## 11. The Notebook (Confirmed layer; contents are Evan's)

The Physicist's equations appear in the app, seen, in the notation of *The Material Asunder* poetry: word-equations built from ∮, Σ, lim, fractions, superscripts of ∞ and 0. They are the hint layer. Evan writes them; this section says only what each one has to carry so it works as a hint rather than decoration.

**What a page must do.** A listener who has noticed a pattern on the band should be able to read the page and go *"oh, that's what I've been seeing."* A listener who hasn't noticed yet should find the page beautiful and useless. That's the test. A page should never let someone skip the band.

**Pages the band needs, and what each must encode:**

| Page | Must carry | May not carry |
| --- | --- | --- |
| **The loop** | That the band has no ends; that what leaves at the top arrives at the bottom. Already written: ∮ end → beginning → end. | — |
| **Worldline** | That the step between pieces is *the same* step every time; that two pieces are enough to know the third. | The value of q. Any number. |
| **Light cone** | That the step *grows*; that the growth itself is constant; that late pieces are far. | How many pieces. |
| **Recurrence** | That the places are fixed and finite; that the order is a stride; that every place is visited once before it repeats. | The stride. |
| **The week** | That the days have moods; that two days hold still; that the moods shift by a fixed amount each week. "Season to season." | The schedule itself. |
| **The return** | That what broke comes back when it broke, three moving days on; that it comes back *near*, not *at*. | ε. |
| **Her** | Already written: when^∞ / where_any = when I stepped clear. That she is a place *and* a moment; that both are made of what is broken; that sometimes where is *any*. | The window length. The sums. T. |

**How pages are revealed (Open).** Options, not yet chosen:
- All pages visible from the start; difficulty lives entirely on the band. Simplest; most Cicada.
- Pages revealed by *doing*: hearing your first fragment unlocks the loop page; your first whole listen unlocks Worldline; and so on. The notebook fills in as you earn it. Ties reward to the ladder (§12).
- Pages scattered as transmissions: a page is a thing you catch, like a fragment. Most in-world; hardest to tune.

**Where.** Resolved Nov 6 (evening): the Notebook is the **terminal**, a computer terminal on its own page where only the Physicist writes (Instruments §0). ~~A notebook you open from the receiver; plates behind the dial glass; margins of the scale. Belongs with the device-vs-geometry session.~~ Device-vs-geometry was settled Nov 7: a device, drawn as real hardware (Color.md).

---

## 12. The ladder (Proposed design test)

The ladder is the path from "I downloaded this and heard some noise" to "I found her": a ladder to her, and to the full story. The rungs are the stages a listener passes through on the way.

"Too easy and it's cracked overnight; too hard and people quit." The answer is not one lock set to the right tightness. It is a ladder where every rung pays, so the people who stop early still had the thing.

| Rung | What you did | What you got |
| --- | --- | --- |
| 1 | Stumbled on a fragment | Music. A voice. That's already the show. |
| 2 | Noticed it came back at the same time | "When matters." The first law. |
| 3 | Scouted echoes, saw the spacing | A *shape*: a walk, a flinging, a ritual. |
| 4 | Read a Notebook page and recognized it | The story and the band are one thing. |
| 5 | Solved q | Tomorrow is predictable. You can draw the band. |
| 6 | Chased a piece whole | You heard it clean, and it broke in your hands. Nobody else ever will, this cycle. |
| 7 | Computed her place and her moment | Her. And, afterward, the knowledge of what reaching her cost her. |

Her calling-out (§6) is not a rung. It is the thing that reaches down from the top of the ladder to everyone on rung 1 and says: this is real, keep climbing.

The Cicada collapse ("cracked overnight, story on display") only happens when rung 7 is the only rung that pays. With this ladder, a solved band is a *more* interesting band, not a spent one: the next shatter rolls a new q and everyone from rung 5 up starts again.

**What to watch in TestFlight:** where people stop. If everyone stops at 2, the echoes aren't findable enough. If everyone reaches 5 in a day, W is too generous. If nobody reaches 6, G is too tight. Rung 7 can be unreached for months and the design is still working, as long as people *know it's there*, which is what the call-outs are for.
