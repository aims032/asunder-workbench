import Foundation

// The shared clock. Every phone reads the same UTC time, subtracts the same
// epoch, and so agrees on what day it is in the Asunder and which rule governs
// it. No phone talks to any other; they agree because they do the same math.
//
// The week rule (Transmission Rules §4):
//
//     P = [W, L, S, R, W, S, L]        S = Still day
//     rule(k, w) = P[(k + 3w) mod 7]   k = day of week (0 = Sunday), w = weeks since epoch
//
// The pattern shifts three days each week, so the whole schedule repeats
// every 7 weeks (49 days).

/// Which rule governs a day. W, L and R are the moving days; S is Still.
public enum DayRule: String, CaseIterable {
    case worldline = "W"
    case lightCone = "L"
    case recurrence = "R"
    case still = "S"

    /// Still days: nothing hops, the band holds.
    public var isStill: Bool { self == .still }
}

/// Everything the clock says about one moment.
public struct ClockReading: Equatable {
    /// Days since the epoch. Day 0 is the epoch's own day; negative before it.
    public let dayIndex: Int
    /// Weeks since the epoch (w in the rule).
    public let weekIndex: Int
    /// Day of the week, 0 = Sunday ... 6 = Saturday (k in the rule).
    public let dayOfWeek: Int
    /// The rule for this day.
    public let rule: DayRule
    /// Seconds since this day turned, 0..<86400.
    public let secondsIntoDay: Double
}

public struct AsunderClock {

    /// The base week pattern P. Index 0 lines up with Sunday of week 0.
    public static let pattern: [DayRule] = [
        .worldline, .lightCone, .still, .recurrence, .worldline, .still, .lightCone,
    ]

    /// OPEN: the real Asunder epoch. Placeholder: Sunday, Nov 1, 2026, 00:00 UTC.
    /// It must stay a Sunday at the day turn, or day-of-week will be wrong
    /// (a test checks this). Stored as seconds since 1970 so there's no
    /// time-zone math anywhere.
    public static let placeholderEpoch: TimeInterval = 1_793_491_200

    /// PROPOSED, still OPEN: when the day turns, as seconds after 00:00 UTC.
    /// 0 means the day turns at midnight UTC (7pm Eastern in winter).
    public static let dayTurnOffset: TimeInterval = 0

    public static let secondsPerDay: TimeInterval = 86_400

    public let epoch: TimeInterval

    public init(epoch: TimeInterval = AsunderClock.placeholderEpoch) {
        self.epoch = epoch
    }

    /// The rule for day-of-week `k` in week `w`. Works for negative weeks too.
    public static func rule(dayOfWeek k: Int, week w: Int) -> DayRule {
        pattern[positiveMod(k + 3 * w, 7)]
    }

    /// Read the clock at a moment.
    public func reading(at date: Date) -> ClockReading {
        let sinceEpoch = date.timeIntervalSince1970 - epoch - Self.dayTurnOffset
        // floor, not truncation, so the second before the epoch is day -1, not day 0.
        let dayIndex = Int((sinceEpoch / Self.secondsPerDay).rounded(.down))
        let week = floorDiv(dayIndex, 7)
        let k = positiveMod(dayIndex, 7)
        return ClockReading(
            dayIndex: dayIndex,
            weekIndex: week,
            dayOfWeek: k,
            rule: Self.rule(dayOfWeek: k, week: week),
            secondsIntoDay: sinceEpoch - Double(dayIndex) * Self.secondsPerDay
        )
    }
}

// Swift's % keeps the sign of the left side (-1 % 7 == -1). The clock needs
// the math kind, where -1 mod 7 == 6, so days before the epoch still land on
// the right weekday.
func positiveMod(_ a: Int, _ n: Int) -> Int {
    let r = a % n
    return r < 0 ? r + n : r
}

// Division that rounds down, so -1 / 7 == -1 (the week before the epoch), not 0.
func floorDiv(_ a: Int, _ n: Int) -> Int {
    (a - positiveMod(a, n)) / n
}
