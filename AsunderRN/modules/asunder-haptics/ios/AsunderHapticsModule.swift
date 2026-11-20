import CoreHaptics
import ExpoModulesCore
import Foundation

/// The iPhone half of the haptics: the part of the app that is still Swift.
///
/// React Native has no built-in way to play a haptic with a chosen strength and
/// sharpness, so this small module does it with Core Haptics, exactly as the
/// original Swift app did (Asunder/Haptics.swift). The TypeScript side
/// (src/haptics/Haptics.ts) decides WHEN to play and HOW strong; this file only
/// plays what it's asked to.
///
/// The three functions TypeScript can call:
///   prepare()                             warm up the engine; false if the phone has no haptic motor
///   tick(intensity, sharpness)            a short click
///   lock(intensity, sharpness, duration)  a rounder, longer pulse
public final class AsunderHapticsModule: Module {
  private let haptics = HapticsEngine()

  public func definition() -> ModuleDefinition {
    Name("AsunderHaptics")

    Function("prepare") { () -> Bool in
      self.haptics.prepare()
    }

    Function("tick") { (intensity: Double, sharpness: Double) in
      self.haptics.play(Feel(intensity: Float(intensity), sharpness: Float(sharpness), duration: 0))
    }

    Function("lock") { (intensity: Double, sharpness: Double, duration: Double) in
      self.haptics.play(Feel(intensity: Float(intensity), sharpness: Float(sharpness), duration: duration))
    }
  }
}

/// One haptic feel. A duration of 0 means a short click ("transient");
/// anything longer is a held pulse ("continuous").
struct Feel: Hashable {
  let intensity: Float
  let sharpness: Float
  let duration: Double
}

/// The phone's vibration motor. If the phone has no haptic motor (or it fails
/// to start), every call quietly does nothing.
final class HapticsEngine: @unchecked Sendable {
  /// Only one thread at a time may touch what's below.
  /// ("Recursive" means the thread that already holds the lock may take it
  /// again. That matters if iOS ever calls the stopped/reset handlers below
  /// from inside start(): with a plain lock the app would freeze there.)
  private let mutex = NSRecursiveLock()
  private var engine: CHHapticEngine?
  private var triedToMakeEngine = false
  private var needsStart = true
  /// One ready-made player per feel, built the first time that feel is asked
  /// for. Making a new haptic pattern for every one of 45 ticks a second
  /// would be wasteful.
  private var players: [Feel: CHHapticPatternPlayer] = [:]

  func prepare() -> Bool {
    mutex.lock(); defer { mutex.unlock() }
    guard let engine = ensureEngine() else { return false }
    if needsStart, (try? engine.start()) != nil { needsStart = false }
    return true
  }

  func play(_ feel: Feel) {
    mutex.lock(); defer { mutex.unlock() }
    guard let engine = ensureEngine() else { return }
    do {
      if needsStart {
        try engine.start()
        needsStart = false
      }
      let player = try players[feel] ?? makePlayer(feel, engine)
      try player.start(atTime: CHHapticTimeImmediate)
    } catch {
      needsStart = true  // try starting again next time
    }
  }

  // MARK: Private

  private func ensureEngine() -> CHHapticEngine? {
    if triedToMakeEngine { return engine }
    triedToMakeEngine = true
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
          let newEngine = try? CHHapticEngine() else { return nil }
    newEngine.playsHapticsOnly = true
    // iOS stops the engine when the app goes to the background, or
    // resets it if the system haptics server restarts. Recover from both.
    newEngine.stoppedHandler = { [weak self] _ in self?.markStopped(dropPlayers: false) }
    newEngine.resetHandler = { [weak self] in self?.markStopped(dropPlayers: true) }
    engine = newEngine
    return newEngine
  }

  private func markStopped(dropPlayers: Bool) {
    mutex.lock(); defer { mutex.unlock() }
    needsStart = true
    if dropPlayers { players.removeAll() }  // they're rebuilt the next time each is played
  }

  private func makePlayer(_ feel: Feel, _ engine: CHHapticEngine) throws -> CHHapticPatternPlayer {
    // The app only ever asks for a handful of feels. This cap is a safety net
    // in case a future change asks for a new one on every call.
    if players.count >= 16 { players.removeAll() }

    let parameters = [
      CHHapticEventParameter(parameterID: .hapticIntensity, value: feel.intensity),
      CHHapticEventParameter(parameterID: .hapticSharpness, value: feel.sharpness),
    ]
    let event = feel.duration > 0
      ? CHHapticEvent(eventType: .hapticContinuous, parameters: parameters, relativeTime: 0, duration: feel.duration)
      : CHHapticEvent(eventType: .hapticTransient, parameters: parameters, relativeTime: 0)
    let player = try engine.makePlayer(with: CHHapticPattern(events: [event], parameters: []))
    players[feel] = player
    return player
  }
}
