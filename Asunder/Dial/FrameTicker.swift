import QuartzCore

/// Calls `onFrame(dt)` once per screen refresh, where `dt` is the seconds
/// since the last frame. This is the heartbeat the dial physics runs on.
///
/// It only runs while something is moving: the dial starts it on a touch and
/// stops it once the wheel is at rest, so an idle dial costs no battery.
final class FrameTicker: NSObject {
    var onFrame: ((Double) -> Void)?

    private var link: CADisplayLink?
    private var lastTimestamp: CFTimeInterval?

    var isRunning: Bool { link != nil }

    func start() {
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(frame(_:)))
        link.add(to: .main, forMode: .common)  // .common keeps ticking during scrolls/touches
        self.link = link
    }

    func stop() {
        link?.invalidate()
        link = nil
        lastTimestamp = nil
    }

    @objc private func frame(_ link: CADisplayLink) {
        // The first frame has no "last", so assume one normal frame.
        let dt = lastTimestamp.map { link.timestamp - $0 } ?? (link.duration > 0 ? link.duration : 1.0 / 60.0)
        lastTimestamp = link.timestamp
        onFrame?(dt)
    }
}
