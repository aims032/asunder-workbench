import Foundation

/// The receiver's signal chain, as a rack in code:
///
///     noise source (white + pink + brown) ─┐
///                                          ├─► high-pass ─► low-pass ─► out
///     Carrier oscillator ──────────────────┘   (the EQ path)
///
/// Static and signal share one chain (Instruments §2): the filters every
/// sound goes through open up when you're on a feature and close when you're not.
/// Later, a transmission's audio joins at the same point as the Carrier.
///
/// It makes sound one sample at a time and never allocates memory or waits,
/// so it's safe to run on the audio thread. It doesn't know about clocks or
/// dials: each buffer it's handed ReceiverTargets and glides every control toward them.
public struct ReceiverChain {
    public let sampleRate: Double

    // The modules.
    private var noise: NoiseSource
    private var carrier = CarrierOscillator()
    private var highpass = StateVariableFilter()
    private var lowpass = StateVariableFilter()

    // The knobs, each gliding toward its target (no clicks, no zipper noise).
    private var white: Smoothed
    private var pink: Smoothed
    private var brown: Smoothed
    private var carrierLevel: Smoothed
    private var carrierPitch: Smoothed
    private var highpassHz: Smoothed
    private var lowpassHz: Smoothed
    /// Fades the whole radio in when it turns on.
    private var power: Smoothed

    /// Filters are recalculated every this many samples (about 3,000 times a second at 48 kHz),
    /// which is smooth to the ear and much cheaper than every sample.
    private static let filterUpdateInterval = 16
    private var samplesUntilFilterUpdate = 0

    /// `seed` picks the noise sequence. Same seed, same static, sample for sample.
    /// It starts silent with the EQ closed and fades up (Tuning.powerOnFade).
    public init(sampleRate: Double, seed: UInt64) {
        self.sampleRate = sampleRate
        noise = NoiseSource(seed: seed)
        let follow = Tuning.soundFollowTime
        white = Smoothed(0, seconds: follow, sampleRate: sampleRate)
        pink = Smoothed(0, seconds: follow, sampleRate: sampleRate)
        brown = Smoothed(0, seconds: follow, sampleRate: sampleRate)
        carrierLevel = Smoothed(0, seconds: follow, sampleRate: sampleRate)
        carrierPitch = Smoothed(Tuning.humHz, seconds: follow, sampleRate: sampleRate)
        highpassHz = Smoothed(Tuning.closedHighpassHz, seconds: follow, sampleRate: sampleRate)
        lowpassHz = Smoothed(Tuning.closedLowpassHz, seconds: follow, sampleRate: sampleRate)
        power = Smoothed(0, seconds: Tuning.powerOnFade, sampleRate: sampleRate)
    }

    /// Fill `out` with `count` samples, gliding toward `targets`.
    public mutating func render(into out: UnsafeMutablePointer<Float>, count: Int, targets: ReceiverTargets) {
        for i in 0..<count {
            // 1. Every so often, re-aim the filters at where their cutoffs have glided to.
            if samplesUntilFilterUpdate == 0 {
                highpass.setCutoff(highpassHz.value, resonance: Tuning.receiverResonance, sampleRate: sampleRate)
                lowpass.setCutoff(lowpassHz.value, resonance: Tuning.receiverResonance, sampleRate: sampleRate)
                samplesUntilFilterUpdate = Self.filterUpdateInterval
            }
            samplesUntilFilterUpdate -= 1

            // 2. The static: three colors, mixed by temperature.
            let colors = noise.next()
            var sample = colors.white * white.step(toward: targets.white)
                       + colors.pink * pink.step(toward: targets.pink)
                       + colors.brown * brown.step(toward: targets.brown)

            // 3. The Carrier's whistle joins the static.
            let pitch = carrierPitch.step(toward: targets.carrierPitch)
            sample += carrier.next(pitch: pitch, sampleRate: sampleRate) * carrierLevel.step(toward: targets.carrierLevel)

            // 4. The EQ path. Everything goes through it.
            highpassHz.step(toward: targets.highpassHz)
            lowpassHz.step(toward: targets.lowpassHz)
            sample = highpass.process(sample).high
            sample = lowpass.process(sample).low

            // 5. Out, never past full scale.
            sample *= power.step(toward: 1)
            out[i] = Float(min(max(sample, -1), 1))
        }
    }

    /// Convenience for tests and tools: render into a new array.
    /// Allocates memory, so never call this on the audio thread.
    public mutating func render(count: Int, targets: ReceiverTargets) -> [Float] {
        var buffer = [Float](repeating: 0, count: count)
        buffer.withUnsafeMutableBufferPointer { render(into: $0.baseAddress!, count: count, targets: targets) }
        return buffer
    }
}
