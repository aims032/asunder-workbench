import CoreHaptics
import AsunderCore

/// The phone's vibration motor, used for two feels:
///   tick(strength:)  a short click each time the wheel passes a notch
///   lock()           a rounder, longer pulse when you're centered on a feature
///
/// Strength and sharpness live in Tuning.swift. If the phone has no haptic
/// motor (or it fails to start), every call quietly does nothing.
final class Haptics {
    /// The tick comes in a few strengths (Tuning.tickStrengthSteps). Fast spins
    /// use the softer ones. They're built once up front, because making a new
    /// haptic pattern for every one of 45 ticks a second is wasteful.
    private static var tickStrengths: [Float] { Tuning.tickStrengthSteps }

    private var engine: CHHapticEngine?
    /// One ready-made tick per entry in `tickStrengths`, same order.
    private var tickPlayers: [CHHapticPatternPlayer?] = []
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

    /// `strength` 0...1 is a share of the full tick; the closest ready-made one plays.
    func tick(strength: Float = 1) {
        var best = 0
        for i in Self.tickStrengths.indices
        where abs(Self.tickStrengths[i] - strength) < abs(Self.tickStrengths[best] - strength) {
            best = i
        }
        guard best < tickPlayers.count else { return }
        play(tickPlayers[best])
    }

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

    /// Build every pattern once, so playing them costs almost nothing.
    private func makePlayers() {
        guard let engine else { return }
        tickPlayers = Self.tickStrengths.map { share -> CHHapticPatternPlayer? in
            let tick = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: Tuning.tickIntensity * share),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: Tuning.tickSharpness),
                ],
                relativeTime: 0)
            return try? engine.makePlayer(with: CHHapticPattern(events: [tick], parameters: []))
        }
        let lock = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Tuning.lockIntensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Tuning.lockSharpness),
            ],
            relativeTime: 0,
            duration: Tuning.lockDuration)
        lockPlayer = try? engine.makePlayer(with: CHHapticPattern(events: [lock], parameters: []))
    }
}
