import {
  DAY_RULE_LIGHT_CONE,
  DAY_RULE_RECURRENCE,
  DAY_RULE_STILL,
  DAY_RULE_WORLDLINE,
  World,
  clockDayIndex,
  clockDayOfWeek,
  clockDayProgress,
  clockRule,
  clockRuleForDay,
  clockSecondsIntoDay,
  clockWeeksSinceEpoch,
  createClock,
} from '../index';
import type { DayRule } from '../index';
// A UTC moment, e.g. utc("2026-11-18 12:00:00"). The Swift test file had its
// own copy of this helper; here the shared one is used. It answers in Unix seconds.
import { utc } from './AudioTestHelpers';

// Ported from AsunderCore/Tests/AsunderCoreTests/AsunderClockTests.swift.
// One test here for each Swift test, with the same name, inputs and answers.

/// Swift's XCTAssertEqual(a, b, accuracy: e): the two numbers may differ by at most e.
function expectClose(actual: number, expected: number, accuracy: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(accuracy);
}

/// The seven days 0 (Sunday) ... 6 (Saturday). Swift wrote this as 0..<7.
const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

/// The seven rules of week `w`, Sunday first.
function week(w: number): DayRule[] {
  return daysOfWeek.map((k) => clockRuleForDay(k, w));
}

describe('AsunderClockTests', () => {
  const clock = createClock();

  // MARK: The epoch

  test('testEpochIsASundayAtMidnightUTC', () => {
    // (World.epoch is in Unix seconds; JavaScript's Date wants milliseconds.)
    const date = new Date(World.epoch * 1_000);
    // JavaScript counts Sunday as 0; Swift's calendar counts it as 1.
    const weekday = date.getUTCDay() + 1;
    expect(weekday).toBe(1); // weekday 1 is Sunday
    expect([date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]).toEqual([0, 0, 0]);
  });

  test('testEpochIsDayZeroSunday', () => {
    expect(clockDayIndex(clock, World.epoch)).toBe(0);
    expect(clockDayOfWeek(clock, World.epoch)).toBe(0);
    expect(clockWeeksSinceEpoch(clock, World.epoch)).toBe(0);
  });

  test('testOneSecondBeforeEpochIsTheSaturdayBefore', () => {
    const t = World.epoch - 1;
    expect(clockDayIndex(clock, t)).toBe(-1);
    expect(clockDayOfWeek(clock, t)).toBe(6);
    expect(clockWeeksSinceEpoch(clock, t)).toBe(-1);
  });

  // MARK: The day turn

  test('testDayTurnsAtMidnightUTC', () => {
    expect(clockDayIndex(clock, utc('2026-11-01 23:59:59'))).toBe(0);
    expect(clockDayIndex(clock, utc('2026-11-02 00:00:00'))).toBe(1);
  });

  test('testDayTurnHourMovesTheTurn', () => {
    // (`undefined` for the epoch means "use the shared world's epoch", as in Swift.)
    const late = createClock(undefined, 5);
    expect(clockDayIndex(late, utc('2026-11-02 04:59:59'))).toBe(0); // still Sunday
    expect(clockDayIndex(late, utc('2026-11-02 05:00:00'))).toBe(1); // now Monday
  });

  test('testDayProgress', () => {
    expectClose(clockDayProgress(clock, utc('2026-11-05 00:00:00')), 0, 1e-9);
    expectClose(clockDayProgress(clock, utc('2026-11-05 12:00:00')), 0.5, 1e-9);
    // works before the epoch too
    expectClose(clockDayProgress(clock, utc('2026-10-31 18:00:00')), 0.75, 1e-9);
  });

  // MARK: A known date, worked by hand
  // Wed 18 Nov 2026 is day 17 → k = 3 (Wednesday), w = 2.
  // (3 + 3·2) mod 7 = 2 → P[2] = S. A Still day.

  test('testKnownDate', () => {
    const t = utc('2026-11-18 12:00:00');
    expect(clockDayIndex(clock, t)).toBe(17);
    expect(clockDayOfWeek(clock, t)).toBe(3);
    expect(clockWeeksSinceEpoch(clock, t)).toBe(2);
    expect(clockRule(clock, t)).toBe(DAY_RULE_STILL);
  });

  // MARK: The week rule

  test('testPatternMatchesTheDoc', () => {
    expect(World.weekPattern.join('')).toBe('WLSRWSL');
  });

  test('testWeekZeroIsThePatternItself', () => {
    for (const k of daysOfWeek) {
      expect(clockRuleForDay(k, 0)).toBe(World.weekPattern[k]);
    }
  });

  test('testEachWeekAdvancesThreeDays', () => {
    // Week 1, Sunday reads P[3] = R.
    expect(clockRuleForDay(0, 1)).toBe(DAY_RULE_RECURRENCE);
    for (let w = -10; w <= 10; w += 1) {
      for (const k of daysOfWeek) {
        expect(clockRuleForDay(k, w + 1)).toBe(clockRuleForDay((k + 3) % 7, w));
      }
    }
  });

  test('testScheduleRepeatsEverySevenWeeksAndNotSooner', () => {
    for (let w = -14; w <= 14; w += 1) {
      expect(week(w)).toEqual(week(w + 7));
    }
    const firstSeven = daysOfWeek.map((w) => week(w));
    // all seven rotations are different
    expect(new Set(firstSeven.map((days) => days.join(''))).size).toBe(7);
  });

  test('testEveryWeekHasTwoStillsOneRTwoWTwoL', () => {
    for (let w = -10; w <= 10; w += 1) {
      const days = week(w);
      expect(days.filter((rule) => rule === DAY_RULE_STILL).length).toBe(2);
      expect(days.filter((rule) => rule === DAY_RULE_RECURRENCE).length).toBe(1);
      expect(days.filter((rule) => rule === DAY_RULE_WORLDLINE).length).toBe(2);
      expect(days.filter((rule) => rule === DAY_RULE_LIGHT_CONE).length).toBe(2);
    }
  });

  test('testSecondsIntoDay', () => {
    expectClose(clockSecondsIntoDay(clock, utc('2026-11-18 00:00:00')), 0, 1e-6);
    expectClose(clockSecondsIntoDay(clock, utc('2026-11-18 01:00:30')), 3_630, 1e-6);
    expectClose(clockSecondsIntoDay(clock, utc('2026-11-17 23:59:59')), 86_399, 1e-6);
    // before the epoch too
    expectClose(clockSecondsIntoDay(clock, utc('2026-10-25 06:00:00')), 21_600, 1e-6);
  });
});
