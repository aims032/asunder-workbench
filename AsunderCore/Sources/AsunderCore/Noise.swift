import Foundation

// THE STATIC: three colors of noise, made one sample at a time.
//
//   white  hiss     every frequency equally loud
//   pink   room     each octave equally loud (sounds even to the ear)
//   brown  rumble   lows much louder than highs
//
// How the three are mixed is the "noise temperature" (NoiseColor, below).
// Nothing here repeats: the random numbers come from a generator whose
// sequence is 2^64 samples long (millions of years at 48 kHz).

/// A fast random number generator that is safe to run on the audio thread
/// (no locks, no memory allocation). Same seed, same sequence, on every machine.
/// This is xorshift64* (Vigna, 2014).
public struct NoiseRandom {
    private var state: UInt64

    public init(seed: UInt64) {
        // Scramble the seed (SplitMix64), so nearby seeds like 1 and 2 still give
        // unrelated sequences. The state must never be zero, or it gets stuck at zero.
        var z = seed &+ 0x9E37_79B9_7F4A_7C15
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        z ^= z >> 31
        state = z == 0 ? 0x2545_F491_4F6C_DD1D : z
    }

    /// The next raw 64-bit number.
    public mutating func next() -> UInt64 {
        state ^= state >> 12
        state ^= state << 25
        state ^= state >> 27
        return state &* 0x2545_F491_4F6C_DD1D
    }

    /// The next number between -1 and 1, evenly spread.
    public mutating func nextSigned() -> Double {
        // The top 53 bits make a Double in 0..<1, then stretch to -1..<1.
        Double(next() >> 11) * 0x1p-53 * 2 - 1
    }
}

/// Makes all three colors at once from one white noise stream.
/// Each color comes out at about the same loudness (RMS ~0.3), so the
/// temperature weights alone decide the mix.
public struct NoiseSource {
    private var random: NoiseRandom

    // Pink filter memory (Paul Kellet's "refined" pink filter: seven
    // gentle filters summed, accurate to within 0.05 dB across the audio band).
    private var b0 = 0.0, b1 = 0.0, b2 = 0.0, b3 = 0.0, b4 = 0.0, b5 = 0.0, b6 = 0.0
    // Brown filter memory.
    private var brownState = 0.0

    // Loudness matching. Measured, not derived: see NoiseTests.
    private static let whiteScale = 0.52
    private static let pinkScale = 0.169
    private static let brownScale = 0.514

    /// How much each brown sample remembers the last one. Just under 1 makes a
    /// rumble that can't drift away; the "leak" sits at about 38 Hz at 48 kHz.
    private static let brownMemory = 0.995

    public init(seed: UInt64) {
        random = NoiseRandom(seed: seed)
    }

    /// The next sample of each color.
    public mutating func next() -> (white: Double, pink: Double, brown: Double) {
        let w = random.nextSigned()

        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        let pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
        b6 = w * 0.115926

        // Brown: each sample is mostly the last one plus a little new noise.
        brownState = Self.brownMemory * brownState + w * 0.1

        return (w * Self.whiteScale, pink * Self.pinkScale, brownState * Self.brownScale)
    }
}

/// A noise temperature: how much of each color, and how loud.
/// Tuning.swift holds the two presets (hot for moving days, cold for Still days).
public struct NoiseColor: Equatable {
    public var white: Double
    public var pink: Double
    public var brown: Double
    /// Overall loudness of this temperature. 1 = the reference level.
    public var level: Double

    public init(white: Double, pink: Double, brown: Double, level: Double) {
        self.white = white
        self.pink = pink
        self.brown = brown
        self.level = level
    }

    /// How loud each color plays. The weights only set the color: they're
    /// rescaled so the mix is equally loud whatever they are, and `level` alone
    /// sets how loud it is. (0.5, 0.5, 0) and (1, 1, 0) sound the same.
    public var gains: (white: Double, pink: Double, brown: Double) {
        let power = (white * white + pink * pink + brown * brown).squareRoot()
        guard power > 0 else { return (0, 0, 0) }
        let scale = level / power
        return (white * scale, pink * scale, brown * scale)
    }

    /// Part way from `cold` to `hot`. t = 0 is cold, 1 is hot.
    public static func between(_ cold: NoiseColor, _ hot: NoiseColor, _ t: Double) -> NoiseColor {
        func mix(_ a: Double, _ b: Double) -> Double { a + (b - a) * t }
        return NoiseColor(white: mix(cold.white, hot.white),
                          pink: mix(cold.pink, hot.pink),
                          brown: mix(cold.brown, hot.brown),
                          level: mix(cold.level, hot.level))
    }
}
