import SwiftUI
import AsunderCore

// PLACEHOLDER PICTURES. Evan makes the real artwork in Phase 4.
//
// Each control is split in two:
//   - a *Picture* that only draws, given numbers (swap this for the art), and
//   - a *Control* that handles the finger and talks to DialModel (keep this).

// MARK: - Thumbwheel

/// Draws an edge-on wheel: a cylinder seen from the side, its ridges bunching
/// up toward the edges as they roll away from you. Ridges are spaced one per
/// detent, so what you see lines up with what you feel.
struct ThumbwheelPicture: View {
    /// The wheel's unwrapped rotation (DialPhysics.rotation).
    let rotation: Double

    var body: some View {
        Canvas { context, size in
            let radius = Double(size.width) / 2
            // Surface distance between ridges, in points: one detent's worth of finger travel.
            let spacing = (1.0 / Double(Tuning.detentsPerBand)) / Tuning.dialBandPerPoint
            guard spacing.isFinite, abs(spacing) > 0.5 else { return }

            // Only the fractional part of the turn matters for where ridges sit.
            let turned = rotation * Double(Tuning.detentsPerBand)
            let shift = turned - turned.rounded(.down)
            let visible = Int((Double.pi / 2) * radius / abs(spacing)) + 2

            for m in -visible...visible {
                // How far this ridge is around the curve from the front, in points…
                let arc = (shift + Double(m)) * spacing
                // …as an angle. Past ±90° it's around the back, out of sight.
                let angle = arc / radius
                guard abs(angle) < Double.pi / 2 else { continue }
                let x = radius + radius * sin(angle)
                let facing = cos(angle)   // 1 at the front, 0 at the edges

                var ridge = Path()
                ridge.move(to: CGPoint(x: x, y: 6))
                ridge.addLine(to: CGPoint(x: x, y: Double(size.height) - 6))
                context.stroke(
                    ridge,
                    with: .color(.white.opacity(0.1 + 0.55 * facing)),
                    lineWidth: 0.5 + 1.5 * facing
                )
            }
        }
        .background(Color(white: 0.16))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

/// The thumbwheel you can touch. Any finger movement goes to the model;
/// the model decides what it means.
struct ThumbwheelControl: View {
    let model: DialModel

    var body: some View {
        ThumbwheelPicture(rotation: model.physics.rotation)
            .contentShape(Rectangle())
            .gesture(
                // minimumDistance 0: touching a spinning wheel catches it immediately.
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { value in
                        model.fingerMoved(to: SIMD2(Double(value.location.x), Double(value.location.y)))
                    }
                    .onEnded { _ in
                        model.fingerLifted()
                    }
            )
    }
}

// MARK: - Readout, scale, meter

/// The frequency number.
struct ReadoutPicture: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 56, weight: .light, design: .monospaced))
            .monospacedDigit()
            .foregroundStyle(Color(white: 0.85))
    }
}

/// A printed dial scale with a needle. Major marks every 2 MHz on the placeholder
/// band, so the band's range shows up here without any code changes.
struct ScalePicture: View {
    /// Needle position on the band, 0..<1.
    let needle: Double
    let display: BandDisplay

    var body: some View {
        Canvas { context, size in
            let w = Double(size.width), h = Double(size.height)
            let ink = GraphicsContext.Shading.color(Color(white: 0.55))

            // Marks at each whole unit (each MHz on FM), taller every second one.
            let first = Int(display.low.rounded(.up))
            let last = Int(display.high.rounded(.down))
            if first <= last {
                for value in first...last {
                    let x = (Double(value) - display.low) / (display.high - display.low) * w
                    let tall = value % 2 == 0
                    var mark = Path()
                    mark.move(to: CGPoint(x: x, y: h * (tall ? 0.35 : 0.55)))
                    mark.addLine(to: CGPoint(x: x, y: h))
                    context.stroke(mark, with: ink, lineWidth: 1)
                }
            }

            // The needle.
            var needlePath = Path()
            let nx = needle * w
            needlePath.move(to: CGPoint(x: nx, y: 0))
            needlePath.addLine(to: CGPoint(x: nx, y: h))
            context.stroke(needlePath, with: .color(Color(white: 0.95)), lineWidth: 2)
        }
    }
}

/// A plain signal-strength meter, the kind real receivers have.
/// Placeholder until the audio is in: for now it's how you "hear" the Carrier.
struct SignalMeterPicture: View {
    /// 0...1
    let level: Double
    let locked: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color(white: 0.16))
                Rectangle()
                    .fill(Color(white: locked ? 0.9 : 0.6))
                    .frame(width: geo.size.width * min(max(level, 0), 1))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 2))
    }
}
