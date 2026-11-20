import Foundation

/// The physics of the tuning wheel: inertia, friction, notches, and the
/// lagging needle. No drawing and no touch handling here, just the motion,
/// so it can be tested anywhere and any dial form (wheel, knob) can share it.
///
/// Positions are in band fractions and are NOT wrapped: spin forward forever
/// and `position` keeps climbing (3.25 means three laps plus a quarter).
/// That keeps the motion smooth across the seam. Use `band` / `needleBand`
/// when you want the place on the loop.
///
/// How it's driven, once per screen frame:
///     grab()            finger down: the wheel stops dead under it
///     drag(by:)         finger moved: the wheel follows it exactly
///     release()         finger up: the wheel keeps the finger's speed
///     step(dt)          time passes: coast, slow down, settle into a notch
public struct DialPhysics {

    /// Where the wheel is (unwrapped band fraction).
    public private(set) var position: Double
    /// How fast it's turning (band fractions per second). 0 when held still or stopped.
    public private(set) var velocity: Double = 0
    /// Where the needle/readout is. Chases `position` with a slight lag.
    public private(set) var needle: Double
    /// True while a finger is on the wheel.
    public private(set) var isHeld = false

    /// Places the wheel snaps onto when it comes to rest nearby (feature centers).
    /// The app keeps this up to date; see Tuning.snapToFeature.
    public var snapPoints: [BandPosition] = []

    /// The notch the wheel is easing into after it slowed down, if any.
    private var settleTarget: Double?
    /// Finger movement since the last step, used to measure flick speed.
    private var pendingDrag: Double = 0

    public init(start: Double) {
        position = start
        needle = start
    }

    // MARK: Reading it

    public var band: BandPosition { BandPosition(position) }
    public var needleBand: BandPosition { BandPosition(needle) }

    /// Which notch the wheel is nearest. Changes halfway between notches,
    /// which is where a real detent clicks (going over the hump).
    public var detentIndex: Int { Self.detentIndex(of: position) }

    public static func detentIndex(of position: Double) -> Int {
        Int((position / Tuning.detentSpacing).rounded())
    }

    /// Nothing is moving: no finger, no spin, no settling, needle caught up.
    /// The app can stop redrawing until the next touch.
    public var isAtRest: Bool {
        !isHeld && velocity == 0 && settleTarget == nil && needle == position
    }

    // MARK: Driving it

    public mutating func grab() {
        isHeld = true
        velocity = 0
        settleTarget = nil
        pendingDrag = 0
    }

    /// The finger moved the wheel by `delta` (band fraction). Tracks exactly.
    public mutating func drag(by delta: Double) {
        position += delta
        pendingDrag += delta
    }

    public mutating func release() {
        isHeld = false
        pendingDrag = 0
        let limit = Tuning.maxFlickSpeed * Tuning.detentSpacing
        velocity = min(max(velocity, -limit), limit)

        // Let go slowly (or not moving): drop into the nearest notch.
        if abs(velocity) < Tuning.settleSpeed * Tuning.detentSpacing {
            velocity = 0
            beginSettle(towards: nil)
        }
    }

    /// Advance time by `dt` seconds.
    public mutating func step(_ dt: Double) {
        let dt = min(dt, Tuning.maxFrameStep)
        guard dt > 0 else { return }

        if isHeld {
            // Measure how fast the finger is moving, smoothed, so that on
            // release the wheel carries on at that speed. A finger that stops
            // and then lifts reads ~0, so it doesn't flick.
            let instant = pendingDrag / dt
            velocity += (instant - velocity) * ease(dt, over: Tuning.flickSmoothing)
            pendingDrag = 0

        } else if let target = settleTarget {
            // Seating into a notch.
            position += (target - position) * ease(dt, over: 1 / Tuning.settleRate)
            if abs(target - position) < Tuning.detentSpacing * 0.001 {
                position = target
                settleTarget = nil
            }

        } else if velocity != 0 {
            // Coasting: friction takes away a fixed share of speed each second.
            velocity *= exp(-Tuning.coastFriction * dt)
            position += velocity * dt
            if abs(velocity) < Tuning.settleSpeed * Tuning.detentSpacing {
                let direction = velocity
                velocity = 0
                beginSettle(towards: direction)
            }
        }

        // The needle chases the wheel.
        needle += (position - needle) * ease(dt, over: Tuning.needleLag)
        if !isHeld && abs(position - needle) < Tuning.detentSpacing * 0.001 {
            needle = position
        }
    }

    // MARK: Helpers

    /// Start easing into a notch. Moving forward, take the next notch ahead
    /// (no backwards jerk); with no direction, take the nearest one.
    /// But if a feature's center is close to where the wheel is, settle on the
    /// feature instead (lock-on snap).
    /// Does nothing when notches are turned off (settleRate = 0).
    private mutating func beginSettle(towards direction: Double?) {
        guard Tuning.settleRate > 0 else { return }
        if let feature = snapPoint(near: position) {
            settleTarget = feature
            return
        }
        let inDetents = position / Tuning.detentSpacing
        let notch: Double
        switch direction {
        case let d? where d > 0: notch = inDetents.rounded(.up)
        case let d? where d < 0: notch = inDetents.rounded(.down)
        default:                 notch = inDetents.rounded()
        }
        settleTarget = notch * Tuning.detentSpacing
    }

    /// The nearest snap point to `place`, if one is within Tuning.snapToFeature.
    /// Returned unwrapped, on the same lap as `place`, so the wheel doesn't spin round to it.
    private func snapPoint(near place: Double) -> Double? {
        let reach = Tuning.snapToFeature * Tuning.detentSpacing
        var best: Double?
        var bestGap = Double.infinity
        for point in snapPoints {
            let gap = BandPosition(place).distance(to: point)   // the short way round
            if abs(gap) <= reach && abs(gap) < bestGap {
                best = place + gap
                bestGap = abs(gap)
            }
        }
        return best
    }

    /// The share of the remaining gap to close in `dt`, for a smooth chase
    /// that takes about `tau` seconds. Same feel at 60 or 120 frames a second.
    private func ease(_ dt: Double, over tau: Double) -> Double {
        tau <= 0 ? 1 : 1 - exp(-dt / tau)
    }
}
