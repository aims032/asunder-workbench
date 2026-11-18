import SwiftUI

/// Puts a dial form on screen and turns touches into the model's
/// grab / drag / release. Works with any DialForm.
struct DialView<Form: DialForm>: View {
    let model: DialModel
    let form: Form

    /// Where the finger was last frame. nil when nothing is touching.
    @State private var lastTouch: CGPoint?

    var body: some View {
        GeometryReader { geo in
            form.face(wheelDetents: model.wheelDetents)
                .contentShape(Rectangle())  // the whole area is touchable
                .gesture(
                    // minimumDistance 0: the wheel stops the instant you touch it.
                    DragGesture(minimumDistance: 0)
                        .onChanged { touch in
                            if lastTouch == nil {
                                model.grab()
                                lastTouch = touch.startLocation
                            }
                            let turned = form.detents(from: lastTouch!, to: touch.location, in: geo.size)
                            lastTouch = touch.location
                            model.drag(detents: turned)
                        }
                        .onEnded { _ in
                            lastTouch = nil
                            model.release()
                        }
                )
        }
    }
}
