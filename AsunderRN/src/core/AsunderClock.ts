// The shared clock and the day's rule. The Carrier and Reception code read it
// on the audio thread (see src/audio), and the screen reads it too. The
// 'worklet' line below marks these functions as allowed to run off the main thread.
'worklet';

import { World } from './World';
import { toInteger, wrapUnit } from './Wrap';

// TIMES ARE PLAIN NUMBERS. Every `atSeconds` here is a number of seconds since
// 1 Jan 1970 UTC ("Unix seconds"), which is Date.now() / 1000. The Swift file
// took a Date; this one takes a number and never reads the device clock itself.
//
// PLACEHOLDERS: the epoch (World.epoch) and the hour the day turns
// (World.dayTurnHourUTC) are not final. The epoch is OPEN (Evan hasn't chosen
// it); the day turn at 00:00 UTC is only Proposed and still Open. Both live
// in World.ts.
//
// RULE: a helper function has to be written ABOVE the first place it is used.
// If the order is wrong the code still works on a computer but the phone app
// breaks, because the build step that prepares worklet code needs it.
// (One test, DeclarationOrder, checks the order for you.)

/**
 * The rule a day runs on (Transmission Rules §3–4).
 * Phase 1 only cares whether a day is Still or moving; Phase 2 uses W, L and R.
 * A rule is written as its letter: 'W', 'L', 'R' or 'S'.
 */
export type DayRule = 'W' | 'L' | 'R' | 'S';

/** The four rules by name, for code that reads better with the word. */
export const DAY_RULE_WORLDLINE: DayRule = 'W';
export const DAY_RULE_LIGHT_CONE: DayRule = 'L';
export const DAY_RULE_RECURRENCE: DayRule = 'R';
export const DAY_RULE_STILL: DayRule = 'S';

/** Every rule there is, in the order they're declared above. */
export const ALL_DAY_RULES: DayRule[] = ['W', 'L', 'R', 'S'];

/** Still days hold everything: nothing moves, the static runs cooler. */
export function dayRuleIsStill(rule: DayRule): boolean {
  return rule === DAY_RULE_STILL;
}

// MARK: - Integer helpers
// The % sign keeps the sign of the left side (-1 % 7 is -1). For days before the
// epoch we need the mathematical version (-1 mod 7 is 6), so these do that.
// (They sit up here because the clock functions below use them; see the RULE
// at the top.)

/** `a` modulo `n`, always 0..<n (for a positive `n`), even when `a` is negative. */
export function positiveModulo(a: number, n: number): number {
  const r = a % n;
  // (The `+ 0` turns JavaScript's "negative zero" into plain 0: -7 % 7 is -0.)
  return r < 0 ? r + n : r + 0;
}

/** `a` divided by `n`, rounded DOWN to a whole number (-1 / 7 is -1, not 0). */
export function floorDivide(a: number, n: number): number {
  return toInteger((a - positiveModulo(a, n)) / n);
}

/** How many seconds are in a day. */
export const SECONDS_PER_DAY = 86_400;

/**
 * The shared clock. Every phone turns "now" into the same Asunder day.
 *
 * The day number counts from the epoch: day 0 is the epoch's Sunday, day 1 is
 * Monday, day -1 is the Saturday before. Days turn at `World.dayTurnHourUTC`.
 * (Times are Unix seconds; see TIMES ARE PLAIN NUMBERS at the top.)
 */
export interface AsunderClock {
  /** Day 0 of the clock, in Unix seconds. */
  epoch: number;
  /** Hours after 00:00 UTC that the day turns over. */
  dayTurnHourUTC: number;
}

/**
 * Makes a clock. `epoch` is Unix seconds. Each value left out falls back to the
 * shared world's (`World.epoch`, `World.dayTurnHourUTC`). Tests pass their own.
 */
export function createClock(
  epoch: number = World.epoch,
  dayTurnHourUTC: number = World.dayTurnHourUTC,
): AsunderClock {
  return { epoch: epoch, dayTurnHourUTC: dayTurnHourUTC };
}

// MARK: Days

/**
 * Seconds since the first day turn (the epoch plus the day-turn hour). Negative
 * before that moment. This is the number every other answer is built from.
 * (Internal: only the functions in this file use it.)
 */
function clockSecondsSinceFirstTurn(clock: AsunderClock, atSeconds: number): number {
  return atSeconds - clock.epoch - clock.dayTurnHourUTC * 3_600;
}

/**
 * Which Asunder day it is. 0 on the epoch day; negative before it.
 * Rounds down, so one second before the first turn is day -1, not day 0.
 */
export function clockDayIndex(clock: AsunderClock, atSeconds: number): number {
  return toInteger(Math.floor(clockSecondsSinceFirstTurn(clock, atSeconds) / SECONDS_PER_DAY));
}

/** Day of the week, 0 = Sunday ... 6 = Saturday. */
export function clockDayOfWeek(clock: AsunderClock, atSeconds: number): number {
  return positiveModulo(clockDayIndex(clock, atSeconds), 7);
}

/** Whole weeks since the epoch. Negative before it. */
export function clockWeeksSinceEpoch(clock: AsunderClock, atSeconds: number): number {
  return floorDivide(clockDayIndex(clock, atSeconds), 7);
}

/**
 * How far through the current Asunder day we are, 0..<1.
 * The Carrier's day-turn kink and the static's temperature will read this.
 */
export function clockDayProgress(clock: AsunderClock, atSeconds: number): number {
  return wrapUnit(clockSecondsSinceFirstTurn(clock, atSeconds) / SECONDS_PER_DAY);
}

/** Seconds since the most recent day turn, 0..<86400. */
export function clockSecondsIntoDay(clock: AsunderClock, atSeconds: number): number {
  return clockDayProgress(clock, atSeconds) * SECONDS_PER_DAY;
}

// MARK: Rules

/**
 * The rule for a given day: P[(k + 3w) mod 7]. Pure math, no clock.
 * `dayOfWeek` is k (0 = Sunday) and `week` is w (whole weeks since the epoch).
 */
export function clockRuleForDay(dayOfWeek: number, week: number): DayRule {
  const slot = positiveModulo(dayOfWeek + World.weeklyAdvance * week, World.weekPattern.length);
  return World.weekPattern[slot];
}

/** The rule running at a moment in time. */
export function clockRule(clock: AsunderClock, atSeconds: number): DayRule {
  return clockRuleForDay(clockDayOfWeek(clock, atSeconds), clockWeeksSinceEpoch(clock, atSeconds));
}

/** True if the day running at this moment is a Still day. */
export function clockIsStill(clock: AsunderClock, atSeconds: number): boolean {
  return dayRuleIsStill(clockRule(clock, atSeconds));
}
