import SwiftUI
import AsunderCore

/// PROPOSED form: an edge-on thumbwheel, like the tuning wheel on an old
/// pocket radio. You see the edge of a cylinder and roll it sideways.
/// Drag right to tune up, left to tune down.
struct EdgeWheelForm: DialForm {

    /// Sideways finger travel turns the wheel; up/down movement is ignored.
    func detents(from: CGPoint, to: CGPoint, in size: CGSize) -> Double {
        Double(to.x - from.x) / Tuning.pointsPerDetent
    }

    func face(wheelDetents: Double) -> EdgeWheelFace {
        EdgeWheelFace(wheelDetents: wheelDetents)
    }
}

/// Placeholder drawing: grooves on a rolling cylinder, one groove per detent.
/// Grooves bunch up and dim toward the edges, so it reads as round.
/// At the center a groove moves exactly as far as your finger does.
struct EdgeWheelFace: View {
    let wheelDetents: Double

    var body: some View {
        Canvas { context, size in
            let radius = Double(size.width) / 2
            let spacing = Tuning.pointsPerDetent           // one groove per detent
            let offset = wheelDetents * spacing            // how far the surface has rolled
            let halfArc = Double.pi / 2 * radius           // visible surface, center to edge

            // Only the grooves on the visible front half of the cylinder.
            let first = Int(((-halfArc - offset) / spacing).rounded(.down))
            let last = Int(((halfArc - offset) / spacing).rounded(.up))

            for k in first...last {
                let arc = Double(k) * spacing + offset     // distance from center along the surface
                let angle = arc / radius                   // where on the cylinder, in radians
                guard abs(angle) < .pi / 2 else { continue }

                let x = radius + radius * sin(angle)       // projected onto the flat screen
                let facing = cos(angle)                    // 1 at center, 0 at the edges

                var groove = Path()
                groove.move(to: CGPoint(x: x, y: 8))
                groove.addLine(to: CGPoint(x: x, y: Double(size.height) - 8))
                context.stroke(groove,
                               with: .color(.white.opacity(0.08 + 0.55 * facing)),
                               lineWidth: 0.5 + 1.5 * facing)
            }
        }
        .background(
            // Shading across the cylinder: dark edges, lighter middle.
            LinearGradient(colors: [.black, Color(white: 0.22), .black],
                           startPoint: .leading, endPoint: .trailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(white: 0.3), lineWidth: 1))
    }
}
