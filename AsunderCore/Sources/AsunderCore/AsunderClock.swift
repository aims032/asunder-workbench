import Foundation

/// The rule a day runs on (Transmission Rules §3–4).
/// Phase 1 only cares whether a day is Still or moving; Phase 2 uses W, L and R.
public enum DayRule: String, CaseIterable {
    case worldline = "W"
    case lightCone = "L"
    case recurrence = "R"
    case still = "S"

    /// Still days hold everything: nothing moves, the static runs cooler.
    public var isStill: Bool { self == .still }
}

/// The shared clock. Every phone turns "now" into the same Asunder day.
///
/// The day number counts from the epoch: day 0 is the epoch's Sunday, day 1 is
/// Monday, day -1 is the Saturday before. Days turn at `World.dayTurnHourUTC`.
public struct AsunderClock {
    public static let secondsPerDay: Double = 86_400

    public let epoch: Date
    public let dayTurnHourUTC: Double

    /// Defaults to the shared world's values. Tests pass their own.
    public init(epoch: Date = World.epoch, dayTurnHourUTC: Double = World.dayTurnHourUTC) {
        self.epoch = epoch
        self.dayTurnHourUTC = dayTurnHourUTC
    }

    // MARK: Days

    /// Seconds since the most recent day turn at or before the epoch.
    /// This is the number every other answer is built from.
    private func secondsSinceFirstTurn(_ date: Date) -> Double {
        date.timeIntervalSince(epoch) - dayTurnHourUTC * 3_600
    }

    /// Which Asunder day it is. 0 on the epoch day; negative before it.
    /// Rounds down, so one second before the first turn is day -1, not day 0.
    public func dayIndex(at date: Date) -> Int {
        Int((secondsSinceFirstTurn(date) / Self.secondsPerDay).rounded(.down))
    }

    /// Day of the week, 0 = Sunday ... 6 = Saturday.
    public func dayOfWeek(at date: Date) -> Int {
        positiveModulo(dayIndex(at: date), 7)
    }

    /// Whole weeks since the epoch. Negative before it.
    public func weeksSinceEpoch(at date: Date) -> Int {
        floorDivide(dayIndex(at: date), 7)
    }

    /// How far through the current Asunder day we are, 0..<1.
    /// The Carrier's day-turn kink and the static's temperature will read this.
    public func dayProgress(at date: Date) -> Double {
        wrapUnit(secondsSinceFirstTurn(date) / Self.secondsPerDay)
    }

    /// Seconds since the most recent day turn, 0..<86400.
    public func secondsIntoDay(at date: Date) -> Double {
        dayProgress(at: date) * Self.secondsPerDay
    }

    // MARK: Rules

    /// The rule for a given day: P[(k + 3w) mod 7]. Pure math, no clock.
    public static func rule(dayOfWeek k: Int, week w: Int) -> DayRule {
        let slot = positiveModulo(k + World.weeklyAdvance * w, World.weekPattern.count)
        return World.weekPattern[slot]
    }

    /// The rule running at a moment in time.
    public func rule(at date: Date) -> DayRule {
        Self.rule(dayOfWeek: dayOfWeek(at: date), week: weeksSinceEpoch(at: date))
    }

    public func isStill(at date: Date) -> Bool {
        rule(at: date).isStill
    }
}

// MARK: - Integer helpers
// Swift's % keeps the sign of the left side (-1 % 7 == -1). For days before the
// epoch we need the mathematical version (-1 mod 7 == 6), so these do that.

func positiveModulo(_ a: Int, _ n: Int) -> Int {
    let r = a % n
    return r < 0 ? r + n : r
}

func floorDivide(_ a: Int, _ n: Int) -> Int {
    (a - positiveModulo(a, n)) / n
}
