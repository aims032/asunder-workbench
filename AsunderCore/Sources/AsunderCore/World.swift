import Foundation

// THE LAWS OF THE BAND
//
// Everything in this file must be identical on every phone, because every
// phone computes the same band from the same clock. Change a value here and
// you've changed the shared world: phones with the old value and phones with
// the new one will disagree about what day it is and where things are.
//
// That's different from Tuning.swift, which only changes how the app feels
// in your hand and is safe to tweak per build.
//
// Several of these are OPEN in /docs. They're placeholders until Evan decides.

public enum World {

    // MARK: Clock

    /// The Asunder epoch: day 0 of the shared clock.
    /// OPEN (CLAUDE.md §5). Placeholder: Sunday 1 Nov 2026, 00:00 UTC.
    /// It must be a Sunday at 00:00 UTC, because day-of-week is counted from it.
    public static let epoch = Date(timeIntervalSince1970: 1_793_491_200)

    /// Hours after 00:00 UTC that the Asunder day turns over.
    /// PROPOSED: 0 (= 7pm Eastern in winter). Still OPEN in Build Foundation §11.
    /// A story-meaningful hour would go here, e.g. 5 for 05:00 UTC.
    public static let dayTurnHourUTC: Double = 0

    // MARK: The week (Transmission Rules §4, Proposed)

    /// The base week, Sunday first. S = Still day.
    ///     P = [W, L, S, R, W, S, L]
    /// Each week the pattern advances three days: rule(k, w) = P[(k + 3w) mod 7].
    public static let weekPattern: [DayRule] = [
        .worldline, .lightCone, .still, .recurrence, .worldline, .still, .lightCone,
    ]

    /// How many days the pattern shifts each week. 3 and 7 share no factors,
    /// so the schedule visits all 7 rotations and repeats every 7 weeks (49 days).
    public static let weeklyAdvance = 3
}
