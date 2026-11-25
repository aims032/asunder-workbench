import {
  chainRender,
  chainRestartFade,
  createClock,
  createReceiverChain,
  createReceiverTargets,
  receptionTargets,
  signalReception,
} from '../core';
import type { ReceiverAudio } from './ReceiverAudio.types';

// THE WEB VERSION OF THE RADIO: a preview, not the real thing.
//
// It runs the very same sound code as the phone (ReceiverChain, from src/core),
// but on the browser's main thread instead of a dedicated audio thread. That
// means the sound can stutter while the page is busy, and it reacts to the dial
// a little later. It also can't keep playing with the phone locked, and there
// are no lock-screen controls. Good enough to hear the idea in a browser.
//
//     ReceiverChain ─► script processor ─► speakers
//
// Browsers only let a page make sound after you've touched it, so on the web
// the radio starts on the first touch of the dial, not when the page opens.

/**
 * How many samples the browser asks for at a time. Bigger = safer from
 * stutter but slower to follow the dial. 1024 is about 1/47 of a second.
 */
const WEB_BUFFER_SIZE = 1024;

export function createReceiverAudio(): ReceiverAudio {
  // Where the dial is. On the web everything shares one thread, so a plain
  // box holding one number is all the "wire" between the dial and the sound needs to be.
  const dial = { position: 0.5 };
  /** Whether the radio is meant to be on. */
  let wantsToPlay = true;
  let context: AudioContext | null = null;
  let restartFadeNextBuffer = false;

  function buildGraph(): AudioContext {
    const newContext = new AudioContext();
    // The noise seed comes from the clock (no unseeded randomness, CLAUDE.md).
    const seed = Math.floor(Date.now());
    const chain = createReceiverChain(newContext.sampleRate, seed);
    const targets = createReceiverTargets();
    const clock = createClock();

    // No inputs, one output channel: the radio is mono, like a real one.
    // (ScriptProcessor is the browser's older, simpler way to make sound in
    // JavaScript. Its replacement runs on a separate thread and needs its own
    // separately built file; not worth it for a preview.)
    const node = newContext.createScriptProcessor(WEB_BUFFER_SIZE, 0, 1);
    node.onaudioprocess = (event) => {
      const out = event.outputBuffer.getChannelData(0);
      if (restartFadeNextBuffer) {
        restartFadeNextBuffer = false;
        chainRestartFade(chain);
      }
      receptionTargets(targets, dial.position, Date.now() / 1000, clock);
      signalReception(targets, dial.position, Date.now() / 1000, clock);
      chainRender(chain, out, out.length, targets);
    };
    node.connect(newContext.destination);
    return newContext;
  }

  function resume(): void {
    if (!wantsToPlay) {
      return;
    }
    try {
      if (context === null) {
        context = buildGraph();
      }
      if (context.state !== 'running') {
        // Coming back after a pause: fade in, don't thump.
        restartFadeNextBuffer = true;
        // The browser refuses this until the page has been touched. That's
        // fine: touching the dial tries again.
        context.resume().catch(() => {});
      }
    } catch (error) {
      // No sound is better than a crash.
      console.warn('ReceiverAudio: could not start', error);
    }
  }

  return {
    tune: (position) => {
      dial.position = position;
    },
    turnOn: () => {
      wantsToPlay = true;
      resume();
    },
    turnOff: () => {
      wantsToPlay = false;
      context?.suspend().catch(() => {});
    },
    resumeIfOn: () => {
      resume();
    },
  };
}
