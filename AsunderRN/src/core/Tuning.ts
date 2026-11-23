// The 'worklet' line below is kept like the other core files. This file holds
// only numbers, no functions; code on the audio and screen threads takes its
// own copy of them.
'worklet';

import type { NoiseColor } from './Noise';

// TUNING: every feel number in one place.
//
// These change how the receiver feels in your hand. They don't change the
// shared world (that's World.ts), so tweak them freely and feel the
// difference. Each one says what turning it up or down does.
//
// Three things worth knowing:
//  - The comments are written as /** ... */ blocks so that hovering over
//    Tuning.something anywhere in the app shows them in your editor.
//  - After changing a number, reload the app fully (press r in the terminal
//    running the bundler). The audio thread keeps its own copy of these numbers
//    from when the radio first switched on, so a plain save won't reach the sound.
//  - A test called SwiftParity compares these numbers with Tuning.swift. It
//    fails after a change here until Tuning.swift is changed to match and
//    "npm run golden" is run (see AsunderRN/README.md).
//
// Units: most dial numbers are in DETENTS (one notch of the wheel; on the wide
// band each notch is about 1.2% higher in frequency than the last).
// "Detents per second" is how fast the wheel turns.

/**
 * How many notches in one lap of the whole band. It sits out here, above the
 * list, only so that detentSpacing below can be worked out from it.
 * (Its full description is at Tuning.notchesPerLap.)
 */
const notchesPerLap = 2_300;

export const Tuning = {
  // MARK: Band

  /**
   * How many notches in one lap of the whole band. The wide band spans
   * about 11.5 tenfolds (3 kHz to 1,000 THz), so 2,300 is about 200 notches
   * per tenfold: each notch is ~1.2% higher in frequency than the last.
   * Bigger = finer tuning, but a longer trip round the band.
   * Smaller = coarser, quicker to cross. (Was 205 on the old FM band.)
   * Features don't need to sit on a notch: the wheel snaps onto them (snapToFeature).
   * (Only detentSpacing and a test read this directly; everything else uses detentSpacing.)
   */
  notchesPerLap: notchesPerLap,

  /**
   * How far apart the notches are, as a fraction of the whole band.
   * Worked out from notchesPerLap; change that one instead.
   */
  detentSpacing: 1.0 / notchesPerLap,

  // MARK: Dial: the hand

  /**
   * How far your finger slides sideways (in screen points) to turn the wheel
   * one detent. The drawn grooves use the same spacing, so at the middle of
   * the wheel a groove moves as far as your finger does (toward the edges
   * they bunch up, to look round).
   * Smaller = a "fast" dial, a short swipe covers lots of band (and the
   * grooves are drawn closer together).
   * Bigger = a slow, precise dial (and wider-spaced grooves).
   */
  pointsPerDetent: 14,

  /**
   * How quickly the flick speed is read from your finger, in seconds.
   * Smaller = the coast follows the last instant of the swipe (twitchy).
   * Bigger = it averages more of the swipe (smoother, a bit less direct).
   */
  flickSmoothing: 0.035,

  /**
   * The fastest a flick can spin the wheel, in detents per second.
   * 700 with coastFriction 1.6 carries a hard flick ~440 notches, about two
   * tenfolds; five or six hard flicks go all the way round the band.
   * Bigger = a hard flick travels further. Smaller = flicks are tamed and
   * the wheel never gets very fast.
   * (Nov 19: up from 300 when the band got wide.)
   */
  maxFlickSpeed: 700,

  // MARK: Dial: the coast

  /**
   * How fast a spinning wheel slows down. This is the "weight" of the wheel.
   * Smaller = a heavy flywheel that coasts a long way.
   * Bigger = a light wheel in thick grease that stops soon after you let go.
   * (Speed falls by about 1 - e^-friction every second: 1.6 loses ~80%/s.)
   */
  coastFriction: 1.6,

  /**
   * Below this speed (detents per second) a coasting wheel stops spinning
   * and drops into the next notch.
   * Bigger = it gives up sooner and clicks in; smaller = it creeps longer.
   */
  settleSpeed: 4,

  /**
   * How quickly the wheel seats into a notch once it's slow, per second.
   * Bigger = a snappy click-in. Smaller = a soft, lazy settle.
   * Set to 0 for no notches at all: the wheel just stops wherever it is.
   */
  settleRate: 14,

  /**
   * Lock-on snap, like the automatic frequency control on an old tuner:
   * when the wheel comes to rest within this many detents of a feature's
   * center, it settles exactly onto the feature instead of the nearest notch.
   * Features can sit anywhere on the band, so without this you could land
   * near one but never dead on. 0 = no snap. Bigger = a stronger, wider pull.
   */
  snapToFeature: 0.75,

  // MARK: Dial: the needle and readout

  /**
   * How far the needle and readout lag behind the wheel, in seconds.
   * 0 = locked to the wheel (feels digital). 0.07 = a slight, physical lag.
   * 0.2+ = a lazy, heavy needle that swings in after you.
   */
  needleLag: 0.07,

  /**
   * Safety cap on one physics step, in seconds. If the phone stalls,
   * the wheel won't leap across the band when it catches up. Rarely touched.
   * Bigger = allows longer jumps after a stall. Smaller = the wheel may
   * move slower than it should if the phone is struggling.
   */
  maxFrameStep: 1.0 / 20.0,

  // MARK: Haptics

  /**
   * Most detent ticks the phone will play per second during a fast spin.
   * Real detents blur into a buzz when spun fast; this keeps it a texture.
   * Bigger = busier buzz on flicks. Smaller = sparser, more "sampled" ticks.
   */
  maxTicksPerSecond: 45,

  /**
   * Detent tick strength, 0...1. Bigger = a harder knock.
   * (Nov 19: down from 0.55, which Evan found jarring on the phone.)
   */
  tickIntensity: 0.35,

  /**
   * Detent tick sharpness, 0...1. Bigger = a crisp click; smaller = a dull thud.
   * (Nov 19: down from 0.85 for the same reason.)
   */
  tickSharpness: 0.6,

  /**
   * Ticks get softer the faster the wheel spins, the way real detents blur
   * into a buzz. This is the spin speed (detents per second) at which a tick
   * plays at half strength. Smaller = ticks fade sooner on a flick.
   * Bigger = every tick stays firm even at full spin.
   */
  tickSoftenSpeed: 60,

  /**
   * The tick strengths the phone has ready, as shares of tickIntensity,
   * firmest first. Each tick plays whichever is closest to what the spin speed
   * asks for. The last one is the softest a fast spin can get, however low
   * tickSoftenSpeed is set. Add a smaller entry (e.g. 0.15) to let flicks fade further.
   */
  tickStrengthSteps: [1.0, 0.75, 0.5, 0.3],

  /**
   * The "centered on a feature" pulse. Strength 0...1, sharpness 0...1, and
   * length in seconds. It should feel clearly different from a tick:
   * rounder and longer. (Nov 19: strength down from 1.0 to match the softer ticks.)
   *
   * lockIntensity: bigger = a harder thump, smaller = a gentler one.
   * lockSharpness: bigger = a crisp click like a tick, smaller = a rounder,
   *   duller thud (keep it below tickSharpness so the two stay different).
   * lockDuration: bigger = a longer, more drawn-out pulse; smaller = a
   *   short tap that feels more like a tick.
   */
  lockIntensity: 0.75,
  lockSharpness: 0.3,
  lockDuration: 0.09,

  /**
   * How close to a feature's center (in detents) counts as "centered" and
   * plays the lock pulse. 0.25 = only when the wheel sits on the feature's notch.
   * Spinning straight past the center also counts, so a flick still bumps.
   * Bigger = the pulse fires from further out (easier to trigger).
   * Smaller = it only fires when you're almost exactly on it.
   */
  lockDistance: 0.25,

  /**
   * How far (in detents) you have to move off a feature before coming back
   * plays the lock pulse again. 0.75 = one notch away and back re-arms it.
   * Bigger = rocking around the center doesn't keep re-pulsing.
   */
  lockRelease: 0.75,

  // MARK: Sound: the static

  /**
   * Overall loudness of the static, 0...1 (before the phone's volume).
   * This is the whole radio's master level; the Carrier sits on top of it.
   * Up = louder hiss (and loud enough, it can bury the Carrier).
   * Down = a quieter, more distant radio.
   */
  staticVolume: 0.5,

  /**
   * The static on a moving day: HOT. More energy, so brighter: hiss leads.
   * (Physics reading, Confirmed Nov 19: hotter noise has more highs.)
   * The three weights set the color (only their ratio matters);
   * `level` sets how loud. Both presets are relative to staticVolume.
   * More white = brighter, hissier. More pink = balanced, like rain. More
   * brown = a deeper rumble. Raising `level` = louder.
   * ("satisfies NoiseColor" is a TypeScript check, not a change to the
   * values: it makes the editor complain if one of the four names is
   * missing or misspelled. The same applies to coldStatic below.)
   */
  hotStatic: { white: 0.55, pink: 0.4, brown: 0.15, level: 1.0 } satisfies NoiseColor,

  /**
   * The static on a Still day: COLD. The hiss drains out and leaves a low,
   * quiet rumble. Lower `level` = a quieter Still day.
   */
  coldStatic: { white: 0.06, pink: 0.3, brown: 0.7, level: 0.55 } satisfies NoiseColor,

  // (How long the static takes to glide from hot to cold at a day turn is in
  // World.ts, because every phone should shift at the same moment.)

  // MARK: Sound: the receiver's EQ path
  //
  // Everything you hear goes through one filter path: the static, the Carrier,
  // and later the transmissions. Off any feature the path is CLOSED (thin, like
  // a radio between stations). Dead on a feature it OPENS (full and wide).

  /**
   * Lowest frequency let through when closed / open, in Hz.
   * This is a high-pass filter: it cuts everything below the number.
   * Smaller open value = fuller bass when dead on a feature; bigger = thinner.
   * Bigger closed value = thinner static off-station. Heads up: this only
   * changes things below about 200 Hz, which headphones play and the
   * iPhone's speaker mostly doesn't. On the speaker, "closed" is heard as
   * duller (the low-pass below), not thinner. To hear thin on the speaker,
   * the closed value would need to be 300-500 Hz, which also thins out the
   * Still-day rumble.
   */
  closedHighpassHz: 140,
  openHighpassHz: 45,

  /**
   * Highest frequency let through when closed / open, in Hz.
   * This is a low-pass filter: it cuts everything above the number.
   * Smaller closed value = duller static between stations; bigger = brighter,
   * more open off-station.
   * Bigger open value = airier, brighter sound dead on a feature; smaller = duller.
   */
  closedLowpassHz: 4_500,
  openLowpassHz: 12_000,

  /**
   * How peaky the two filters are. 0.707 = smooth, no peak. Around 1.2 adds
   * a slight nasal "radio speaker" honk at the edges of the band.
   * (This is the filter's resonance, or Q, the same knob as on a synth filter.)
   * Lower = rounder and softer. Higher = a more pronounced peak at the cutoff.
   */
  receiverResonance: 0.8,

  // MARK: Sound: the Carrier

  /**
   * How loud the Carrier is dead on, 0...1. It's meant to be faint.
   * Up = the tone sits further above the hiss and is easier to find.
   * Down = it hides in the static. 0 = silent.
   * (Dead on it also gets the humBoost lift, so it ends up louder than this.)
   */
  carrierVolume: 0.14,

  /**
   * How wide the Carrier is heard, in detents (its bandwidth). Its loudness
   * is a bell curve: full at center, ~60% at this many detents off, nearly
   * gone at three times this. Bigger = easier to find; smaller = a needle in a haystack.
   */
  carrierWidth: 4,

  /**
   * How close you have to be (in detents) before the EQ path opens and the
   * hiss quiets. Narrower than carrierWidth, so only the center notch sounds
   * truly clean. Bigger = the "arrival" starts further out.
   */
  clearWidth: 0.6,

  /**
   * How much the hiss drops when you're dead on, 0...1. 0.6 = down to 40%.
   * (Real FM does this: a carrier "quiets" the noise.) 0 = no quieting.
   */
  carrierQuieting: 0.6,

  /**
   * The zero-beat whistle (Confirmed Nov 19). Its pitch is the distance to
   * the center: this many Hz per detent off, on top of the hum. As you tune
   * in, the whistle slides down. Bigger = steeper slide, each notch a bigger jump.
   */
  whistleHzPerDetent: 350,

  /**
   * The pitch the whistle settles to dead on center: the low hum, in Hz.
   * iPhone speakers barely play below ~200 Hz, so on the speaker you mostly
   * hear the hum through its overtones; on headphones, the note itself too.
   * (Nov 19: up from 110, which all but vanished on the speaker.)
   * Up = a higher, thinner hum, easier to hear on a phone speaker.
   * Down = a deeper, heavier hum, but it fades out on the speaker.
   */
  humHz: 165,

  /**
   * Overtones on the Carrier's tone, 0...1 each: 2nd and 3rd harmonic.
   * 0 and 0 = a pure sine. More = buzzier, more like mains hum, and easier
   * to hear on a phone speaker. These carry the hum on the speaker.
   */
  carrierSecondHarmonic: 0.8,
  carrierThirdHarmonic: 0.5,

  /**
   * Extra loudness for the hum dead on center, on top of the bell curve.
   * 0.6 = 60% louder. Without it, a phone speaker makes the center sound
   * quieter than one notch off (low notes don't come through), so the
   * "arrival" would feel like a dip. 0 = follow the bell curve exactly.
   */
  humBoost: 0.6,

  // MARK: Sound: response

  /**
   * How quickly the sound follows the wheel, in seconds. Every level, pitch
   * and filter glides this fast toward where it should be.
   * Smaller = snappier but can click; bigger = smoother, slightly behind the hand.
   */
  soundFollowTime: 0.015,

  /**
   * How long the radio takes to fade in from silence when it turns on, in
   * seconds. It's a smooth glide that is about 63% of the way up after this
   * long and about 95% up after three times this.
   * Bigger = a slow swell, like a valve set warming up.
   * Smaller = it comes on almost at once. 0 = no fade at all (an abrupt start).
   */
  powerOnFade: 0.4,

  /**
   * NOT USED in this app. Nothing in AsunderRN/src reads it. It is here only
   * because the Swift app has it, and the SwiftParity test checks that both
   * Tuning files have the same list of names. In this app the equivalent
   * setting is the constant BLOCK_SIZE near the top of
   * src/audio/ReceiverAudio.native.ts. Changing this number does nothing.
   * (In Swift: how much audio the phone works on at once, in seconds.
   * Smaller = the sound reacts to the dial sooner but costs more battery.)
   */
  audioBufferSeconds: 0.01,
};

// THE SPECTRUM ANALYZER'S FEEL NUMBERS
//
// Kept in their own list, next to Tuning, for one reason: the SwiftParity test
// checks that Tuning has exactly the same names as the Swift app's
// Tuning.swift, and the Swift app has no analyzer. (CLAUDE.md: don't edit the
// Swift app as part of React Native work.) Everything else about them is the
// same as Tuning: change them freely, they don't change the shared world.
//
// Units: span and RBW are fractions of the whole band (1 = all of it;
// one detent is 1/2300, about 0.00043). Levels are in dB.
export const AnalyzerTuning = {
  // MARK: The picture

  /**
   * How many points across the screen. More = finer detail, more work per
   * frame. (The Keysight's default is 1,001; a phone screen is narrower.)
   */
  points: 401,

  /**
   * How many past sweeps the spectrogram keeps (its height, in rows).
   * More = a longer history on screen.
   */
  spectrogramRows: 120,

  /** The level at the top of the screen when the app opens, in dB. */
  startReferenceDb: -40,

  /** How far one notch of the knob moves the reference level, in dB. */
  referenceStepDb: 5,

  /** The lowest and highest the reference level goes, in dB. */
  lowestReferenceDb: -100,
  highestReferenceDb: 0,

  /**
   * dB per grid square, top to bottom. 10 is the classic analyzer setting.
   * Smaller = zoomed in on level: small swells look big, but the floor and
   * the line may not both fit.
   */
  dbPerDivision: 10,

  /** How many grid squares tall the screen is. (The Keysight's is 10.) */
  divisions: 10,

  /**
   * The spectrogram's color range, in dB down from the reference level:
   * the reference level is brightest, this far below it is black.
   * Smaller = more contrast, so the floor goes dark and lines pop out;
   * bigger = the floor's texture shows.
   */
  spectrogramRangeDb: 50,

  // MARK: Span and RBW

  /** The spans the knob steps through, widest first. 1 = the whole band. */
  spanSteps: [1, 0.3, 0.1, 0.03, 0.01, 0.003],

  /** The span when the app opens (one of spanSteps). */
  startSpan: 0.1,

  /** The RBWs the knob steps through, narrowest first (a 1-3-10 series, like the real thing). */
  rbwSteps: [1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 3e-3, 1e-2],

  /**
   * On Auto, RBW is about span / this. Bigger = sharper lines and a lower
   * floor at every span, but slower sweeps.
   */
  spanPerRbw: 100,

  // MARK: The sweep

  /**
   * The "k" in sweep time = k x span / RBW^2 (the real rule). Bigger = every
   * sweep slower. At the default span and Auto RBW, 6e-7 gives about 0.06 s.
   */
  sweepFactor: 6e-7,

  /** The quickest a sweep is allowed to be, in seconds. Below about 0.05 the trace just flickers. */
  fastestSweep: 0.05,

  /**
   * The slowest a sweep is allowed to be, in seconds. A real analyzer would
   * happily take minutes at a very narrow RBW; this keeps it playable.
   */
  slowestSweep: 12,

  /** The most sweeps measured in one frame, so a long pause never makes one frame slow. */
  maxSweepsPerFrame: 2,

  /**
   * In Average mode, how many sweeps the trace averages over. More = a
   * smoother, calmer floor that's slower to react to change.
   */
  averageCount: 16,

  // MARK: What it sees

  /**
   * The noise floor's height on Still days and on moving days, in dB, at
   * referenceRbw. The gap between them is how big the step is at the day turn.
   */
  coldFloorDb: -102,
  hotFloorDb: -94,

  /** The RBW the two floor numbers above are measured at. */
  referenceRbw: 1e-3,

  /**
   * How strong the Carrier's line is, in dB. Higher = it stands taller above
   * the floor. (Not the same as how loud it sounds: that's Tuning.carrierVolume.)
   */
  carrierDb: -62,

  /**
   * How many times a second the floor's grass changes. Higher = busier,
   * fizzier grass; lower = it shimmers slowly.
   */
  grassRate: 30,

  // MARK: Drawing and controls

  /** How soft the glow around the trace is, in points. 0 = no glow, a bare line. */
  traceGlow: 4,

  /** How bright the glow is, 0...1. */
  traceGlowOpacity: 0.55,

  /** How many times a second the marker's number updates. */
  markerReadoutRate: 8,

  /**
   * How far the knob turns for one step of whatever it's set to, in degrees.
   * Smaller = a twitchier knob.
   */
  knobDegreesPerStep: 24,
};

// DESK TUNING: the second screen (the switchboard and the printer).
//
// Kept apart from Tuning for the same reason as AnalyzerTuning: the Swift
// parity test checks Tuning's names against Tuning.swift, and the Swift app
// has no desk. Change these freely.
export const DeskTuning = {
  // MARK: The screen

  /**
   * How much of the desk's WIDTH the cord board gets, from 0 to 1. The
   * printer sits beside it and gets the rest (Evan, Nov 23: the cord-board
   * look, printer off to one side). Bigger = bigger jacks, a narrower strip
   * of paper.
   */
  switchboardShare: 0.62,

  /**
   * Which side the printer sits on. true = right, false = left.
   */
  printerOnRight: true,

  // MARK: The cord board

  /**
   * How many holes each phone line has on the board. 2 means two instruments
   * can listen to the same line at once. More = a taller field of jacks.
   */
  jacksPerLine: 2,

  /**
   * How big a jack hole is drawn, as a share of the space between jacks
   * (0 to 1). Bigger = fatter holes, closer together.
   */
  jackSize: 0.55,

  /**
   * Room kept for the small name labels above the jacks and under the
   * cords, in points.
   */
  boardLabelSpace: 30,

  /**
   * How far the jacks sit above the shelf the cords rest in, in jack
   * spacings. Smaller = a shorter reach from cord to jack and more room
   * left above the board; bigger = longer cords.
   */
  shelfGap: 4,

  /**
   * How close a plug has to be to an empty jack before it will drop in,
   * measured in jack spacings. Bigger = more forgiving, "magnetic"; smaller
   * = you have to aim.
   */
  cordSnapReach: 0.75,

  /**
   * How close a touch has to be to a plug to pick it up, in jack spacings.
   * Bigger = easier to grab, but neighbouring plugs get harder to tell apart.
   */
  cordGrabReach: 0.9,

  /**
   * How far above your fingertip the plug rides while you carry it, in
   * points, so your finger doesn't hide the jack you're aiming at.
   * 0 = right under the finger.
   */
  cordLift: 22,

  /**
   * How much slack a cord has, in jack spacings. Bigger = cords hang in deep
   * loops; 0 = every cord is a straight line.
   */
  cordSlack: 1.6,

  /**
   * The spring that carries a plug the last little way into a jack, or back
   * to the shelf when you let go. Stiffer = snappier. More damping = less
   * bounce (around 12 it wobbles once; 30 and up it just slides home).
   */
  cordSpringStiffness: 260,
  cordSpringDamping: 20,

  /**
   * How strong the three buzzes are, from 0 to 1 (0 = none): picking a plug
   * up, passing over a jack it could drop into, and the plug going home.
   */
  cordGrabHaptic: 0.4,
  cordHoverHaptic: 0.3,
  cordPlugHaptic: 1,

  // MARK: The printer

  /**
   * The most print-outs the printer keeps. Past this, the oldest fall off.
   * Bigger = a longer roll to scroll back through.
   */
  printerKeeps: 500,

  // MARK: The fading paper

  /**
   * How many times the app can be closed before a print-out has faded off
   * the paper and is gone (Evan, Nov 23: 33). A fresh copy from Bess starts
   * the count over. Bigger = print-outs last longer.
   */
  fadeCloses: 33,

  /**
   * The faintest the ink gets before a slip disappears, from 0 (invisible)
   * to 1 (never fades). It's a floor so that a nearly-gone slip can still be
   * read by someone with low vision. Lower = ghostlier, harder to read.
   * (Proposed by Claude; Evan to tune by eye.)
   */
  fadeFloor: 0.45,

  // MARK: The "new print-out" cue

  /**
   * Whether the cue plays at all. false = print-outs arrive silently.
   */
  cueEnabled: true,

  /**
   * The first transmission whose print-outs get the cue (Evan, Nov 23: it
   * only matters once Asunder is introduced, about 30 transmissions in).
   * Placeholder: set it to the real transmission once Evan has it.
   * Lower = the cue starts earlier in the story.
   */
  cueFromTransmission: 30,

  /**
   * How long the visual cue (the glow on the page switch) lasts, in seconds.
   * Longer = harder to miss, less subtle.
   */
  cueGlowSeconds: 4,
};

// LINE TUNING: the analyzer's LINE input (a phone line patched into it).
//
// Kept apart from Tuning for the same reason as AnalyzerTuning (the Swift
// app has none of this). Change these freely. The "stand-in voice" numbers
// only matter until there are real recordings.
export const LineTuning = {
  // MARK: The screen

  /**
   * The lowest and highest frequency on the LINE screen, in Hz, left to
   * right. A phone line carries roughly 300 to 3,400 Hz; this is wider so
   * the low pitch of a voice and its upper detail both fit.
   */
  lowHz: 60,
  highHz: 6_000,

  /**
   * How long one sweep across the LINE screen takes, in seconds. Shorter =
   * the picture keeps up with speech; longer = you watch it paint.
   */
  sweepSeconds: 0.08,

  /** The most sweeps worked out in one frame, so a long pause can't stall the screen. */
  maxSweepsPerFrame: 2,

  // MARK: The empty line

  /** The level of an empty line's hiss, in dB. Higher = a noisier line. */
  floorDb: -92,

  /** How far the hiss flickers up and down, in dB. */
  grassDb: 8,

  /** How many times a second the hiss flickers. */
  grassRate: 12,

  /** How much quieter the screen is with nothing patched in, in dB. */
  unpatchedDropDb: 12,

  // MARK: The stand-in voices

  /** The level of a stand-in voice's strongest harmonic, in dB. */
  voicePeakDb: -48,

  /** How many syllables a second a stand-in voice speaks. */
  syllablesPerSecond: 3.5,

  /** How far the pitch wanders between syllables (0.12 = 12% up or down). */
  pitchWander: 0.12,

  /** How wide each harmonic spike is, in Hz. Bigger = fatter spikes. */
  harmonicWidthHz: 9,

  /** How wide each formant bump is, as a fraction of its frequency. */
  formantWidth: 0.16,

  /** How fast a voice gets weaker going up, in dB per doubling of frequency. */
  tiltDbPerOctave: 6,
};
