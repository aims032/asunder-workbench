import Foundation

// WHAT THE RECEIVER SHOULD SOUND LIKE RIGHT NOW
//
// Two inputs: where the dial is, and what time it is. Out comes a handful of
// numbers (ReceiverTargets) that the sound engine glides toward. All of it is
// computed from the shared clock, so every phone tuned to the same spot at the
// same moment gets the same numbers.

/// How hot the static runs, 0...1: 1 on moving days, 0 on Still days
/// (Instruments §2; physics reading, Confirmed Nov 19).
public enum NoiseTemperature {

    /// Right after each day turn it glides from yesterday's temperature to
    /// today's over Tuning.temperatureGlide seconds.
    public static func at(_ date: Date, clock: AsunderClock) -> Double {
        let today = temperature(of: clock.rule(at: date))
        let secondsIn = clock.secondsIntoDay(at: date)
        guard Tuning.temperatureGlide > 0, secondsIn < Tuning.temperatureGlide else { return today }

        let yesterday = temperature(of: clock.rule(at: date.addingTimeInterval(-AsunderClock.secondsPerDay)))
        let t = secondsIn / Tuning.temperatureGlide
        let eased = t * t * (3 - 2 * t)  // starts and ends gently (a "smoothstep")
        return yesterday + (today - yesterday) * eased
    }

    /// Moving days are hot, Still days are cold.
    public static func temperature(of rule: DayRule) -> Double {
        rule.isStill ? 0 : 1
    }
}

/// Where every control of the sound should be. The engine eases toward these.
public struct ReceiverTargets: Equatable {
    /// Static: how loud each color plays (temperature, quieting and volume applied).
    public var white: Double
    public var pink: Double
    public var brown: Double
    /// The Carrier: how loud, 0...1, and the whistle's pitch in Hz.
    public var carrierLevel: Double
    public var carrierPitch: Double
    /// The EQ path: the band of frequencies let through, in Hz.
    public var highpassHz: Double
    public var lowpassHz: Double

    public init(white: Double, pink: Double, brown: Double,
                carrierLevel: Double, carrierPitch: Double,
                highpassHz: Double, lowpassHz: Double) {
        self.white = white
        self.pink = pink
        self.brown = brown
        self.carrierLevel = carrierLevel
        self.carrierPitch = carrierPitch
        self.highpassHz = highpassHz
        self.lowpassHz = lowpassHz
    }
}

public enum Reception {

    /// The targets for a dial position (unwrapped is fine) at a moment.
    /// Cheap and allocation-free, so the audio thread calls it every buffer.
    public static func targets(dial: Double, at date: Date, clock: AsunderClock) -> ReceiverTargets {
        let detents = Carrier.detentsAway(from: BandPosition(dial))

        // During the day-turn dropout the Carrier is gone, so it's as if it weren't there.
        let onAir = Carrier.isOnAir(at: date, clock: clock) ? 1.0 : 0.0
        let strength = onAir * Carrier.strength(detentsAway: detents)
        let clarity = onAir * Carrier.clarity(detentsAway: detents)

        // The static: today's temperature, quieted by a clear carrier.
        let temperature = NoiseTemperature.at(date, clock: clock)
        var color = NoiseColor.between(Tuning.coldStatic, Tuning.hotStatic, temperature)
        color.level *= Tuning.staticVolume * (1 - Tuning.carrierQuieting * clarity)
        let gains = color.gains

        // The EQ path opens with clarity. Frequencies are blended on a musical
        // (logarithmic) scale, so halfway open sounds halfway.
        let highpass = blendHz(Tuning.closedHighpassHz, Tuning.openHighpassHz, clarity)
        let lowpass = blendHz(Tuning.closedLowpassHz, Tuning.openLowpassHz, clarity)

        return ReceiverTargets(white: gains.white, pink: gains.pink, brown: gains.brown,
                               carrierLevel: Tuning.carrierVolume * strength,
                               carrierPitch: Carrier.pitch(detentsAway: detents),
                               highpassHz: highpass, lowpassHz: lowpass)
    }

    /// Part way from `a` Hz to `b` Hz, measured in octaves rather than Hz.
    static func blendHz(_ a: Double, _ b: Double, _ t: Double) -> Double {
        a * pow(b / a, t)
    }
}
