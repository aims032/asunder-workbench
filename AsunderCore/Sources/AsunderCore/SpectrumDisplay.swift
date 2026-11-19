import Foundation

/// THE WIDE BAND (Confirmed Nov 19): the dial covers a huge stretch of the
/// spectrum, from radio up through infrared and visible light, not an FM band.
///
/// The numbers are spaced logarithmically: every tenfold stretch (1 to 10 MHz,
/// 10 to 100 MHz, ...) gets the same room on the dial, the way wideband
/// analyzers draw it. Spaced evenly, the top end would swallow nearly the whole dial.
///
/// Position 0 reads the bottom frequency. Going up, the number multiplies by
/// the same amount for every step, and past the top it loops back to the bottom.
public struct SpectrumDisplay: BandDisplay {
    /// The ends of the band, in Hz. Evan chose "radio through light" and
    /// decided the top stops at light, not the string (Planck) scale. The exact
    /// numbers are PLACEHOLDERS: 3 kHz is the bottom of radio; 1,000 THz is
    /// just past violet light.
    public var bottomHz: Double = 3e3
    public var topHz: Double = 1e15

    public init() {}

    /// How many tenfold stretches the band covers (about 11.5).
    public var decades: Double { log10(topHz / bottomHz) }

    /// The frequency at a position, in Hz.
    public func frequency(at position: BandPosition) -> Double {
        bottomHz * pow(topHz / bottomHz, position.value)
    }

    /// The other way round: where on the band a frequency (in Hz) sits.
    public func position(ofHz hz: Double) -> BandPosition {
        BandPosition(log10(hz / bottomHz) / decades)
    }

    public func label(at position: BandPosition) -> String {
        Self.readout(hz: frequency(at: position)).number
    }

    public func unit(at position: BandPosition) -> String {
        Self.readout(hz: frequency(at: position)).unit
    }

    /// A numbered mark at every power of ten ("10k", "1M", "100G" ...), and
    /// small unnumbered marks at 2 and 5 times each one, like log graph paper.
    public func scaleMarks() -> [ScaleMark] {
        var marks: [ScaleMark] = []
        var power = 1e3
        while power < topHz {
            for (step, numbered) in [(1.0, true), (2.0, false), (5.0, false)] {
                let hz = power * step
                // Skip the very ends: the top is the same spot as the bottom.
                guard hz > bottomHz, hz < topHz else { continue }
                marks.append(ScaleMark(position: position(ofHz: hz),
                                       label: numbered ? Self.shortLabel(hz: hz) : nil))
            }
            power *= 10
        }
        return marks
    }

    // MARK: Writing the numbers

    /// The units the readout uses, smallest first.
    private static let units: [(name: String, hz: Double)] = [
        ("kHz", 1e3), ("MHz", 1e6), ("GHz", 1e9), ("THz", 1e12),
    ]

    /// A frequency as four significant digits and a unit: "3.000 kHz",
    /// "19.93 MHz", "172.8 GHz". Four digits is enough for neighboring notches
    /// to read differently. Built by hand (no String(format:)) so it reads the
    /// same on every platform.
    static func readout(hz: Double) -> (number: String, unit: String) {
        // The biggest unit that keeps the number at 1 or more.
        var unitIndex = units.lastIndex { hz >= $0.hz } ?? 0
        var value = hz / units[unitIndex].hz

        // Four significant digits: 3 after the point below 10, 2 below 100, 1 below 1000.
        var decimals = value < 10 ? 3 : value < 100 ? 2 : 1
        var digits = Int((value * pow(10, Double(decimals))).rounded())

        // Rounding can carry over: 9.9996 becomes 10.000, 999.96 becomes 1000.0.
        if digits >= 10_000 {
            if decimals > 1 {
                decimals -= 1
            } else if unitIndex < units.count - 1 {
                unitIndex += 1
                value /= 1000
                decimals = 3
            } else {
                decimals = 0  // the very top of the band: "1000 THz"
            }
            digits = Int((value * pow(10, Double(decimals))).rounded())
        }

        let text = String(digits)
        let number = decimals == 0
            ? text
            : String(text.dropLast(decimals)) + "." + String(text.suffix(decimals))
        return (number, units[unitIndex].name)
    }

    /// Short scale labels for powers of ten: "10k", "100M", "1T".
    static func shortLabel(hz: Double) -> String {
        let r = readout(hz: hz)
        let whole = r.number.split(separator: ".").first.map(String.init) ?? r.number
        return whole + String(r.unit.prefix(1))
    }
}
