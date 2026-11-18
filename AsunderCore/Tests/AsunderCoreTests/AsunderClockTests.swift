import XCTest
@testable import AsunderCore

final class AsunderClockTests: XCTestCase {
    let clock = AsunderClock()

    /// A UTC moment, e.g. utc("2026-11-18 12:00:00").
    func utc(_ s: String) -> Date {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f.date(from: s)!
    }

    // MARK: The epoch

    func testEpochIsASundayAtMidnightUTC() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let parts = cal.dateComponents([.weekday, .hour, .minute, .second], from: World.epoch)
        XCTAssertEqual(parts.weekday, 1, "weekday 1 is Sunday")
        XCTAssertEqual([parts.hour, parts.minute, parts.second], [0, 0, 0])
    }

    func testEpochIsDayZeroSunday() {
        XCTAssertEqual(clock.dayIndex(at: World.epoch), 0)
        XCTAssertEqual(clock.dayOfWeek(at: World.epoch), 0)
        XCTAssertEqual(clock.weeksSinceEpoch(at: World.epoch), 0)
    }

    func testOneSecondBeforeEpochIsTheSaturdayBefore() {
        let t = World.epoch.addingTimeInterval(-1)
        XCTAssertEqual(clock.dayIndex(at: t), -1)
        XCTAssertEqual(clock.dayOfWeek(at: t), 6)
        XCTAssertEqual(clock.weeksSinceEpoch(at: t), -1)
    }

    // MARK: The day turn

    func testDayTurnsAtMidnightUTC() {
        XCTAssertEqual(clock.dayIndex(at: utc("2026-11-01 23:59:59")), 0)
        XCTAssertEqual(clock.dayIndex(at: utc("2026-11-02 00:00:00")), 1)
    }

    func testDayTurnHourMovesTheTurn() {
        let late = AsunderClock(dayTurnHourUTC: 5)
        XCTAssertEqual(late.dayIndex(at: utc("2026-11-02 04:59:59")), 0, "still Sunday")
        XCTAssertEqual(late.dayIndex(at: utc("2026-11-02 05:00:00")), 1, "now Monday")
    }

    func testDayProgress() {
        XCTAssertEqual(clock.dayProgress(at: utc("2026-11-05 00:00:00")), 0, accuracy: 1e-9)
        XCTAssertEqual(clock.dayProgress(at: utc("2026-11-05 12:00:00")), 0.5, accuracy: 1e-9)
        XCTAssertEqual(clock.dayProgress(at: utc("2026-10-31 18:00:00")), 0.75, accuracy: 1e-9,
                       "works before the epoch too")
    }

    // MARK: A known date, worked by hand
    // Wed 18 Nov 2026 is day 17 → k = 3 (Wednesday), w = 2.
    // (3 + 3·2) mod 7 = 2 → P[2] = S. A Still day.

    func testKnownDate() {
        let t = utc("2026-11-18 12:00:00")
        XCTAssertEqual(clock.dayIndex(at: t), 17)
        XCTAssertEqual(clock.dayOfWeek(at: t), 3)
        XCTAssertEqual(clock.weeksSinceEpoch(at: t), 2)
        XCTAssertEqual(clock.rule(at: t), .still)
    }

    // MARK: The week rule

    func testPatternMatchesTheDoc() {
        XCTAssertEqual(World.weekPattern.map(\.rawValue).joined(), "WLSRWSL")
    }

    func testWeekZeroIsThePatternItself() {
        for k in 0..<7 {
            XCTAssertEqual(AsunderClock.rule(dayOfWeek: k, week: 0), World.weekPattern[k])
        }
    }

    func testEachWeekAdvancesThreeDays() {
        // Week 1, Sunday reads P[3] = R.
        XCTAssertEqual(AsunderClock.rule(dayOfWeek: 0, week: 1), .recurrence)
        for w in -10...10 {
            for k in 0..<7 {
                XCTAssertEqual(AsunderClock.rule(dayOfWeek: k, week: w + 1),
                               AsunderClock.rule(dayOfWeek: (k + 3) % 7, week: w))
            }
        }
    }

    func testScheduleRepeatsEverySevenWeeksAndNotSooner() {
        func week(_ w: Int) -> [DayRule] { (0..<7).map { AsunderClock.rule(dayOfWeek: $0, week: w) } }
        for w in -14...14 {
            XCTAssertEqual(week(w), week(w + 7))
        }
        let firstSeven = (0..<7).map(week)
        XCTAssertEqual(Set(firstSeven.map { $0.map(\.rawValue).joined() }).count, 7,
                       "all seven rotations are different")
    }

    func testEveryWeekHasTwoStillsOneRTwoWTwoL() {
        for w in -10...10 {
            let days = (0..<7).map { AsunderClock.rule(dayOfWeek: $0, week: w) }
            XCTAssertEqual(days.filter { $0 == .still }.count, 2)
            XCTAssertEqual(days.filter { $0 == .recurrence }.count, 1)
            XCTAssertEqual(days.filter { $0 == .worldline }.count, 2)
            XCTAssertEqual(days.filter { $0 == .lightCone }.count, 2)
        }
    }
}
