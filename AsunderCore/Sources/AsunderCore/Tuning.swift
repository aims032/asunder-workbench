// TUNING: every feel number in one place.
//
// These change how the receiver feels in your hand. They don't change the
// shared world (that's World.swift), so tweak them freely, rebuild, and feel
// the difference. Each one says what turning it up or down does.
//
// This file grows with each Phase 1 chunk: dial physics next, then the static.

public enum Tuning {

    // MARK: Band

    /// How far apart the detent ticks are, as a fraction of the whole band.
    /// 1/205 is one tick per 0.1 on the FM-looking display (20.5 wide / 0.1).
    /// Smaller = more ticks per turn, a finer and busier feel.
    /// Bigger = fewer, chunkier clicks.
    public static let detentSpacing: Double = 1.0 / 205.0
}
