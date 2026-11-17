import Foundation

// The band is a loop. Positions run 0..<1, and past 1 you arrive back at 0,
// like a wheel with no end stop. These are the measurements everything else
// uses to ask "how far is the dial from that thing?"

public enum Band {

    /// How far apart two positions are, going the short way around the loop.
    /// Always 0...0.5 (0.5 is the far side of the loop).
    /// Example: 0.95 and 0.05 are 0.1 apart, not 0.9.
    public static func distance(_ a: Double, _ b: Double) -> Double {
        abs(offset(from: a, to: b))
    }

    /// Which way, and how far, you'd turn the dial to get from `from` to `to`,
    /// taking the short way around. Positive = up the band, negative = down.
    /// Always in -0.5..<0.5.
    ///
    /// The sign matters later: tuning a little above a signal and a little
    /// below it can sound different through the EQ.
    public static func offset(from: Double, to: Double) -> Double {
        // Shift by 0.5, wrap, shift back: folds any difference into -0.5..<0.5.
        wrapUnit(to - from + 0.5) - 0.5
    }

    /// How strongly you hear a feature centered at `center` when the dial is at
    /// `dial`. 1 = dead on, 0.5 = exactly `bandwidth` away, falling smoothly
    /// toward 0 beyond that (a bell curve).
    ///
    /// `bandwidth` is in band units; the default comes from Tuning.
    public static func strength(
        dial: Double,
        center: Double,
        bandwidth: Double = Tuning.featureBandwidth
    ) -> Double {
        guard bandwidth > 0 else { return 0 }
        let d = distance(dial, center) / bandwidth
        // exp(-ln2 · d²) is a bell curve scaled so d = 1 gives exactly 0.5.
        return exp(-log(2.0) * d * d)
    }
}
