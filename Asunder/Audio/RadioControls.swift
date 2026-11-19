import MediaPlayer

/// The lock screen, Control Center and headphone buttons (an AirPods squeeze,
/// a wired remote's click): play turns the radio on, pause turns it off.
/// iOS shows these controls for whichever app last played sound, as long as
/// that app answers them. Without this, the only way to silence the static
/// with the screen locked would be to unlock and quit the app.
final class RadioControls {

    init(turnOn: @escaping () -> Void, turnOff: @escaping () -> Void, isOn: @escaping () -> Bool) {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { _ in
            turnOn()
            return .success
        }
        center.pauseCommand.addTarget { _ in
            turnOff()
            return .success
        }
        center.togglePlayPauseCommand.addTarget { _ in
            if isOn() { turnOff() } else { turnOn() }
            return .success
        }
        // Skipping and scrubbing mean nothing on a radio.
        for command in [center.nextTrackCommand, center.previousTrackCommand,
                        center.skipForwardCommand, center.skipBackwardCommand,
                        center.changePlaybackPositionCommand] {
            command.isEnabled = false
        }
    }

    /// What the lock screen shows: the app's name, as a live broadcast,
    /// with a pause button while on and a play button while off.
    func show(isOn: Bool) {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: "Asunder",
            MPNowPlayingInfoPropertyIsLiveStream: true,
            MPNowPlayingInfoPropertyPlaybackRate: isOn ? 1.0 : 0.0,
        ]
    }
}
