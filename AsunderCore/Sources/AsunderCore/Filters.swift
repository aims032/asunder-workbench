import Foundation

// Building blocks for the receiver's sound: a filter and a smoother.

/// A state-variable filter: the same kind of 12 dB/octave multimode filter
/// that's in a lot of synths, giving low-pass, high-pass and band-pass from one circuit.
///
/// This is Andrew Simper's "trapezoidal" design (Cytomic, 2013). Its cutoff
/// can be swept while audio runs through it without clicks or blowing up,
/// which matters because the receiver's filters move whenever you tune.
public struct StateVariableFilter {
    // The filter's memory (two integrators).
    private var ic1 = 0.0
    private var ic2 = 0.0
    // Coefficients, recalculated whenever the cutoff or resonance changes.
    private var a1 = 0.0, a2 = 0.0, a3 = 0.0, k = 0.0

    public init() {
        setCutoff(1_000, resonance: 0.707, sampleRate: 48_000)
    }

    /// `hz` is the cutoff. `resonance` is the Q: 0.707 is flat (no peak),
    /// higher adds a peak at the cutoff.
    public mutating func setCutoff(_ hz: Double, resonance: Double, sampleRate: Double) {
        // Keep the cutoff inside the range the math can handle.
        let safeHz = min(max(hz, 10), sampleRate * 0.45)
        let g = tan(Double.pi * safeHz / sampleRate)
        k = 1 / max(resonance, 0.1)
        a1 = 1 / (1 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
    }

    /// Runs one sample through and returns all three outputs.
    public mutating func process(_ input: Double) -> (low: Double, band: Double, high: Double) {
        let v3 = input - ic2
        let v1 = a1 * ic1 + a2 * v3
        let v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        return (low: v2, band: v1, high: input - k * v1 - v2)
    }
}

/// A value that glides toward its target instead of jumping, so controls
/// that move (the dial, a level, a filter) never click or "zipper".
/// It covers about 63% of the remaining distance every `seconds`.
public struct Smoothed {
    public private(set) var value: Double
    private var coefficient: Double

    public init(_ start: Double, seconds: Double, sampleRate: Double) {
        value = start
        coefficient = seconds > 0 ? 1 - exp(-1 / (seconds * sampleRate)) : 1
    }

    /// Move one sample's worth toward `target`, and return the new value.
    @discardableResult
    public mutating func step(toward target: Double) -> Double {
        value += (target - value) * coefficient
        return value
    }
}
