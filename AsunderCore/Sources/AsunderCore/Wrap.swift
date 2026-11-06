// The band is a loop: positions run 0..<1 and wrap around.
// This is the one function everything else uses to keep a position on the loop.

/// Folds any number back onto the loop 0..<1.
/// 1.25 → 0.25, -0.1 → 0.9, 3.0 → 0.0.
public func wrapUnit(_ x: Double) -> Double {
    let r = x - x.rounded(.down)   // fractional part, always 0..<1 for finite x
    return r >= 1 ? 0 : r          // guards a float edge case where r rounds up to exactly 1
}
