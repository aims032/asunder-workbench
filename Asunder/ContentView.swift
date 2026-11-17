import SwiftUI
import AsunderCore

/// Phase 1 bench: readout, scale, signal meter, and the thumbwheel.
/// Plain placeholder layout. Where things sit and how big they are is Open,
/// and the real look waits for Evan's art (Phase 4).
struct ContentView: View {
    @State private var dial = DialModel()

    var body: some View {
        ZStack {
            Color(white: 0.08).ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                ReadoutPicture(text: dial.readout)

                ScalePicture(needle: dial.physics.needlePosition, display: .placeholder)
                    .frame(height: 28)

                SignalMeterPicture(level: dial.signal, locked: dial.isLocked)
                    .frame(height: 6)

                Spacer()

                ThumbwheelControl(model: dial)
                    .frame(height: 72)
                    .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)
        }
        .onAppear { dial.start() }
        .onDisappear { dial.stop() }
    }
}

#Preview {
    ContentView()
}
