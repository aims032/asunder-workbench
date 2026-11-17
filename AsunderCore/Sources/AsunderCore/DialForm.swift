// What kind of wheel the finger is touching. This is the only part that knows
// the wheel's shape: it turns finger movement on screen into band movement.
// DialPhysics doesn't care which one you use.
//
// OPEN: edge-on thumbwheel, face-on wheel, or knob (Instruments §0).
// Building the proposed thumbwheel now. A face-on wheel or knob would be
// another type here that measures the angle swept around its center instead.

/// Anything that turns a finger move into a band move.
public protocol DialForm {
    /// How far the band moves when the finger goes from `from` to `to`,
    /// both in screen points. Positive = up the band.
    func bandDelta(from: SIMD2<Double>, to: SIMD2<Double>) -> Double
}

/// The proposed form: a strip seen edge-on, rolled sideways with the thumb,
/// like the tuning wheel on an old pocket radio. Only sideways motion counts;
/// a thumb drifting up or down while it rolls doesn't change the tuning.
public struct Thumbwheel: DialForm {
    /// Band units per point of sideways travel. See Tuning.dialBandPerPoint.
    public var bandPerPoint: Double

    public init(bandPerPoint: Double = Tuning.dialBandPerPoint) {
        self.bandPerPoint = bandPerPoint
    }

    public func bandDelta(from: SIMD2<Double>, to: SIMD2<Double>) -> Double {
        (to.x - from.x) * bandPerPoint
    }
}
