/// Everything on the bench, made once when the app opens and kept for as long
/// as it runs. Phase 3 adds the analyzer and the scope here.
///
/// It lives in AsunderApp (not in a view) because SwiftUI can re-create views
/// whenever it likes, and there must only ever be one radio.
final class Bench {
    let audio = ReceiverAudio()
    let dial: DialModel

    init() {
        dial = DialModel(audio: audio)
    }
}
