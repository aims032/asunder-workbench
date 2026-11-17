import XCTest
@testable import AsunderCore

final class ClockTests: XCTestCase {

    let clock = AsunderClock()
    let epoch = AsunderClock.placeholderEpoch
    let day = AsunderClock.secondsPerDay

    func date(_ secondsSince1970: TimeInterval) -> Date {
        Date(timeIntervalSince1970: secondsSince1970)
    }

    // MARK: the epoch itself

    func testEpochIsDayZeroSundayWorldline() {
        let r = clock.reading(at: date(epoch))
        XCTAssertEqual(r.dayIndex, 0)
        XCTAssertEqual(r.weekIndex, 0)
        XCTAssertEqual(r.dayOfWeek, 0)
        XCTAssertEqual(r.rule, .worldline)
        XCTAssertEqual(r.secondsIntoDay, 0)
    }

    func testPlaceholderEpochIsASundayAtMidnightUTC() {
        // If someone changes the epoch to a non-Sunday, day-of-week breaks. Catch it here.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let parts = cal.dateComponents([.weekday, .hour, .minute, .second], from: date(epoch))
        XCTAssertEqual(parts.weekday, 1, "Calendar counts Sunday as 1")
        XCTAssertEqual(parts.hour, 0)
        XCTAssertEqual(parts.minute, 0)
        XCTAssertEqual(parts.second, 0)
    }

    func testDayOfWeekMatchesTheRealCalendar() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        // Noon on each of 400 days, starting well before the epoch.
        for d in -200..<200 {
            let t = epoch + Double(d) * day + day / 2
            let realWeekday = cal.component(.weekday, from: date(t)) - 1  // to 0 = Sunday
            XCTAssertEqual(clock.reading(at: date(t)).dayOfWeek, realWeekday, "day \(d)")
        }
    }

    // MARK: the day turn

    func testDayTurnsAtMidnightUTC() {
        let lastSecond = clock.reading(at: date(epoch + day - 1))
        let turn = clock.reading(at: date(epoch + day))
        XCTAssertEqual(lastSecond.dayIndex, 0)
        XCTAssertEqual(turn.dayIndex, 1)
        XCTAssertEqual(turn.secondsIntoDay, 0)
    }

    func testTheSecondBeforeTheEpochIsTheSaturdayBefore() {
        let r = clock.reading(at: date(epoch - 1))
        XCTAssertEqual(r.dayIndex, -1)
        XCTAssertEqual(r.weekIndex, -1)
        XCTAssertEqual(r.dayOfWeek, 6)
        XCTAssertEqual(r.secondsIntoDay, day - 1)
        // P[(6 + 3·(-1)) mod 7] = P[3] = R
        XCTAssertEqual(r.rule, .recurrence)
    }

    // MARK: the week rule

    func testWeekZeroIsTheBasePattern() {
        let rules = (0..<7).map { clock.reading(at: date(epoch + Double($0) * day)).rule }
        XCTAssertEqual(rules, AsunderClock.pattern)
        XCTAssertEqual(rules.map(\.rawValue).joined(), "WLSRWSL")
    }

    func testEachWeekShiftsThreeDays() {
        // Week 1 starts where P[3] is: R, W, S, L, W, L, S
        let week1 = (0..<7).map { AsunderClock.rule(dayOfWeek: $0, week: 1) }
        XCTAssertEqual(week1.map(\.rawValue).joined(), "RWSLWLS")
    }

    func testScheduleRepeatsEvery49Days() {
        for d in -100..<100 {
            let a = clock.reading(at: date(epoch + Double(d) * day + 3600)).rule
            let b = clock.reading(at: date(epoch + Double(d + 49) * day + 3600)).rule
            XCTAssertEqual(a, b, "day \(d)")
        }
    }

    func testScheduleDoesNotRepeatSooner() {
        // 49 is the real period: no shorter shift makes the whole schedule line up.
        let rules = (0..<98).map { AsunderClock.rule(dayOfWeek: $0 % 7, week: $0 / 7) }
        for shift in 1..<49 {
            let lines = (0..<49).allSatisfy { rules[$0] == rules[$0 + shift] }
            XCTAssertFalse(lines, "repeats after \(shift) days")
        }
    }

    func testEveryWeekHasTwoStillsOneRTwoWTwoL() {
        for w in -10..<10 {
            let week = (0..<7).map { AsunderClock.rule(dayOfWeek: $0, week: w) }
            XCTAssertEqual(week.filter(\.isStill).count, 2, "week \(w)")
            XCTAssertEqual(week.filter { $0 == .recurrence }.count, 1)
            XCTAssertEqual(week.filter { $0 == .worldline }.count, 2)
            XCTAssertEqual(week.filter { $0 == .lightCone }.count, 2)
        }
    }

    func testAKnownDate() {
        // Tuesday, Nov 17, 2026, 21:00 UTC: 16 days after the epoch.
        // w = 2, k = 2 → P[(2 + 6) mod 7] = P[1] = L
        let r = clock.reading(at: date(epoch + 16 * day + 21 * 3600))
        XCTAssertEqual(r.dayIndex, 16)
        XCTAssertEqual(r.weekIndex, 2)
        XCTAssertEqual(r.dayOfWeek, 2)
        XCTAssertEqual(r.rule, .lightCone)
        XCTAssertEqual(r.secondsIntoDay, 21 * 3600)
    }

    // MARK: helpers

    func testPositiveModAndFloorDiv() {
        XCTAssertEqual(positiveMod(-1, 7), 6)
        XCTAssertEqual(positiveMod(-7, 7), 0)
        XCTAssertEqual(positiveMod(8, 7), 1)
        XCTAssertEqual(floorDiv(-1, 7), -1)
        XCTAssertEqual(floorDiv(-7, 7), -1)
        XCTAssertEqual(floorDiv(-8, 7), -2)
        XCTAssertEqual(floorDiv(6, 7), 0)
    }
}
