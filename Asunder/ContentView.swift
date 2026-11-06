import SwiftUI
import AsunderCore

/// Placeholder screen for Phase 0. It only proves three things:
/// the app runs, it links AsunderCore, and the screen is grayscale.
/// Phase 1 replaces this with the dial.
struct ContentView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 8) {
                Text("ASUNDER")
                    .font(.system(.title3, design: .monospaced))
                    .foregroundStyle(.gray)
                // Calls into AsunderCore; if this shows "0.25", the package is linked.
                Text(String(format: "%.2f", wrapUnit(1.25)))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.gray.opacity(0.5))
            }
        }
    }
}

#Preview {
    ContentView()
}
