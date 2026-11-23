import { STAND_IN_TRANSMISSION, tapeAdvance, tapeJump, tapeSeconds, tapeStart } from '../core';
import type { Tape, Transmission } from '../core';
import { createStore } from './Store';
import type { Store } from './Store';

// THE TAPE DECK: which transmission is on the lines and where in it we are.
// The printer types from it, and the analyzer's LINE input follows it
// (Bench.ts joins them), so everything agrees about "now".
//
// There's no sound yet. When there is, this is where it starts, and where a
// jump tells the audio to move too.
//
// What's NOT decided (don't build on it): when a transmission starts, whether
// a listener can replay one, and whether it loops. For now the only thing to
// play is the stand-in, it loops, and only the desk's test button starts it.

export interface TransmissionPlayer {
  transmission: Transmission;
  /** The tape, or null if nothing has been started since the app opened. */
  tape: Store<Tape | null>;
  /** Start the transmission from the beginning. */
  start(nowSeconds: number): void;
  /** Move to a moment that has already been printed. */
  jump(toSeconds: number, nowSeconds: number): void;
  /** Time has passed: note how far the paper has got. */
  advance(nowSeconds: number): void;
  /** Where the tape is right now, in seconds from the start (0 if not started). */
  seconds(nowSeconds: number): number;
}

export function createTransmissionPlayer(transmission: Transmission = STAND_IN_TRANSMISSION): TransmissionPlayer {
  const tape = createStore<Tape | null>(null);
  const duration = transmission.durationSeconds;
  return {
    transmission,
    tape,
    start(nowSeconds) {
      tape.set(tapeStart(nowSeconds));
    },
    jump(toSeconds, nowSeconds) {
      const now = tape.get();
      if (now !== null) {
        tape.set(tapeJump(tapeAdvance(now, duration, nowSeconds), nowSeconds, toSeconds));
      }
    },
    advance(nowSeconds) {
      const now = tape.get();
      if (now !== null) {
        tape.set(tapeAdvance(now, duration, nowSeconds));
      }
    },
    seconds(nowSeconds) {
      const now = tape.get();
      return now === null ? 0 : tapeSeconds(now, duration, nowSeconds);
    },
  };
}
