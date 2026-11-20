// The 'worklet' line below is kept like the other core files. This file holds
// only numbers, no functions; code on the audio and screen threads takes its
// own copy of them.
'worklet';

import type { DayRule } from './AsunderClock';
import type { BandPosition } from './BandModel';

// THE LAWS OF THE BAND
//
// Everything in this file must be identical on every phone, because every
// phone computes the same band from the same clock. Change a value here and
// you've changed the shared world: phones with the old value and phones with
// the new one will disagree about what day it is and where things are.
//
// That's different from Tuning.ts, which only changes how the app feels
// in your hand and is safe to tweak per build.
//
// Several of these are OPEN in /docs. They're placeholders until Evan decides.

export const World = {
  // MARK: Clock

  /**
   * The Asunder epoch: day 0 of the shared clock.
   * OPEN (CLAUDE.md §5). Placeholder: Sunday 1 Nov 2026, 00:00 UTC.
   * It must be a Sunday at 00:00 UTC, because day-of-week is counted from it.
   * (A moment in time is written as Unix seconds: seconds since 1 Jan 1970 UTC.)
   */
  epoch: 1_793_491_200,

  /**
   * Hours after 00:00 UTC that the Asunder day turns over.
   * PROPOSED: 0 (= 7pm Eastern in winter). Still OPEN in Build Foundation §11.
   * A story-meaningful hour would go here, e.g. 5 for 05:00 UTC.
   */
  dayTurnHourUTC: 0,

  // MARK: The week (Transmission Rules §4, Proposed)

  /**
   * The base week, Sunday first. S = Still day.
   *     P = [W, L, S, R, W, S, L]
   * Each week the pattern advances three days: rule(k, w) = P[(k + 3w) mod 7].
   * (W = worldline, L = light cone, R = recurrence, S = still: see AsunderClock.ts.)
   * ("satisfies DayRule[]" is a TypeScript check, not a change to the values:
   * it makes the editor complain if an entry isn't one of the allowed rule
   * letters, while keeping the list exactly as written.)
   */
  weekPattern: ['W', 'L', 'S', 'R', 'W', 'S', 'L'] satisfies DayRule[],

  /**
   * How many days the pattern shifts each week. 3 and 7 share no factors,
   * so the schedule visits all 7 rotations and repeats every 7 weeks (49 days).
   */
  weeklyAdvance: 3,

  // MARK: The Carrier (Instruments §3)

  /**
   * Where the Carrier lives. It never moves.
   * PLACEHOLDER: no position has been chosen. 68/205 of the way round reads
   * about 19.92 MHz on the wide band (shortwave, where zero-beat whistles
   * live). It read 94.3 on the old FM band; the position itself didn't move.
   * (A BandPosition. It's already between 0 and 1, so it needs no folding.
   * "as BandPosition" is a TypeScript label, not a calculation: it tells the
   * editor "treat this plain number as a band position". The number itself
   * is unchanged.)
   */
  carrierPosition: (68.0 / 205.0) as BandPosition,

  /**
   * At every day turn the Carrier drops out for this many seconds, then comes
   * back: its "kink" (Confirmed Nov 19: the kink is a dropout).
   * PROPOSED length; how long is still a choice.
   */
  carrierDropoutSeconds: 1.5,

  // MARK: The static (Instruments §2)

  /**
   * At each day turn the static glides from yesterday's temperature to
   * today's over this many seconds (0 = it snaps at the turn). It's here and
   * not in Tuning because every phone should shift at the same moment: it's
   * the "shift in the floor" a listener can hear, and later see on the analyzer.
   * PROPOSED: about half a minute.
   */
  temperatureGlideSeconds: 30,
};
