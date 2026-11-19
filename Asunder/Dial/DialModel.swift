import Foundation
import Observation
import QuartzCore
import AsunderCore

/// The live dial: owns the physics and runs it every frame. Each frame it
///   - tells the radio where it's tuned,
///   - plays the lock pulse when the wheel arrives on the Carrier,
///   - plays a haptic tick when the wheel passes any other notch.
/// Touching it also turns the radio on, if it was off.
/// Views read `needle` and `wheelDetents` from here and redraw automatically
/// when they change (that's what @Observable does).
@Observable
final class DialModel {
    /// The physics state. Read-only to views; changed through the methods below.
    private(set) var physics: DialPhysics

    private let ticker = FrameTicker()
    private let haptics: Haptics
    private let audio: ReceiverAudio
    private let clock = AsunderClock()
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
        audio.turnOn()  // does nothing if it's already playing
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

        // The Carrier: during its day-turn dropout there's nothing there to
        // lock on to, so its notch behaves like any other.
        let away = Carrier.detentsAway(from: physics.band)
        let carrierOnAir = Carrier.isOnAir(at: Date(), clock: clock)

        // The distinct pulse for arriving on the Carrier (or spinning across it).
        if lock.update(detentsAway: away) && carrierOnAir {
            haptics.lock()
        }

        // A tick for every notch passed, except the Carrier's own notch, which
        // gets the lock pulse instead. (A notch "starts" half a detent before
        // its center, which is when its tick would play.)
        let detent = physics.detentIndex
        if detent != lastDetent {
            lastDetent = detent
            let onCarrierNotch = carrierOnAir && abs(away) <= 0.5
            if !onCarrierNotch { playTick() }
        }

        if physics.isAtRest { ticker.stop() }
    }

    private func playTick() {
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
