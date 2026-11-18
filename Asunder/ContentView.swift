import SwiftUI
import AsunderCore

/// Phase 1 bench, placeholder layout: the clock up top, the readout and scale
/// in the middle, the wheel at the bottom. Plain drawings only: the real look
/// is Evan's artwork in Phase 4, and how much room the dial gets is OPEN.
struct ContentView: View {
    @State private var dial = DialModel()
    private let clock = AsunderClock()
    private let display = currentBandDisplay

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                clockLine
                    .padding(.top, 12)

                Spacer()

                // The readout follows the needle, so it lags the hand slightly too.
                Text(display.label(at: dial.needle))
                    .font(.system(size: 64, weight: .light, design: .monospaced))
                    .foregroundStyle(Color(white: 0.85))
                    .monospacedDigit()

                BandScaleView(needle: dial.needle, display: display)
                    .frame(height: 44)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)

                Spacer()

                // To try another dial form, swap EdgeWheelForm() for it here.
                DialView(model: dial, form: EdgeWheelForm())
                    .frame(height: 80)
                    .padding(.horizontal, 28)
                    .padding(.bottom, 28)
            }
        }
    }

    /// "DAY 17 · WED · S · STILL", refreshed once a second.
    private var clockLine: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            let rule = clock.rule(at: now)
            let weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][clock.dayOfWeek(at: now)]
            Text("DAY \(clock.dayIndex(at: now)) · \(weekday) · \(rule.rawValue) · \(rule.isStill ? "STILL" : "MOVING")")
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.gray)
        }
    }
}

#Preview {
    ContentView()
}
