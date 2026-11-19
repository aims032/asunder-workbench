import AVFoundation
import os
import AsunderCore

/// The radio's sound. Plugs AsunderCore's ReceiverChain (static + Carrier
/// through the EQ path) into the phone's audio system and keeps it playing
/// with the screen off and after a phone call.
///
///     ReceiverChain ─► source node ─► main mixer ─► speaker / headphones
///
/// On and off, for now (a real power switch comes with the Phase 4 look):
///   ON:  opening the app, touching the dial, or play on the lock screen/AirPods.
///   OFF: pause on the lock screen/AirPods, or headphones coming out (so the
///        static never jumps to the speaker from a pocket; Apple's rule too).
///
/// The main thread only ever does one thing to it while it plays: tell it where
/// the dial is (`tune(to:)`). Everything else (the clock, the temperature, the
/// day-turn dropout) the audio thread works out for itself every buffer, so it
/// stays right even with the screen off and nothing on screen running.
final class ReceiverAudio {
    private var engine = AVAudioEngine()
    private var source: AVAudioSourceNode?
    /// The sound-making state. Once playing, only the audio thread touches it.
    private var render: UnsafeMutablePointer<RenderState>?
    /// Where the dial is. Written on the main thread, read on the audio thread.
    private let dial = OSAllocatedUnfairLock(initialState: 0.5)
    private let clock = AsunderClock()
    /// Whether the radio is meant to be on (see the list above).
    private var wantsToPlay = true
    private var controls: RadioControls?

    init() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(interruptionChanged),
                           name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(mediaServicesReset),
                           name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        center.addObserver(self, selector: #selector(engineConfigurationChanged),
                           name: .AVAudioEngineConfigurationChange, object: nil)
        center.addObserver(self, selector: #selector(routeChanged),
                           name: AVAudioSession.routeChangeNotification, object: nil)
        controls = RadioControls(
            turnOn: { [weak self] in DispatchQueue.main.async { self?.turnOn() } },
            turnOff: { [weak self] in DispatchQueue.main.async { self?.turnOff() } },
            isOn: { [weak self] in self?.engine.isRunning ?? false })
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        tearDownGraph()
    }

    // MARK: What the app calls

    /// Tell the radio where the dial is (band fraction; unwrapped is fine).
    func tune(to position: Double) {
        dial.withLock { $0 = position }
    }

    /// Turn the radio on, on purpose (touching the dial, the play button).
    /// Safe to call any time; does nothing if it's already playing.
    func turnOn() {
        wantsToPlay = true
        resume()
    }

    /// Turn the radio off, on purpose (the pause button, headphones coming out).
    func turnOff() {
        wantsToPlay = false
        engine.pause()
        controls?.show(isOn: false)
        // Hand the speaker back, so whatever another app paused for us can carry on.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// The app came to the front: play if the radio is meant to be on.
    /// (If it was turned off on purpose, it stays off until the dial is touched.)
    func resumeIfOn() {
        resume()
    }

    /// Play, if the radio is meant to be on and isn't already.
    /// Returns false if iOS said no (e.g. a phone call has the speaker).
    @discardableResult
    private func resume() -> Bool {
        guard wantsToPlay, !engine.isRunning else { return true }
        do {
            try configureSession()
            if source == nil {
                buildGraph()
            } else {
                // Coming back after a pause or a call: fade in, don't thump.
                // Safe: the engine is stopped, so the audio thread isn't using it.
                render?.pointee.chain.restartFade()
            }
            try engine.start()
            controls?.show(isOn: true)
            return true
        } catch {
            // No sound is better than a crash. Touching the dial or bringing
            // the app back to the front tries again.
            print("ReceiverAudio: couldn't start: \(error)")
            return false
        }
    }

    // MARK: Setup

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        // .playback: keeps playing with the screen locked and with the silent
        // switch on, like a radio. Not mixed with other apps: tuning in takes the speaker.
        try session.setCategory(.playback, mode: .default)
        // Requests, not guarantees: the phone may choose otherwise.
        try? session.setPreferredSampleRate(48_000)
        try? session.setPreferredIOBufferDuration(Tuning.audioBufferSeconds)
        try session.setActive(true)
    }

    /// Build the graph at whatever sample rate the phone is running right now.
    private func buildGraph() {
        let hardwareRate = engine.outputNode.inputFormat(forBus: 0).sampleRate
        let sampleRate = hardwareRate > 0 ? hardwareRate : 48_000
        // The radio is mono, like a real one. The mixer sends it to both ears.
        guard let mono = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else { return }

        // The noise seed comes from the clock (no unseeded randomness, CLAUDE.md).
        // The hiss itself isn't meant to match between phones; everything that
        // shapes it (temperature, the Carrier, the dropout) does.
        let seed = UInt64(max(0, Date().timeIntervalSince1970 * 1_000))
        let state = UnsafeMutablePointer<RenderState>.allocate(capacity: 1)
        state.initialize(to: RenderState(chain: ReceiverChain(sampleRate: sampleRate, seed: seed),
                                         dial: dial.withLock { $0 }))
        render = state

        // Run the clock math once here, on the main thread, so its shared
        // constants are set up before the audio thread needs them.
        _ = Reception.targets(dial: state.pointee.dial, at: Date(), clock: clock)

        let node = AVAudioSourceNode(format: mono, renderBlock: Self.makeRenderBlock(state: state, dial: dial, clock: clock))
        engine.attach(node)
        // The main mixer connects itself to the speaker in the phone's own format.
        engine.connect(node, to: engine.mainMixerNode, format: mono)
        source = node
    }

    /// The code the audio thread runs every buffer (a few hundred times a second).
    /// Rules for in here: never wait, never allocate, never touch the screen.
    private static func makeRenderBlock(state: UnsafeMutablePointer<RenderState>,
                                        dial: OSAllocatedUnfairLock<Double>,
                                        clock: AsunderClock) -> AVAudioSourceNodeRenderBlock {
        return { _, _, frameCount, audioBufferList in
            let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
            guard let first = buffers.first, let data = first.mData else { return noErr }
            let out = data.assumingMemoryBound(to: Float.self)

            // Only *try* to read the dial: if the main thread is writing it this
            // instant, keep last buffer's value rather than wait (waiting = a click).
            if let position = dial.withLockIfAvailable({ $0 }) {
                state.pointee.dial = position
            }
            let targets = Reception.targets(dial: state.pointee.dial, at: Date(), clock: clock)
            state.pointee.chain.render(into: out, count: Int(frameCount), targets: targets)
            return noErr
        }
    }

    private func tearDownGraph() {
        engine.stop()
        if let source { engine.detach(source) }
        source = nil
        if let render {
            render.deinitialize(count: 1)
            render.deallocate()
        }
        render = nil
    }

    /// Start over from scratch: a fresh engine and graph at the current sample rate.
    private func rebuild() {
        tearDownGraph()
        engine = AVAudioEngine()
        resume()
    }

    // MARK: Things that happen to a radio

    /// A phone call, an alarm, Siri. iOS stops our audio when it starts; when it
    /// ends, come back on if iOS says we should.
    @objc private func interruptionChanged(_ note: Notification) {
        guard let info = note.userInfo,
              let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: rawType) == .ended else { return }
        let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        guard AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) else { return }
        DispatchQueue.main.async {
            // Right as a call ends, the phone app may not have let go of the
            // speaker yet. If iOS says no, try once more a second later.
            if !self.resume() {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.resume() }
            }
        }
    }

    /// Headphones unplugged or Bluetooth headphones gone: turn off rather than
    /// carry on through the speaker. Touch the dial or press play to turn back on.
    @objc private func routeChanged(_ note: Notification) {
        guard let info = note.userInfo,
              let rawReason = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
              AVAudioSession.RouteChangeReason(rawValue: rawReason) == .oldDeviceUnavailable,
              let previous = info[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription,
              previous.outputs.contains(where: { Self.headphoneOutputs.contains($0.portType) })
        else { return }
        DispatchQueue.main.async { self.turnOff() }
    }

    /// Outputs that only the listener hears.
    private static let headphoneOutputs: Set<AVAudioSession.Port> = [
        .headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .usbAudio,
    ]

    /// The output changed in a way the engine can't follow (Bluetooth connected,
    /// a new sample rate). The engine has stopped itself; rebuild for the new output.
    @objc private func engineConfigurationChanged(_ note: Notification) {
        let changed = note.object as AnyObject?
        DispatchQueue.main.async {
            guard changed === self.engine else { return }  // an old engine's news; ignore
            self.rebuild()
        }
    }

    /// Rare: the phone's whole audio system restarted. Everything old is dead.
    @objc private func mediaServicesReset(_ note: Notification) {
        DispatchQueue.main.async { self.rebuild() }
    }
}

/// What the audio thread keeps between buffers.
private struct RenderState {
    var chain: ReceiverChain
    /// The last dial position it read.
    var dial: Double
}
