import SwiftUI

/// The shape of the dial: how a finger turns it, and how it's drawn.
///
/// The dial's form is OPEN (Instruments §0): an edge-on wheel, a face-on wheel,
/// or a knob. The physics doesn't care which; each form only answers two things.
/// To try a different form, write another type that conforms to this and swap
/// it in ContentView. That's the only line that changes.
///
/// Phase 1 forms are plain placeholder drawings. Evan's artwork replaces the
/// `face` in Phase 4; the gesture math stays.
protocol DialForm {
    associatedtype Face: View

    /// How many detents the wheel turns when a finger moves from `from` to `to`
    /// inside a dial of this `size`. Positive = up the band.
    func detents(from: CGPoint, to: CGPoint, in size: CGSize) -> Double

    /// The dial drawn at a given turn (detents, unwrapped: keeps counting past a lap).
    func face(wheelDetents: Double) -> Face
}
