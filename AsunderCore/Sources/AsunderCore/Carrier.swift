import Foundation

/// The Carrier: a faint tone at a fixed place on the band (Instruments §3).
/// It never moves. Every day turn it drops out for a moment, on every phone at once.
///
/// You hear it as a zero-beat whistle, like tuning a shortwave set: off to the
/// side it's a high whistle, and as you tune toward it the pitch slides down,
/// settling to a low hum dead on center (Confirmed Nov 19).
public enum Carrier {

    /// Where it lives. See World.swift.
    public static var position: BandPosition { World.carrierPosition }

    /// How far the dial is from the Carrier, in detents. Positive = the Carrier
    /// is above the dial. Takes the short way round the loop.
    public static func detentsAway(from dial: BandPosition) -> Double {
        dial.distance(to: position) / Tuning.detentSpacing
    }

    /// False during the dropout right after each day turn.
    public static func isOnAir(at date: Date, clock: AsunderClock) -> Bool {
        clock.secondsIntoDay(at: date) >= World.carrierDropoutSeconds
    }

    /// How loud it is from `detents` away, 0...1 (a bell curve, Tuning.carrierWidth wide).
    public static func strength(detentsAway detents: Double) -> Double {
        bellStrength(distance: detents, width: Tuning.carrierWidth)
    }

    /// How "clear" the reception is from `detents` away, 0...1: how far the
    /// EQ path opens and the hiss quiets. A narrower bell (Tuning.clearWidth).
    public static func clarity(detentsAway detents: Double) -> Double {
        bellStrength(distance: detents, width: Tuning.clearWidth)
    }

    /// The whistle's pitch from `detents` away, in Hz. The further off, the higher;
    /// the same on either side. Dead on, it's the hum.
    public static func pitch(detentsAway detents: Double) -> Double {
        Tuning.humHz + Tuning.whistleHzPerDetent * abs(detents)
    }
}

/// The oscillator that makes the Carrier's tone: a sine with a little 2nd and
/// 3rd harmonic. The pitch can change every sample and the waveform stays smooth.
public struct CarrierOscillator {
    /// Where in its cycle the wave is, 0..<1.
    private var phase = 0.0

    public init() {}

    /// The next sample at `pitch` Hz, between -1 and 1.
    public mutating func next(pitch: Double, sampleRate: Double) -> Double {
        // An overtone above half the sample rate can't be played; it would fold
        // back down as a wrong note ("aliasing"). Drop any that would.
        let nyquist = sampleRate / 2
        let h2 = 2 * pitch < nyquist ? Tuning.carrierSecondHarmonic : 0
        let h3 = 3 * pitch < nyquist ? Tuning.carrierThirdHarmonic : 0
        let angle = 2 * Double.pi * phase
        let wave = sin(angle) + h2 * sin(2 * angle) + h3 * sin(3 * angle)

        phase += pitch / sampleRate
        phase -= phase.rounded(.down)  // keep it in 0..<1 so it never loses precision

        return wave / (1 + h2 + h3)
    }
}
