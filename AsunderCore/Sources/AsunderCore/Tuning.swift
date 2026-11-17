// Every "feel" number in the receiver lives here, and only here.
//
// To make the app feel different, change a number in this file and run it
// again. Each constant says what it does to the feel. Nothing else in the
// code should hard-code a feel value; it should read it from Tuning.
//
// Units: positions are "band units" (the whole band = 1.0; on the placeholder
// FM band, 0.01 ≈ 0.2 MHz). Times are seconds. Finger travel is screen points.
//
// Sections get added as Phase 1 grows: Band and Dial now; Haptics and Static next.

public enum Tuning {

    // MARK: - Band

    /// How wide a feature is on the band: the distance from its center at which
    /// you hear it at half strength. Measured in band units (the whole band = 1.0).
    ///
    /// Smaller = a needle-thin signal you have to hunt for; larger = a broad
    /// smear you can't miss. 0.004 is about 0.08 MHz on the placeholder FM band,
    /// roughly the width of one real station.
    public static let featureBandwidth: Double = 0.004

    // MARK: - Dial: the hand

    /// How far the band moves per screen point of finger travel on the thumbwheel.
    /// This is the gearing. Bigger = fast and coarse (less finger to cross the band);
    /// smaller = slow and precise. Make it negative to flip the direction.
    /// 0.0005 means a 300-point swipe moves 0.15 of the band (about 3 MHz on FM),
    /// and the whole band takes about seven full-width swipes.
    public static let dialBandPerPoint: Double = 0.0005

    /// How quickly a flicked wheel loses speed, like the grease in the bearing.
    /// Each second, speed is multiplied by e^(−this). 2.0 → it keeps about 14%
    /// of its speed after one second. Lower = long, floaty coasts; higher = heavy.
    public static let dialFriction: Double = 2.0

    /// A steady drag that brings the wheel to a definite stop instead of creeping
    /// forever, like a felt pad touching the rim. In band units per second, per second.
    /// Higher = the end of a coast feels abrupt; 0 = it slows, and slows, and slows.
    public static let dialDryFriction: Double = 0.05

    /// Below this speed (band units per second) a coasting wheel just stops.
    public static let dialStopSpeed: Double = 0.001

    /// The fastest a flick can spin the wheel, in band units per second.
    /// 3.0 = three full trips around the band per second. Keeps a wild flick sane.
    public static let dialMaxSpeed: Double = 3.0

    /// How much of the end of a drag counts toward the flick, in seconds.
    /// The release speed is measured over this last stretch. If the finger sat still
    /// longer than this before letting go, there's no flick: the wheel stays put.
    /// Shorter = only a real snap of the thumb flicks; longer = flicks happen easily.
    public static let dialFlickWindow: Double = 0.06

    // MARK: - Dial: the needle

    /// How far the needle and readout lag behind the wheel, in seconds.
    /// It's the time to cover about two-thirds of the gap. 0 = welded to the wheel
    /// (feels cheap and digital); 0.05 = a slight, weighty follow; 0.2 = mushy.
    public static let needleLag: Double = 0.05

    // MARK: - Dial: detents

    /// How many detent ticks there are in one trip around the band.
    /// Keep it a whole number so a tick sits exactly on the seam where the loop joins.
    /// 205 = one tick every 0.1 MHz on the placeholder FM band, about 10 points of
    /// finger travel at the gearing above. More = a fine buzz; fewer = chunky clicks.
    public static let detentsPerBand: Int = 205
}
