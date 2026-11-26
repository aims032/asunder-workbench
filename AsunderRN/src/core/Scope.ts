// THE SCOPE: the CRT screen on the bench that shows pictures.
//
// The `'worklet';` line below marks every function in this file as safe to run
// on the screen thread. It has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used (the DeclarationOrder test checks this).
'worklet';

import { carrierClarity, carrierDetentsAway } from './Carrier';
import type { BandPosition } from './BandModel';
import { ScopeTuning } from './Tuning';

// WHAT THIS FILE DECIDES (and what it leaves to the screen)
//
// The scope turns Evan's own media (phone clips, photographs, and later his
// vector art) into a picture on an old TV tube. What follows is only the
// numbers: how clear the picture is, how much snow covers it, how much it
// rolls and shakes. ScopeScreen.tsx turns those numbers into the picture.
//
// Three ways the screen can draw (Evan, Nov 23):
//   1. CRT: a TV-style picture with scanlines, glow and snow, for photos and
//      clips.
//   2. XY: a glowing line drawing, for vector art (SVG files, see
//      VectorArt.ts). A line carrying vector art switches the scope to XY.
//   3. The override: Asunder takes the screen over and shows crisp, perfect
//      pixels that an old tube shouldn't be able to show. When it happens and
//      what she shows is Evan's story call; only the switch is built here.
//
// Where the picture comes from (assumed, Claude, Nov 23; Evan to confirm):
// the phone line patched into the switchboard's SCOPE jack. Each line is a
// place in the mill, so each line carries that place's scene feed. With
// nothing patched in, the scope shows only snow.
// How clear the picture is follows how well the dial is tuned: a cleaner
// signal makes a clearer picture (Evan, Nov 23).

/** The switchboard jack that feeds the scope. */
export const SCOPE_JACK = 'scope';

/** The ways the scope can draw (the override goes on top of either). */
export type ScopeMode = 'crt' | 'xy';

/**
 * How clear the signal is where the dial sits, 0 (lost in the static) to 1
 * (dead on). PLACEHOLDER: for now it is the Carrier's clarity, because the
 * Carrier is the only signal on the band. Once transmissions carry their own
 * signal, this should read that signal instead.
 */
export function scopeClarity(dial: BandPosition): number {
  return carrierClarity(carrierDetentsAway(dial));
}

/** Everything the screen needs to draw one frame of the CRT picture. */
export interface ScopeLook {
  /** How much of the picture shows through, 0 (none) to 1 (all). */
  picture: number;
  /** How much snow covers it, 0 to 1. */
  snow: number;
  /** How much the picture smears sideways, in fractions of the screen width. */
  smear: number;
  /** How far each scanline can shake sideways, in fractions of the screen width. */
  jitter: number;
  /** How fast the picture rolls up the screen, in screens per second. */
  rollSpeed: number;
  /** How much color is left, 0 (black and white) to 1 (full color). */
  color: number;
  /**
   * How hard the vertical hold pulls a rolling picture back into place,
   * 0 (not at all) to 1 (fully). Tuned in, the picture locks upright.
   */
  hold: number;
}

/** A number pulled into 0...1. */
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Straight-line blend from `a` (at t = 0) to `b` (at t = 1). */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The CRT picture's look for a given clarity.
 * `patched` is whether a line is patched into the scope at all: with nothing
 * patched in there's no picture to show, only snow.
 */
export function scopeLook(clarity: number, patched: boolean): ScopeLook {
  const T = ScopeTuning;
  // The picture only starts to show once the signal is above the threshold,
  // then comes in fully by clarity 1.
  const c = patched ? clamp01((clarity - T.pictureFrom) / (1 - T.pictureFrom)) : 0;
  return {
    picture: c,
    // The snow clears quickly at first, then the last of it lingers.
    snow: mix(T.snowLost, T.snowClear, Math.sqrt(c)),
    smear: mix(T.smearLost, 0, c),
    jitter: mix(T.jitterLost, T.jitterClear, c),
    rollSpeed: mix(T.rollLost, 0, c),
    color: mix(0, 1, clamp01((c - T.colorFrom) / (1 - T.colorFrom))),
    hold: c,
  };
}

/** Everything the screen needs to draw one frame of the XY line drawing. */
export interface ScopeXYLook {
  /** How bright the beam is, 0 (dark) to 1 (full). */
  brightness: number;
  /** How far the beam wobbles off the line, as a fraction of the screen width. */
  wobble: number;
  /** How much the beam's grass (the fuzz on an empty scope) shows, 0 to 1. */
  grass: number;
}

/**
 * The XY drawing's look for a given clarity. Off the signal the line breaks
 * up into wobble and grass; tuned in, it settles into a clean glowing line.
 * With nothing patched in there's no drawing, only the grass.
 */
export function scopeXYLook(clarity: number, patched: boolean): ScopeXYLook {
  const T = ScopeTuning;
  const c = patched ? clamp01((clarity - T.pictureFrom) / (1 - T.pictureFrom)) : 0;
  return {
    brightness: c,
    wobble: mix(T.xyWobbleLost, T.xyWobbleClear, c),
    grass: mix(1, T.xyGrassClear, Math.sqrt(c)),
  };
}

/**
 * Move the roll on by `dt` seconds. The roll is where the picture's top edge
 * is, 0...1, and wraps. It drifts at the look's rollSpeed, and the vertical
 * hold pulls it back toward upright (0) as hard as the look's `hold` says.
 */
export function scopeRoll(roll: number, look: ScopeLook, dt: number): number {
  let next = (roll + look.rollSpeed * dt) % 1;
  if (next < 0) {
    next += 1;
  }
  // The short way back to upright: down to 0, or up to 1 (the same place).
  const back = next < 0.5 ? -next : 1 - next;
  const pull = Math.min(1, ScopeTuning.rollLock * dt) * look.hold;
  next += back * pull;
  return next >= 1 ? next - 1 : next;
}

// THE OVERRIDE: Asunder taking over the screen.
//
// Evan, Nov 23: the scope can also show crisp pixels, as if Asunder can make
// the display do what it technically shouldn't be able to, because of her
// relationship to the timeline: her way of answering the forward-moving time
// of the real world. Each override is a window on the shared clock, so every
// phone sees it at the same moment. The list is empty: when they happen and
// what they show is Evan's to write.

/** One time Asunder takes over the screen. */
export interface ScopeOverride {
  /** When it starts, in clock time (Unix seconds). */
  startsAt: number;
  /** How long it lasts, in seconds. */
  seconds: number;
  /** Which picture she shows (a key into the app's list of pictures). */
  picture: string;
}

/** The overrides, in order. PLACEHOLDER: [OVERRIDE SCHEDULE: Evan]. */
export const SCOPE_OVERRIDES: readonly ScopeOverride[] = [];

/** Whether an override is on screen right now, and how far. */
export interface ScopeOverrideState {
  /** How fully she has the screen, 0 (not at all) to 1 (completely). */
  amount: number;
  /** The picture she's showing, or null when she isn't. */
  picture: string | null;
}

/**
 * How far one override has the screen at `now`: it snaps in, holds, then
 * lets go (ScopeTuning.overrideInSeconds and overrideOutSeconds).
 */
export function scopeOverrideAmount(o: ScopeOverride, now: number): number {
  const T = ScopeTuning;
  const t = now - o.startsAt;
  if (!(t >= 0 && t < o.seconds)) {
    return 0;
  }
  const rise = T.overrideInSeconds > 0 ? clamp01(t / T.overrideInSeconds) : 1;
  const fall = T.overrideOutSeconds > 0 ? clamp01((o.seconds - t) / T.overrideOutSeconds) : 1;
  return Math.min(rise, fall);
}

/** Which override (if any) is on screen at `now`. If two overlap, the stronger wins. */
export function scopeOverrideAt(now: number, overrides: readonly ScopeOverride[]): ScopeOverrideState {
  let best: ScopeOverrideState = { amount: 0, picture: null };
  for (const o of overrides) {
    const amount = scopeOverrideAmount(o, now);
    if (amount > best.amount) {
      best = { amount, picture: o.picture };
    }
  }
  return best;
}
