// Detents: the evenly spaced clicks you feel as the wheel turns.
//
// This only counts them. The haptics layer (in the app) asks after every frame
// "how many did we cross?" and plays the ticks. A fast spin can cross several
// in one frame; it's up to haptics whether to play them all or thin them out.
//
// The ticks belong to the wheel, not the needle: you feel the hardware under
// your thumb, and the needle catches up after.

public struct DetentCounter {
    /// Ticks in one trip around the band. See Tuning.detentsPerBand.
    public let perBand: Int
    private var lastIndex: Int

    /// Start counting from the wheel's current unwrapped rotation.
    public init(startingAt rotation: Double, perBand: Int = Tuning.detentsPerBand) {
        self.perBand = max(perBand, 1)
        self.lastIndex = Self.index(of: rotation, perBand: self.perBand)
    }

    /// Feed the wheel's unwrapped rotation (DialPhysics.rotation, not .position,
    /// so crossing the seam isn't mistaken for a full trip around).
    /// Returns how many detents were crossed since the last call, in either direction.
    public mutating func update(rotation: Double) -> Int {
        let index = Self.index(of: rotation, perBand: perBand)
        let crossed = abs(index - lastIndex)
        lastIndex = index
        return crossed
    }

    /// Which detent slot a rotation is in. Ticks sit at 0, 1/perBand, 2/perBand, ...
    static func index(of rotation: Double, perBand: Int) -> Int {
        Int((rotation * Double(perBand)).rounded(.down))
    }
}
