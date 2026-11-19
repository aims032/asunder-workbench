import Foundation
import Observation
import QuartzCore
import AsunderCore

/// The live dial: owns the physics and runs it every frame. Each frame it
///   - tells the radio where it's tuned,
///   - plays the lock pulse when the wheel arrives on the Carrier,
///   - otherwise plays a haptic tick when the wheel passes a notch.
/// Views read `needle` and `wheelDetents` from here and redraw automatically
/// when they change (that's what @Observable does).
@Observable
final class DialModel {
    /// The physics state. Read-only to views; changed through the methods below.
    private(set) var physics: DialPhysics

    private let ticker = FrameTicker()
    private let haptics: Haptics
    private let audio: ReceiverAudio
    @ObservationIgnored private var lastDetent: Int
    @ObservationIgnored private var lastTickTime: CFTimeInterval = 0
    @ObservationIgnored private var lock = LockDetector()

    /// `start` is where the dial sits when the app opens.
    /// Whether it should remember where you left it is OPEN (Instruments §9 #8);
    /// for now it always opens mid-band.
    init(start: Double = 0.5, haptics: Haptics = Haptics(), audio: ReceiverAudio) {
        // Built in a local first: an @Observable class can't read its own
        // properties until every one of them has a value.
        let startState = DialPhysics(start: start)
        physics = startState
        self.haptics = haptics
        self.audio = audio
        lastDetent = startState.detentIndex
        ticker.onFrame = { [weak self] dt in self?.frame(dt) }
        audio.tune(to: start)
    }

    // MARK: What the views read

    /// Where the needle and readout point (lags the wheel slightly).
    var needle: BandPosition { physics.needleBand }
    /// How far the wheel itself has turned, in detents, unwrapped. Drives the drawing.
    var wheelDetents: Double { physics.position / Tuning.detentSpacing }

    // MARK: What the touch handling calls

    func grab() {
        physics.grab()
        ticker.start()
    }

    func drag(detents: Double) {
        physics.drag(by: detents * Tuning.detentSpacing)
        ticker.start()
    }

    func release() {
        physics.release()
        ticker.start()
    }

    // MARK: Every frame

    private func frame(_ dt: Double) {
        physics.step(dt)

        // The sound follows the wheel itself, not the lagging needle: the
        // hand, the ticks and the sound all agree on where you are.
        audio.tune(to: physics.position)

        let locked = playLockIfCentered()
        if locked {
            lastDetent = physics.detentIndex  // the lock pulse replaces this notch's tick
        } else {
            playTickIfANotchWasPassed()
        }

        if physics.isAtRest { ticker.stop() }
    }

    /// The distinct pulse for arriving on the Carrier (or spinning across it).
    private func playLockIfCentered() -> Bool {
        let away = Carrier.detentsAway(from: physics.band)
        guard lock.update(detentsAway: away) else { return false }
        haptics.lock()
        return true
    }

    private func playTickIfANotchWasPassed() {
        let detent = physics.detentIndex
        guard detent != lastDetent else { return }
        lastDetent = detent

        // On a fast spin, cap the tick rate so it reads as a buzz, not mush.
        let now = CACurrentMediaTime()
        guard now - lastTickTime >= 1 / Tuning.maxTicksPerSecond else { return }
        lastTickTime = now

        // And soften each tick the faster it spins (Tuning.tickSoftenSpeed):
        // full strength when turned slowly, half at that speed, fainter beyond.
        let speed = abs(physics.velocity) / Tuning.detentSpacing   // detents per second
        let strength = 1 / (1 + speed / Tuning.tickSoftenSpeed)
        haptics.tick(strength: Float(strength))
    }
}
