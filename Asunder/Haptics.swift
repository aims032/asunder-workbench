import CoreHaptics
import Foundation
import AsunderCore

/// The dial's feel under the thumb: a short click per detent, and a round
/// thump when you land on a feature. Every strength, crispness and length
/// comes from Tuning.swift.
///
/// On anything without a haptic engine (the Simulator, iPads), every call
/// quietly does nothing, so the rest of the app never has to check.
///
/// Used from the main thread only.
final class Haptics {
    private var engine: CHHapticEngine?
    private var tickPlayer: CHHapticPatternPlayer?
    private var pulsePlayer: CHHapticPatternPlayer?
    /// iOS stops the engine when the app goes to the background or the
    /// system needs it. We note that and start it again on the next play.
    private var needsRestart = true

    init() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        guard let engine = try? CHHapticEngine() else { return }

        // Haptics only: the audio engine (coming next) owns the sound.
        engine.playsHapticsOnly = true

        // The system can reset the haptic server; when it does, our players
        // are gone and have to be rebuilt.
        engine.resetHandler = { [weak self] in
            DispatchQueue.main.async { self?.needsRestart = true }
        }
        engine.stoppedHandler = { [weak self] _ in
            DispatchQueue.main.async { self?.needsRestart = true }
        }
        self.engine = engine
    }

    /// One detent click.
    func tick() {
        play(\.tickPlayer)
    }

    /// The "you're on it" thump.
    func pulse() {
        play(\.pulsePlayer)
    }

    // MARK: - Private

    private func play(_ player: KeyPath<Haptics, CHHapticPatternPlayer?>) {
        guard engine != nil else { return }
        if needsRestart { restart() }
        try? self[keyPath: player]?.start(atTime: CHHapticTimeImmediate)
    }

    /// Start the engine and (re)build the two players. Building them ahead of
    /// time means a tick costs almost nothing when it fires.
    private func restart() {
        guard let engine else { return }
        do {
            try engine.start()
            tickPlayer = try engine.makePlayer(with: Self.tickPattern())
            pulsePlayer = try engine.makePlayer(with: Self.pulsePattern())
            needsRestart = false
        } catch {
            // Leave needsRestart set; we'll try again on the next play.
        }
    }

    /// A single instant click.
    private static func tickPattern() throws -> CHHapticPattern {
        let click = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(Tuning.tickIntensity)),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(Tuning.tickSharpness)),
            ],
            relativeTime: 0
        )
        return try CHHapticPattern(events: [click], parameters: [])
    }

    /// A short, soft buzz with a length. Being continuous (not an instant click)
    /// is most of what makes it feel different from a detent.
    private static func pulsePattern() throws -> CHHapticPattern {
        let thump = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(Tuning.lockPulseIntensity)),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(Tuning.lockPulseSharpness)),
            ],
            relativeTime: 0,
            duration: Tuning.lockPulseDuration
        )
        return try CHHapticPattern(events: [thump], parameters: [])
    }
}
