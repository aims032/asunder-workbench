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
    /// CAREFUL: the Carrier (World.carrierPosition = 68/205) must sit exactly on
    /// a notch, or the wheel can never settle dead on it (a test checks). Only
    /// spacings of 1/205, 1/410, 1/615... keep it there. Any other value means
    /// moving the Carrier too, and that changes the shared world.
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
    /// (Nov 19: down from 0.55, which Evan found jarring on the phone.)
    public static let tickIntensity: Float = 0.35

    /// Detent tick sharpness, 0...1. Bigger = a crisp click; smaller = a dull thud.
    /// (Nov 19: down from 0.85 for the same reason.)
    public static let tickSharpness: Float = 0.6

    /// Ticks get softer the faster the wheel spins, the way real detents blur
    /// into a buzz. This is the spin speed (detents per second) at which a tick
    /// plays at half strength. Smaller = ticks fade sooner on a flick.
    /// Bigger = every tick stays firm even at full spin.
    public static let tickSoftenSpeed: Double = 60

    /// The tick strengths the phone has ready, as shares of tickIntensity,
    /// firmest first. Each tick plays whichever is closest to what the spin speed
    /// asks for. The last one is the softest a fast spin can get, however low
    /// tickSoftenSpeed is set. Add a smaller entry (e.g. 0.15) to let flicks fade further.
    public static let tickStrengthSteps: [Float] = [1.0, 0.75, 0.5, 0.3]

    /// The "centered on a feature" pulse. Strength 0...1, sharpness 0...1, and
    /// length in seconds. It should feel clearly different from a tick:
    /// rounder and longer. (Nov 19: strength down from 1.0 to match the softer ticks.)
    public static let lockIntensity: Float = 0.75
    public static let lockSharpness: Float = 0.3
    public static let lockDuration: Double = 0.09

    /// How close to a feature's center (in detents) counts as "centered" and
    /// plays the lock pulse. 0.25 = only when the wheel sits on the feature's notch.
    /// Spinning straight past the center also counts, so a flick still bumps.
    public static let lockDistance: Double = 0.25

    /// How far (in detents) you have to move off a feature before coming back
    /// plays the lock pulse again. 0.75 = one notch away and back re-arms it.
    /// Bigger = rocking around the center doesn't keep re-pulsing.
    public static let lockRelease: Double = 0.75

    // MARK: Sound: the static

    /// Overall loudness of the static, 0...1 (before the phone's volume).
    /// This is the whole radio's master level; the Carrier sits on top of it.
    public static let staticVolume: Double = 0.5

    /// The static on a moving day: HOT. More energy, so brighter: hiss leads.
    /// (Physics reading, Confirmed Nov 19: hotter noise has more highs.)
    /// The three weights set the color (only their ratio matters);
    /// `level` sets how loud. Both presets are relative to staticVolume.
    public static let hotStatic = NoiseColor(white: 0.55, pink: 0.40, brown: 0.15, level: 1.0)

    /// The static on a Still day: COLD. The hiss drains out and leaves a low,
    /// quiet rumble. Lower `level` = a quieter Still day.
    public static let coldStatic = NoiseColor(white: 0.06, pink: 0.30, brown: 0.70, level: 0.55)

    // (How long the static takes to glide from hot to cold at a day turn is in
    // World.swift, because every phone should shift at the same moment.)

    // MARK: Sound: the receiver's EQ path
    //
    // Everything you hear goes through one filter path: the static, the Carrier,
    // and later the transmissions. Off any feature the path is CLOSED (thin, like
    // a radio between stations). Dead on a feature it OPENS (full and wide).

    /// Lowest frequency let through when closed / open, in Hz.
    /// Bigger closed value = thinner static off-station. Heads up: this only
    /// changes things below about 200 Hz, which headphones play and the
    /// iPhone's speaker mostly doesn't. On the speaker, "closed" is heard as
    /// duller (the low-pass below), not thinner. To hear thin on the speaker,
    /// the closed value would need to be 300-500 Hz, which also thins out the
    /// Still-day rumble.
    public static let closedHighpassHz: Double = 140
    public static let openHighpassHz: Double = 45

    /// Highest frequency let through when closed / open, in Hz.
    /// Smaller closed value = duller static between stations.
    public static let closedLowpassHz: Double = 4_500
    public static let openLowpassHz: Double = 12_000

    /// How peaky the two filters are. 0.707 = smooth, no peak. Around 1.2 adds
    /// a slight nasal "radio speaker" honk at the edges of the band.
    public static let receiverResonance: Double = 0.8

    // MARK: Sound: the Carrier

    /// How loud the Carrier is dead on, 0...1. It's meant to be faint.
    public static let carrierVolume: Double = 0.14

    /// How wide the Carrier is heard, in detents (its bandwidth). Its loudness
    /// is a bell curve: full at center, ~60% at this many detents off, nearly
    /// gone at three times this. Bigger = easier to find; smaller = a needle in a haystack.
    public static let carrierWidth: Double = 4

    /// How close you have to be (in detents) before the EQ path opens and the
    /// hiss quiets. Narrower than carrierWidth, so only the center notch sounds
    /// truly clean. Bigger = the "arrival" starts further out.
    public static let clearWidth: Double = 0.6

    /// How much the hiss drops when you're dead on, 0...1. 0.6 = down to 40%.
    /// (Real FM does this: a carrier "quiets" the noise.) 0 = no quieting.
    public static let carrierQuieting: Double = 0.6

    /// The zero-beat whistle (Confirmed Nov 19). Its pitch is the distance to
    /// the center: this many Hz per detent off, on top of the hum. As you tune
    /// in, the whistle slides down. Bigger = steeper slide, each notch a bigger jump.
    public static let whistleHzPerDetent: Double = 350

    /// The pitch the whistle settles to dead on center: the low hum, in Hz.
    /// iPhone speakers barely play below ~200 Hz, so on the speaker you mostly
    /// hear the hum through its overtones; on headphones, the note itself too.
    /// (Nov 19: up from 110, which all but vanished on the speaker.)
    public static let humHz: Double = 165

    /// Overtones on the Carrier's tone, 0...1 each: 2nd and 3rd harmonic.
    /// 0 and 0 = a pure sine. More = buzzier, more like mains hum, and easier
    /// to hear on a phone speaker. These carry the hum on the speaker.
    public static let carrierSecondHarmonic: Double = 0.8
    public static let carrierThirdHarmonic: Double = 0.5

    /// Extra loudness for the hum dead on center, on top of the bell curve.
    /// 0.6 = 60% louder. Without it, a phone speaker makes the center sound
    /// quieter than one notch off (low notes don't come through), so the
    /// "arrival" would feel like a dip. 0 = follow the bell curve exactly.
    public static let humBoost: Double = 0.6

    // MARK: Sound: response

    /// How quickly the sound follows the wheel, in seconds. Every level, pitch
    /// and filter glides this fast toward where it should be.
    /// Smaller = snappier but can click; bigger = smoother, slightly behind the hand.
    public static let soundFollowTime: Double = 0.015

    /// The radio fades in over about this many seconds when it turns on.
    public static let powerOnFade: Double = 0.4

    /// How much audio the phone works on at once, in seconds. Smaller = the
    /// sound reacts to the dial sooner but costs more battery. iOS treats this
    /// as a request and may pick something else (especially with the screen off).
    public static let audioBufferSeconds: Double = 0.01
}
