// TUNING: every feel number in one place.
//
// These change how the receiver feels in your hand. They don't change the
// shared world (that's World.swift), so tweak them freely, rebuild, and feel
// the difference. Each one says what turning it up or down does.
//
// Units: most dial numbers are in DETENTS (one tick = one 0.1 step on the
// FM-looking readout). "Detents per second" is how fast the wheel turns.

public enum Tuning {

    // MARK: Band

    /// How far apart the detent ticks are, as a fraction of the whole band.
    /// 1/205 is one tick per 0.1 on the FM-looking display (20.5 wide / 0.1).
    /// Smaller = more ticks per lap, a finer and busier feel.
    /// Bigger = fewer, chunkier clicks.
    public static let detentSpacing: Double = 1.0 / 205.0

    // MARK: Dial: the hand

    /// How far your finger slides (in screen points) to turn one detent.
    /// Smaller = a "fast" dial, a short swipe covers lots of band.
    /// Bigger = a slow, precise dial. 14 is about a fingertip's width per 0.3.
    public static let pointsPerDetent: Double = 14

    /// How quickly the flick speed is read from your finger, in seconds.
    /// Smaller = the coast follows the last instant of the swipe (twitchy).
    /// Bigger = it averages more of the swipe (smoother, a bit less direct).
    public static let flickSmoothing: Double = 0.035

    /// The fastest a flick can spin the wheel, in detents per second.
    /// 205 is one full lap of the band per second.
    public static let maxFlickSpeed: Double = 300

    // MARK: Dial: the coast

    /// How fast a spinning wheel slows down. This is the "weight" of the wheel.
    /// Smaller = a heavy flywheel that coasts a long way.
    /// Bigger = a light wheel in thick grease that stops soon after you let go.
    /// (Speed falls by about 1 - e^-friction every second: 1.6 loses ~80%/s.)
    public static let coastFriction: Double = 1.6

    /// Below this speed (detents per second) a coasting wheel stops spinning
    /// and drops into the next notch.
    /// Bigger = it gives up sooner and clicks in; smaller = it creeps longer.
    public static let settleSpeed: Double = 4

    /// How quickly the wheel seats into a notch once it's slow, per second.
    /// Bigger = a snappy click-in. Smaller = a soft, lazy settle.
    /// Set to 0 for no notches at all: the wheel just stops wherever it is.
    public static let settleRate: Double = 14

    // MARK: Dial: the needle and readout

    /// How far the needle and readout lag behind the wheel, in seconds.
    /// 0 = locked to the wheel (feels digital). 0.07 = a slight, physical lag.
    /// 0.2+ = a lazy, heavy needle that swings in after you.
    public static let needleLag: Double = 0.07

    /// Safety cap on one physics step, in seconds. If the phone stalls,
    /// the wheel won't leap across the band when it catches up. Rarely touched.
    public static let maxFrameStep: Double = 1.0 / 20.0

    // MARK: Haptics

    /// Most detent ticks the phone will play per second during a fast spin.
    /// Real detents blur into a buzz when spun fast; this keeps it a texture.
    /// Bigger = busier buzz on flicks. Smaller = sparser, more "sampled" ticks.
    public static let maxTicksPerSecond: Double = 45

    /// Detent tick strength, 0...1. Bigger = a harder knock.
    public static let tickIntensity: Float = 0.55

    /// Detent tick sharpness, 0...1. Bigger = a crisp click; smaller = a dull thud.
    public static let tickSharpness: Float = 0.85

    /// The "centered on a feature" pulse (used once the Carrier arrives).
    /// Strength 0...1, sharpness 0...1, and length in seconds. It should feel
    /// clearly different from a tick: rounder and longer.
    public static let lockIntensity: Float = 1.0
    public static let lockSharpness: Float = 0.3
    public static let lockDuration: Double = 0.09
}
