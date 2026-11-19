/// Decides when to play the "centered on a feature" pulse.
///
/// It fires once when the wheel arrives on a feature's center, or spins
/// straight across it, and not again until the wheel has moved away
/// (Tuning.lockRelease) and come back. Sitting on the center doesn't repeat it.
public struct LockDetector {
    /// True from the pulse until the wheel moves away again.
    public private(set) var isLocked = false
    /// Last frame's distance, to notice a fast spin jumping across the center.
    private var previous: Double?

    public init() {}

    /// Feed it the distance from the wheel to the feature, in detents, once a frame.
    /// Returns true on the frame the pulse should play.
    public mutating func update(detentsAway distance: Double) -> Bool {
        defer { previous = distance }

        if isLocked {
            if abs(distance) > Tuning.lockRelease { isLocked = false }
            return false
        }

        // A fast spin can jump from one side to the other between frames without
        // ever landing near the center. A change of sign means it crossed.
        // (Small jumps only: the distance also flips sign on the far side of the loop.)
        let crossed = previous.map { prev in
            (prev < 0) != (distance < 0) && abs(prev - distance) < Self.farSideOfTheLoop
        } ?? false

        if abs(distance) <= Tuning.lockDistance || crossed {
            isLocked = true
            return true
        }
        return false
    }

    /// Any jump bigger than this between two frames is the distance wrapping
    /// round the far side of the loop, not a crossing. A quarter of the band in
    /// detents is far more than one frame of the fastest flick covers.
    private static let farSideOfTheLoop = 0.25 / Tuning.detentSpacing
}
