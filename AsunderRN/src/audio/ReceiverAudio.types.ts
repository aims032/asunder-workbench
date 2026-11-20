/**
 * The radio's sound, as the rest of the app sees it.
 *
 * There are two versions of the radio behind this, and the app picks one by
 * file name when it's built:
 *   ReceiverAudio.native.ts   iPhone and Android: runs on the phone's audio thread
 *   ReceiverAudio.web.ts      web browsers: a simpler preview version
 *
 * On and off, for now (a real power switch comes with the Phase 4 look):
 *   ON:  opening the app, touching the dial, or play on the lock screen/AirPods.
 *   OFF: pause on the lock screen/AirPods, or headphones coming out (so the
 *        static never jumps to the speaker from a pocket; Apple's rule too).
 */
export interface ReceiverAudio {
  /**
   * Tell the radio where the dial is (band fraction; unwrapped is fine).
   * This one is special: the dial calls it from the screen's own fast thread
   * every frame, so it must be a "worklet" (see DialModel.ts).
   */
  tune: (position: number) => void;

  /**
   * Turn the radio on, on purpose (touching the dial, the play button).
   * Safe to call any time; does nothing if it's already playing.
   */
  turnOn: () => void;

  /** Turn the radio off, on purpose (the pause button, headphones coming out). */
  turnOff: () => void;

  /**
   * The app came to the front: play if the radio is meant to be on.
   * (If it was turned off on purpose, it stays off until the dial is touched.)
   */
  resumeIfOn: () => void;
}
