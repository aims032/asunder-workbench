import Foundation

// The tuning wheel as a physical object: it has weight, it coasts, it slows.
//
// How the app drives it, once per screen frame:
//   finger lands   → grab(at:)
//   finger moves   → drag(by:at:)     (delta already converted to band units by a DialForm)
//   finger lifts   → release(at:)     (measures the flick and lets the wheel coast)
//   every frame    → step(dt:)        (coasting, friction, and the needle catching up)
//
// While the finger is down, the wheel follows it exactly. No smoothing, no lag:
// a slow drag lands precisely where you put it. The weight only shows after you
// let go (the coast) and in the needle, which trails the wheel slightly.
//
// Internally the wheel's `rotation` is NOT wrapped. It counts up and down
// forever (2.3 means "spun around twice, now at 0.3"). That keeps the motion
// smooth across the seam where 0.999 meets 0.0. `position` is the wrapped value
// everything else reads. (Doubles stay precise to well under a detent for
// millions of trips around the band, so this never needs resetting.)

public struct DialPhysics {

    /// Where the wheel is, unwrapped. Use `position` unless you need continuity.
    public private(set) var rotation: Double
    /// Where the needle is, unwrapped. It chases `rotation`.
    public private(set) var needleRotation: Double
    /// Coasting speed in band units per second. Positive = up the band.
    public private(set) var velocity: Double = 0
    /// True while a finger is on the wheel.
    public private(set) var isHeld = false

    /// Recent finger positions, used to measure the flick on release.
    private var samples: [(time: Double, rotation: Double)] = []

    /// The wheel's place on the band, 0..<1.
    public var position: Double { wrapUnit(rotation) }
    /// The needle's place on the band, 0..<1. This is what the readout shows.
    public var needlePosition: Double { wrapUnit(needleRotation) }

    public init(position: Double = 0) {
        rotation = position
        needleRotation = position
    }

    // MARK: - Finger

    /// A finger lands on the wheel. Like grabbing a spinning wheel, it stops dead.
    public mutating func grab(at time: Double) {
        isHeld = true
        velocity = 0
        samples = [(time, rotation)]
    }

    /// The finger moved. `delta` is in band units (a DialForm converts from points).
    public mutating func drag(by delta: Double, at time: Double) {
        guard isHeld else { return }
        rotation += delta
        samples.append((time, rotation))
        trimSamples(before: time - Tuning.dialFlickWindow)
    }

    /// The finger lifts. The wheel keeps the speed the finger had at the end.
    public mutating func release(at time: Double) {
        guard isHeld else { return }
        isHeld = false
        samples.append((time, rotation))
        trimSamples(before: time - Tuning.dialFlickWindow)

        // Speed over the last stretch of the drag. If the finger had stopped
        // moving, every recent sample is gone except this one: no flick.
        guard let first = samples.first, samples.count >= 2, time - first.time > 1e-4 else {
            velocity = 0
            samples = []
            return
        }
        let measured = (rotation - first.rotation) / (time - first.time)
        velocity = min(max(measured, -Tuning.dialMaxSpeed), Tuning.dialMaxSpeed)
        samples = []
    }

    // MARK: - Time

    /// Advance the wheel and needle by `dt` seconds. Call once per frame.
    public mutating func step(dt rawDt: Double) {
        // A frame can arrive late (app returning from background, a hitch).
        // Cap it so one long frame can't fling the needle or skip the coast.
        let dt = min(max(rawDt, 0), 1.0 / 20.0)
        guard dt > 0 else { return }

        if !isHeld && velocity != 0 {
            coast(dt: dt)
        }

        // The needle closes a fixed share of the gap each frame. Computed with
        // exp() so the lag feels the same at 60 and 120 frames per second.
        if Tuning.needleLag > 0 {
            let catchUp = 1 - exp(-dt / Tuning.needleLag)
            needleRotation += (rotation - needleRotation) * catchUp
        } else {
            needleRotation = rotation
        }
    }

    private mutating func coast(dt: Double) {
        // Bearing grease: speed shrinks by a fixed fraction per second.
        velocity *= exp(-Tuning.dialFriction * dt)

        // Felt pad: a steady pull toward zero that never overshoots past it.
        let pull = Tuning.dialDryFriction * dt
        if abs(velocity) <= pull {
            velocity = 0
        } else {
            velocity -= pull * (velocity > 0 ? 1 : -1)
        }

        if abs(velocity) < Tuning.dialStopSpeed {
            velocity = 0
        }
        rotation += velocity * dt
    }

    private mutating func trimSamples(before cutoff: Double) {
        samples.removeAll { $0.time < cutoff }
    }
}
