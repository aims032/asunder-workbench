// Every "feel" number in the receiver lives here, and only here.
//
// To make the app feel different, change a number in this file and run it
// again. Each constant says what it does to the feel. Nothing else in the
// code should hard-code a feel value; it should read it from Tuning.
//
// Sections get added as Phase 1 grows: Band now; Dial, Haptics and Static next.

public enum Tuning {

    // MARK: - Band

    /// How wide a feature is on the band: the distance from its center at which
    /// you hear it at half strength. Measured in band units (the whole band = 1.0).
    ///
    /// Smaller = a needle-thin signal you have to hunt for; larger = a broad
    /// smear you can't miss. 0.004 is about 0.08 MHz on the placeholder FM band,
    /// roughly the width of one real station.
    public static let featureBandwidth: Double = 0.004
}
