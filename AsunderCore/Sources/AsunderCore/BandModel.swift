import Foundation

// THE BAND
//
// A position on the band is a number in 0..<1 that wraps: the band is a loop
// (Confirmed Nov 6). Everything that lives on the band (the dial, the Carrier,
// later the weather and the transmissions) uses BandPosition, so no code ever
// has to remember to wrap by hand.
//
// What number the listener *sees* is a separate job: see BandDisplay below.
// Since Nov 19 that's a wide spectrum, from radio up through visible light
// (SpectrumDisplay). The old FM-looking band is kept as a simple example.

/// A place on the band. Always 0..<1.
public struct BandPosition: Equatable, Hashable {
    public let value: Double

    /// Any number works; it gets folded onto the loop. 1.2 becomes 0.2.
    public init(_ raw: Double) {
        value = wrapUnit(raw)
    }

    /// This position, moved along the band. Positive moves up, negative moves down,
    /// and moving past the top comes back in at the bottom.
    public func moved(by delta: Double) -> BandPosition {
        BandPosition(value + delta)
    }

    /// The shortest way from here to `other`, going around the loop either way.
    /// Positive means `other` is above, negative means below. Always -0.5..<0.5.
    ///
    /// From 0.95 to 0.05 this is +0.1 (across the seam), not -0.9.
    /// Signal strength uses this, so a feature near the seam is still easy to hear.
    public func distance(to other: BandPosition) -> Double {
        wrapUnit(other.value - value + 0.5) - 0.5
    }
}

/// How strong a feature sounds from a given distance: a bell curve.
/// 1 dead on center, about 0.6 at one `width` away, near 0 past three widths.
/// `width` is a fraction of the whole band (0.002 = 0.2% of it).
public func bellStrength(distance: Double, width: Double) -> Double {
    guard width > 0 else { return distance == 0 ? 1 : 0 }
    let x = distance / width
    return exp(-0.5 * x * x)
}

// MARK: - Display

/// Turns a band position into the number shown on the dial.
/// The app only talks to this protocol, so the band's numbers live in one place.
public protocol BandDisplay {
    /// The frequency for a position, in the display's own units.
    func frequency(at position: BandPosition) -> Double
    /// The number as the readout shows it, e.g. "19.93".
    func label(at position: BandPosition) -> String
    /// The unit that goes with that number, e.g. "MHz".
    func unit(at position: BandPosition) -> String
    /// Marks printed on the dial's scale. A label is nil for an unnumbered tick.
    func scaleMarks() -> [ScaleMark]
}

/// One mark on the printed scale.
public struct ScaleMark {
    public let position: BandPosition
    public let label: String?
}

/// SUPERSEDED Nov 19 by SpectrumDisplay: an FM-looking band, 87.5 to 108.0.
/// Kept as the simplest example of a BandDisplay.
/// Position 0 reads 87.5; just under 1 reads 108.0; then it loops back to 87.5.
public struct FMBandDisplay: BandDisplay {
    public var bottom: Double = 87.5
    public var top: Double = 108.0

    public init() {}

    public func frequency(at position: BandPosition) -> Double {
        bottom + position.value * (top - bottom)
    }

    public func label(at position: BandPosition) -> String {
        // One decimal, like a real FM readout. Built by hand rather than with
        // String(format:) so it's identical on every platform.
        let tenths = Int((frequency(at: position) * 10).rounded())
        return "\(tenths / 10).\(tenths % 10)"
    }

    public func unit(at position: BandPosition) -> String { "MHz" }

    /// A tick at every whole number (88 ... 107), numbered every 4 (88, 92 ... 104).
    /// 108 is skipped: it's the same spot as 87.5, where the loop joins.
    public func scaleMarks() -> [ScaleMark] {
        (88...107).map { mhz in
            ScaleMark(position: BandPosition((Double(mhz) - bottom) / (top - bottom)),
                      label: mhz % 4 == 0 ? "\(mhz)" : nil)
        }
    }
}

/// The display the app uses. Swap this one line to change the whole band's numbers.
public let currentBandDisplay: BandDisplay = SpectrumDisplay()
