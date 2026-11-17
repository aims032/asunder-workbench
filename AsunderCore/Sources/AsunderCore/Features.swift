// Fixed things on the band.
//
// Phase 1 has one: the Carrier, a faint steady tone that never moves
// (Instruments §3). Every phone has it in the same place because the
// position is a constant, not something computed or random.

public enum Features {
    /// PLACEHOLDER: where the Carrier sits on the band. It never moves.
    /// 0.33 reads as 94.3 on the placeholder FM band. Evan picks the real spot.
    public static let carrierPosition: Double = 0.33
}
