import SwiftUI
import AsunderCore

/// Placeholder screen. It shows the shared clock and the band display working,
/// so you can check them on the phone. Chunk (b) replaces this with the dial.
struct ContentView: View {
    private let clock = AsunderClock()
    private let display = currentBandDisplay

    var body: some View {
        // TimelineView redraws once a second, so the readout follows the clock.
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            let rule = clock.rule(at: now)

            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 12) {
                    Text("ASUNDER")
                        .font(.system(.title3, design: .monospaced))
                        .foregroundStyle(.gray)

                    // e.g. "DAY 17 · WED · S"
                    Text("DAY \(clock.dayIndex(at: now)) · \(weekdayName(clock.dayOfWeek(at: now))) · \(rule.rawValue)")
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(.gray)

                    Text(rule.isStill ? "STILL" : "MOVING")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.gray.opacity(0.6))

                    // The band's ends and middle through the display mapping.
                    Text("\(display.label(at: BandPosition(0))) – \(display.label(at: BandPosition(0.5))) – \(display.label(at: BandPosition(0.9999)))")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.gray.opacity(0.5))
                }
            }
        }
    }

    private func weekdayName(_ k: Int) -> String {
        ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][k]
    }
}

#Preview {
    ContentView()
}
