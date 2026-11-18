import Foundation
import Observation
import QuartzCore
import AsunderCore

/// The live dial: owns the physics, runs it every frame, and plays a haptic
/// tick when the wheel passes a notch. Views read `needle` and `wheelDetents` from
/// here and redraw automatically when they change (that's what @Observable does).
@Observable
final class DialModel {
    /// The physics state. Read-only to views; changed through the methods below.
    private(set) var physics: DialPhysics

    private let ticker = FrameTicker()
    private let haptics: Haptics
    @ObservationIgnored private var lastDetent: Int
    @ObservationIgnored private var lastTickTime: CFTimeInterval = 0

    /// `start` is where the dial sits when the app opens.
    /// Whether it should remember where you left it is OPEN (Instruments §9 #8);
    /// for now it always opens mid-band.
    init(start: Double = 0.5, haptics: Haptics = Haptics()) {
        // Built in a local first: an @Observable class can't read its own
        // properties until every one of them has a value.
        let startState = DialPhysics(start: start)
        physics = startState
        self.haptics = haptics
        lastDetent = startState.detentIndex
        ticker.onFrame = { [weak self] dt in self?.frame(dt) }
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
        playTickIfANotchWasPassed()
        if physics.isAtRest { ticker.stop() }
    }

    private func playTickIfANotchWasPassed() {
        let detent = physics.detentIndex
        guard detent != lastDetent else { return }
        lastDetent = detent

        // On a fast spin, cap the tick rate so it reads as a buzz, not mush.
        let now = CACurrentMediaTime()
        guard now - lastTickTime >= 1 / Tuning.maxTicksPerSecond else { return }
        lastTickTime = now
        haptics.tick()
    }
}
