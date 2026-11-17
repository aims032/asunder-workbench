import Foundation

// What the readout shows for a position. This is deliberately separate from
// the band itself: every rule works in 0..<1 positions, and only the screen
// turns them into numbers like "94.3".
//
// OPEN: whether the band is real FM (87.5–108.0) or an invented range.
// Until Evan decides, the app uses `BandDisplay.placeholder`. Changing the
// band range later means changing that one line, and no rule moves.

public struct BandDisplay {
    /// The number shown at position 0 (the bottom of the band).
    public let low: Double
    /// The number shown just before position wraps back to 0. Because the band
    /// is a loop, `high` and `low` are the same point on the dial.
    public let high: Double
    /// Decimal places in the readout.
    public let decimals: Int

    public init(low: Double, high: Double, decimals: Int) {
        self.low = low
        self.high = high
        self.decimals = decimals
    }

    /// Placeholder: the real FM broadcast band, in MHz.
    public static let placeholder = BandDisplay(low: 87.5, high: 108.0, decimals: 1)

    /// The readout value for a band position. Positions outside 0..<1 wrap first.
    public func value(at position: Double) -> Double {
        low + wrapUnit(position) * (high - low)
    }

    /// The readout as text, e.g. "94.3".
    public func label(at position: Double) -> String {
        String(format: "%.\(decimals)f", value(at: position))
    }
}
