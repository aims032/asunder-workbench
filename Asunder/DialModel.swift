import Foundation
import Observation
import QuartzCore
import AsunderCore

/// Where the dial sits when the app opens, in band units. 0.5 = mid-band (97.8 on FM).
private let startPosition: Double = 0.5

/// The dial's behavior, with no picture attached. The thumbwheel view sends it
/// finger moves; it runs the physics once per screen frame, fires the haptics,
/// and publishes what the screen should show.
///
/// Keeping this separate from the drawing is what lets Evan's artwork drop in
/// later: a new picture reads the same `rotation`, `readout` and `signal`.
///
/// Used from the main thread only.
@Observable
final class DialModel {

    // What the screen reads. Updated every frame.
    private(set) var physics = DialPhysics(position: startPosition)
    /// How strongly the Carrier comes through at the needle, 0...1.
    private(set) var signal: Double = 0
    /// True while you're centered on the Carrier.
    private(set) var isLocked = false

    /// The readout text, e.g. "94.3". Follows the needle, so it lags the hand slightly.
    var readout: String { display.label(at: physics.needlePosition) }

    // Machinery. Not observed: the screen doesn't need to redraw when these change.
    @ObservationIgnored private let display = BandDisplay.placeholder
    @ObservationIgnored private let form: any DialForm = Thumbwheel()
    @ObservationIgnored private let haptics = Haptics()
    @ObservationIgnored private var detents: DetentCounter
    @ObservationIgnored private var lock = LockDetector()
    @ObservationIgnored private var tickThrottle = TickThrottle()
    @ObservationIgnored private var lastFinger: SIMD2<Double>?
    @ObservationIgnored private var lastFrameTime: CFTimeInterval?
    @ObservationIgnored private var ticker: FrameTicker?

    init() {
        detents = DetentCounter(startingAt: startPosition)
    }

    // MARK: - Frame loop

    /// Start running the physics every screen frame.
    func start() {
        if ticker == nil {
            ticker = FrameTicker { [weak self] link in self?.frame(link) }
        }
        lastFrameTime = nil
        ticker?.start()
    }

    func stop() {
        ticker?.stop()
    }

    private func frame(_ link: CADisplayLink) {
        let now = link.timestamp
        let dt = lastFrameTime.map { now - $0 } ?? 0
        lastFrameTime = now

        physics.step(dt: dt)
        feelDetents(at: now)

        // The lock pulse is judged at the wheel (your thumb), so it lands the
        // instant you hit center. The meter and readout follow the needle.
        let atWheel = Band.strength(dial: physics.position, center: Features.carrierPosition)
        if lock.update(strength: atWheel) {
            haptics.pulse()
        }
        isLocked = lock.isLocked
        signal = Band.strength(dial: physics.needlePosition, center: Features.carrierPosition)
    }

    // MARK: - Finger

    /// The finger is down at `point` (screen points). The first call is the grab.
    func fingerMoved(to point: SIMD2<Double>) {
        let now = CACurrentMediaTime()
        if let last = lastFinger {
            physics.drag(by: form.bandDelta(from: last, to: point), at: now)
            // Tick right away instead of waiting for the next frame: less lag under the thumb.
            feelDetents(at: now)
        } else {
            physics.grab(at: now)
        }
        lastFinger = point
    }

    func fingerLifted() {
        physics.release(at: CACurrentMediaTime())
        lastFinger = nil
    }

    // MARK: - Private

    private func feelDetents(at time: Double) {
        let crossed = detents.update(rotation: physics.rotation)
        if tickThrottle.shouldPlay(ticks: crossed, at: time) {
            haptics.tick()
        }
    }
}

/// Calls a closure once per screen refresh. A thin wrapper around CADisplayLink,
/// which needs an Objective-C object to call.
final class FrameTicker: NSObject {
    private var link: CADisplayLink?
    private let onFrame: (CADisplayLink) -> Void

    init(onFrame: @escaping (CADisplayLink) -> Void) {
        self.onFrame = onFrame
        super.init()
    }

    func start() {
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)   // .common keeps it running during touches
        self.link = link
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    @objc private func tick(_ link: CADisplayLink) {
        onFrame(link)
    }
}
