import SwiftUI
import AsunderCore

/// Placeholder printed scale with a needle, like the glass on a radio.
/// The whole band runs left to right; the needle slides along it and,
/// because the band is a loop, goes off the right edge and comes in on the left.
struct BandScaleView: View {
    let needle: BandPosition
    let display: BandDisplay

    var body: some View {
        Canvas { context, size in
            let w = Double(size.width), h = Double(size.height)

            // Scale marks: numbered ones are taller.
            for mark in display.scaleMarks() {
                let x = mark.position.value * w
                let tall = mark.label != nil
                var tick = Path()
                tick.move(to: CGPoint(x: x, y: h))
                tick.addLine(to: CGPoint(x: x, y: h - (tall ? 14 : 7)))
                context.stroke(tick, with: .color(.gray.opacity(tall ? 0.8 : 0.4)), lineWidth: 1)

                if let label = mark.label {
                    context.draw(Text(label).font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(Color.gray),
                                 at: CGPoint(x: x, y: h - 24))
                }
            }

            // The needle.
            let x = needle.value * w
            var line = Path()
            line.move(to: CGPoint(x: x, y: 0))
            line.addLine(to: CGPoint(x: x, y: h))
            context.stroke(line, with: .color(.white), lineWidth: 1.5)
        }
    }
}
