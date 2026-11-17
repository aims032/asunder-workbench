// Two small pieces of judgment the haptics need, kept here so they're tested.

/// Decides when you've landed on a feature, so the lock pulse plays once on
/// arrival, not every frame you sit there.
///
/// It uses two thresholds (hysteresis, like a Schmitt trigger): strength has to
/// climb past `on` to lock, and fall below `off` to unlock. Without the gap, a
/// thumb resting right at the edge would flicker in and out and stutter pulses.
public struct LockDetector {
    public private(set) var isLocked = false

    public init() {}

    /// Feed the current strength once per frame.
    /// Returns true only on the frame the lock is gained (that's when to pulse).
    public mutating func update(
        strength: Double,
        on: Double = Tuning.lockOnStrength,
        off: Double = Tuning.lockOffStrength
    ) -> Bool {
        if isLocked {
            if strength < off { isLocked = false }
            return false
        }
        if strength >= on {
            isLocked = true
            return true
        }
        return false
    }
}

/// Keeps detent ticks from piling up on a fast spin. When ticks are crossed
/// faster than `minInterval`, the extras are skipped.
public struct TickThrottle {
    private var lastPlayed = -Double.infinity

    public init() {}

    /// `ticks` is how many detents were just crossed. Returns true if a tick
    /// should play now. Times are in seconds, on any steady clock.
    public mutating func shouldPlay(
        ticks: Int,
        at time: Double,
        minInterval: Double = Tuning.tickMinInterval
    ) -> Bool {
        guard ticks > 0, time - lastPlayed >= minInterval else { return false }
        lastPlayed = time
        return true
    }
}
