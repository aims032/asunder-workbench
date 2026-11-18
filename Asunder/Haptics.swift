import CoreHaptics
import AsunderCore

/// The phone's vibration motor, used for two feels:
///   tick()  a short click each time the wheel passes a notch
///   lock()  a rounder, longer pulse when you're centered on a feature
///
/// Strength and sharpness live in Tuning.swift. If the phone has no haptic
/// motor (or it fails to start), every call quietly does nothing.
final class Haptics {
    private var engine: CHHapticEngine?
    private var tickPlayer: CHHapticPatternPlayer?
    private var lockPlayer: CHHapticPatternPlayer?
    private var needsStart = true

    init() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let engine = try CHHapticEngine()
            engine.playsHapticsOnly = true
            // iOS stops the engine when the app goes to the background, or
            // resets it if the system haptics server restarts. Recover from both.
            engine.stoppedHandler = { [weak self] _ in self?.needsStart = true }
            engine.resetHandler = { [weak self] in
                self?.needsStart = true
                self?.makePlayers()
            }
            self.engine = engine
            makePlayers()
        } catch {
            engine = nil
        }
    }

    func tick() { play(tickPlayer) }
    func lock() { play(lockPlayer) }

    // MARK: Private

    private func play(_ player: CHHapticPatternPlayer?) {
        guard let engine, let player else { return }
        do {
            if needsStart {
                try engine.start()
                needsStart = false
            }
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            needsStart = true  // try starting again next time
        }
    }

    /// Build both patterns once, so playing them costs almost nothing.
    private func makePlayers() {
        guard let engine else { return }
        let tick = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Tuning.tickIntensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Tuning.tickSharpness),
            ],
            relativeTime: 0)
        let lock = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Tuning.lockIntensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Tuning.lockSharpness),
            ],
            relativeTime: 0,
            duration: Tuning.lockDuration)
        tickPlayer = try? engine.makePlayer(with: CHHapticPattern(events: [tick], parameters: []))
        lockPlayer = try? engine.makePlayer(with: CHHapticPattern(events: [lock], parameters: []))
    }
}
