import { Platform } from 'react-native';
import { AudioContext, AudioManager, PlaybackNotificationManager } from 'react-native-audio-api';
import type { PlaybackControlName } from 'react-native-audio-api';
import { WorkletSourceNode } from 'react-native-audio-worklets';
import type { WorkletSourceNodeCallback } from 'react-native-audio-worklets';
import { createSynchronizable } from 'react-native-worklets';
import type { FixedSynchronizable } from 'react-native-worklets';

import {
  chainRender,
  chainRestartFade,
  createClock,
  createReceiverChain,
  createReceiverTargets,
  receptionTargets,
} from '../core';
import type { ReceiverAudio } from './ReceiverAudio.types';

// THE RADIO'S SOUND, ON A PHONE.
//
// Plugs the core's ReceiverChain (static + Carrier through the EQ path) into
// the phone's audio system and keeps it playing with the screen off and after
// a phone call.
//
//     ReceiverChain ─► worklet source node ─► speaker / headphones
//
// THREADS. A phone runs several things at once, each on its own "thread":
//   - the JS thread     this file's setup code, the lock-screen buttons
//   - the screen thread the dial's physics (DialModel.ts)
//   - the audio thread  the function that makes the sound (renderCallback, below)
// The audio thread is asked for a small block of sound a few hundred times a
// second and must NEVER be kept waiting, or you hear a click. So it shares only
// two numbers with the other threads, each through a "synchronizable": a box
// holding one number that any thread can read or write without waiting.
//
// Everything else (the clock, the temperature, the day-turn dropout) the audio
// thread works out for itself every block, so it stays right even with the
// screen off and nothing on screen running.
//
// The library that provides all this is react-native-audio-api.

/**
 * How much sound the phone collects before playing it. This sets how soon the
 * sound follows the dial. The library offers three sizes:
 *   'interactive'  128 samples, about 1/375 of a second. Follows the dial
 *                  soonest, but any hiccup is heard as a click.
 *   'balanced'     1024 samples, about 1/47 of a second. (In use.)
 *   'playback'     4096 samples, about 1/12 of a second. Safest, laggiest.
 * The Swift app asked for 1/100 of a second (Tuning.audioBufferSeconds there),
 * so this app's sound trails the dial by about twice as long as Swift's.
 * This is a feel number, but it lives here, not in Tuning.ts, because
 * Tuning.ts has to keep the same list of names as Tuning.swift.
 */
const BLOCK_SIZE: 'interactive' | 'balanced' | 'playback' = 'balanced';

/** Lock-screen buttons that mean nothing on a radio. */
const UNUSED_CONTROLS: PlaybackControlName[] = [
  'nextTrack',
  'previousTrack',
  'skipForward',
  'skipBackward',
  'seekTo',
  'stop',
];

/**
 * Outputs that only the listener hears. If one of these goes away, the radio
 * turns off rather than carry on through the speaker.
 *
 * This is a pattern that is tested against the output's name: it matches any
 * name containing "headphone", "headset", "bluetooth" or "usb" (the `i` at the
 * end means capital letters don't matter). Those cover the names the audio
 * library reports on both iPhone ("Headphones", "BluetoothA2DPOutput",
 * "BluetoothHFP", "BluetoothLE", "USBAudio") and Android ("Wired Headset",
 * "Bluetooth A2DP", "USB Headset"...), and none of the shared ones ("Speaker",
 * "AirPlay", "CarAudio", "HDMI"). Checked by reading the library's code;
 * unplugging real headphones has NOT been tried on a phone yet.
 */
const PRIVATE_OUTPUT = /headphone|headset|bluetooth|usb/i;

/**
 * What the audio thread keeps between blocks. It is made once on the JS
 * thread and then handed over: after that only the audio thread touches it.
 */
function createRenderState(sampleRate: number, seed: number) {
  return {
    chain: createReceiverChain(sampleRate, seed),
    targets: createReceiverTargets(),
    clock: createClock(),
    /** How many "fade in again" requests it has already acted on. */
    fadesDone: 0,
    /** The last dial position that was a real number (see SAFETY NET below). */
    lastGoodDial: 0.5,
  };
}

/**
 * Makes the function the audio thread runs for every block of sound.
 * Rules for in there: never wait, never create anything new, never touch the screen.
 *
 * A block is always 128 samples (about 375 blocks a second at 48 kHz). That
 * size is fixed by the library; BLOCK_SIZE above only changes how many of
 * them the phone collects before playing them.
 */
function makeRenderCallback(
  sampleRate: number,
  seed: number,
  dialPosition: FixedSynchronizable<number>,
  fadeRequests: FixedSynchronizable<number>,
): WorkletSourceNodeCallback {
  const state = createRenderState(sampleRate, seed);

  return (audioData, outputChannelCount, framesToProcess) => {
    // This line marks the function as a "worklet": code that is allowed to run
    // on a thread other than the JS thread.
    'worklet';
    const left = audioData[0];

    // SAFETY NET. Nothing below is expected to go wrong, but on this thread
    // the two ways it could are both nasty, so each has a guard:
    //   - An error here would not show a red screen. It would close the app.
    //     So the whole block is inside try/catch, and an error plays silence.
    //   - A "not a number" (NaN, what you get from 0/0) would get stuck in
    //     the filters' memory and silence the radio until the app is quit.
    //     So a dial position that isn't a real number is ignored, and if NaN
    //     ever does reach the output, the chain is rebuilt from scratch.
    try {
      // Coming back after a pause or a call: fade in, don't thump.
      const fadesAsked = fadeRequests.getDirty();
      if (fadesAsked !== state.fadesDone) {
        state.fadesDone = fadesAsked;
        chainRestartFade(state.chain);
      }

      const dial = dialPosition.getDirty();
      if (Number.isFinite(dial)) {
        state.lastGoodDial = dial;
      }

      // Where the dial is and what time it is decide what it should sound like...
      receptionTargets(state.targets, state.lastGoodDial, Date.now() / 1000, state.clock);
      // ...and the chain makes this block of sound, gliding toward that.
      chainRender(state.chain, left, framesToProcess, state.targets);

      // Once NaN is in the chain every later sample is NaN, so looking at
      // the last sample of the block is enough to catch it.
      if (Number.isNaN(left[framesToProcess - 1])) {
        left.fill(0);
        // (This is the one place the "never create anything new" rule is
        // broken. It should never run; if it does, a click beats silence.)
        state.chain = createReceiverChain(sampleRate, seed);
      }
    } catch {
      left.fill(0);
    }

    // The radio is mono, like a real one: every other speaker gets a copy.
    for (let channel = 1; channel < outputChannelCount; channel += 1) {
      audioData[channel].set(left);
    }
  };
}

export function createReceiverAudio(): ReceiverAudio {
  /** Where the dial is. Written on the screen thread, read on the audio thread. */
  const dialPosition = createSynchronizable(0.5, { fixedType: true });
  /** Counts requests to fade in again. Written here, read on the audio thread. */
  const fadeRequests = createSynchronizable(0, { fixedType: true });
  let fadesRequested = 0;

  let context: AudioContext | null = null;
  /** Whether the radio is meant to be on (see ReceiverAudio.types.ts). */
  let wantsToPlay = true;
  /**
   * True once the radio has been stopped and the speaker handed back,
   * so a second "off" has nothing to do.
   */
  let isStopped = false;
  /**
   * True from when a phone call, alarm or Siri cuts in until the radio has
   * properly started again. While it's true, "is it already playing?" can't
   * be trusted, so start() does its whole job.
   */
  let wasInterrupted = false;
  let askedForNotifications = false;
  /** The outputs (speaker, headphones...) that were connected last time we looked. */
  let lastOutputs: string[] = [];

  // MARK: Setup

  /** Build the sound graph at whatever sample rate the phone prefers. */
  function buildGraph(): AudioContext {
    // 'playback': keeps playing with the screen locked and with the silent
    // switch on, like a radio. No mixing options: tuning in takes the speaker.
    AudioManager.setSystemOptions({
      ios: {
        category: 'playback',
        mode: 'default',
        options: [],
        notifyOthersOnDeactivation: true,
      },
    });

    const newContext = new AudioContext({ latencyHint: BLOCK_SIZE });

    // The noise seed comes from the clock (no unseeded randomness, CLAUDE.md).
    // The hiss itself isn't meant to match between phones; everything that
    // shapes it (temperature, the Carrier, the dropout) does.
    const seed = Math.floor(Date.now());

    const source = new WorkletSourceNode(
      newContext,
      makeRenderCallback(newContext.sampleRate, seed, dialPosition, fadeRequests),
    );
    source.connect(newContext.destination);
    source.start();

    // If the phone's audio system hiccups, try to come back after a moment.
    newContext.onerror = () => {
      setTimeout(() => {
        void settle();
      }, 2000);
    };
    return newContext;
  }

  /**
   * What the lock screen shows: the app's name, as a live broadcast,
   * with a pause button while on and a play button while off.
   * (On Android this notification is also what keeps the sound alive with the screen off.)
   */
  async function showControls(isOn: boolean): Promise<void> {
    try {
      if (Platform.OS === 'android' && !askedForNotifications) {
        askedForNotifications = true;
        await AudioManager.requestNotificationPermissions();
      }
      await PlaybackNotificationManager.show({
        title: 'Asunder',
        isLiveStream: true,
        state: isOn ? 'playing' : 'paused',
      });
      await PlaybackNotificationManager.enableControl('play', true);
      await PlaybackNotificationManager.enableControl('pause', true);
      for (const control of UNUSED_CONTROLS) {
        await PlaybackNotificationManager.enableControl(control, false);
      }
    } catch (error) {
      console.warn('ReceiverAudio: could not update the lock-screen controls', error);
    }
  }

  async function readOutputs(): Promise<string[]> {
    const info = await AudioManager.getDevicesInfo();
    const devices = Platform.OS === 'ios' ? info.currentOutputs : info.availableOutputs;
    return devices.map((device) => device.category);
  }

  // MARK: On and off
  //
  // Turning the phone's audio on or off takes a moment: every line below that
  // says `await` waits for the phone to answer. If "off" arrived while an "on"
  // was still half done, the two could cross, and the radio could end up
  // playing after it was told to stop. So changes follow one rule:
  //
  //   ONE AT A TIME, AND ALWAYS TOWARD WHAT IS WANTED NOW.
  //
  // Anything that wants the radio on or off sets `wantsToPlay` and calls
  // settle(). settle() waits for any change already under way, then looks at
  // `wantsToPlay` as it is at that moment and does whatever is still needed.

  /**
   * The change that is under way (or the last one that finished).
   * A "Promise" is a note that says "this will be done later"; `.then` means
   * "after that is done, do this".
   */
  let lastChange: Promise<boolean> = Promise.resolve(true);

  /** Do `job` after any change already under way has finished. */
  function inTurn(job: () => Promise<boolean>): Promise<boolean> {
    lastChange = lastChange.then(job);
    return lastChange;
  }

  /**
   * Make the radio match `wantsToPlay`, after any change already under way.
   * Gives back false if the phone said no (e.g. a phone call has the speaker).
   */
  function settle(): Promise<boolean> {
    return inTurn(() => (wantsToPlay ? start() : stop()));
  }

  /** Start playing, unless it already is. Only settle() calls this. */
  async function start(): Promise<boolean> {
    // Already playing, and nothing has cut in since: nothing to do.
    if (context !== null && context.state === 'running' && !wasInterrupted) {
      return true;
    }
    try {
      // Ask to be told about phone calls, alarms and Siri. (On Android this
      // is also how an app asks for its turn at the speaker.)
      AudioManager.observeAudioInterruptions(true);
      if (context === null) {
        context = buildGraph();
      } else {
        // Coming back after a pause or a call: fade in, don't thump.
        fadesRequested += 1;
        fadeRequests.setDirty(fadesRequested);
      }
      await context.resume();
      isStopped = false;
      wasInterrupted = false;
      await showControls(true);
      lastOutputs = await readOutputs();
      return true;
    } catch (error) {
      // No sound is better than a crash. Touching the dial or bringing
      // the app back to the front tries again.
      console.warn('ReceiverAudio: could not start', error);
      return false;
    }
  }

  /**
   * Stop playing and hand the speaker back, unless that's already done.
   * Only settle() calls this.
   */
  async function stop(): Promise<boolean> {
    if (context === null || isStopped) {
      return true;
    }
    try {
      await context.suspend(); // must finish before the speaker is handed back
      await showControls(false);
      if (Platform.OS === 'android') {
        AudioManager.observeAudioInterruptions(false); // gives up our turn at the speaker
      }
      // Hand the speaker back, so whatever another app paused for us can carry on.
      await AudioManager.setAudioSessionActivity(false);
      isStopped = true;
      return true;
    } catch (error) {
      console.warn('ReceiverAudio: could not stop cleanly', error);
      return false;
    }
  }

  function turnOn(): void {
    wantsToPlay = true;
    void settle(); // `void`: "start this and don't wait here for the answer"
  }

  function turnOff(): void {
    wantsToPlay = false;
    void settle();
  }

  // MARK: Things that happen to a radio

  // The lock screen, Control Center and headphone buttons: play turns the
  // radio on, pause turns it off. Without this, the only way to silence the
  // static with the screen locked would be to unlock and quit the app.
  PlaybackNotificationManager.addEventListener('playbackNotificationPlay', turnOn);
  PlaybackNotificationManager.addEventListener('playbackNotificationPause', turnOff);
  PlaybackNotificationManager.addEventListener('playbackNotificationDismissed', () => {
    void PlaybackNotificationManager.hide();
  });

  // A phone call, an alarm, Siri. The phone stops our audio when one starts;
  // when it ends, come back on if the phone says we should.
  AudioManager.addSystemEventListener('interruption', (event) => {
    if (event.type === 'began') {
      wasInterrupted = true;
      // Whenever the sound comes back, fade in, don't thump. (On an iPhone the
      // audio library may restart the sound by itself when the call ends, so
      // the fade is asked for now, not later.)
      fadesRequested += 1;
      fadeRequests.setDirty(fadesRequested);
      // Show "paused" on the lock screen, so the play button (and a squeeze
      // of the headphones) means "turn it back on".
      void inTurn(async () => {
        try {
          if (Platform.OS === 'android' && context !== null) {
            await context.suspend(); // iPhones do this themselves
          }
        } catch (error) {
          console.warn('ReceiverAudio: could not pause for an interruption', error);
        }
        await showControls(false);
        return true;
      });
      return;
    }
    if (event.shouldResume && wantsToPlay) {
      // Right as a call ends, the phone app may not have let go of the
      // speaker yet. If the phone says no, try once more a second later.
      //
      // KNOWN GAP (needs a real iPhone to check): if the iPhone refuses at
      // the moment the call ends, the audio library doesn't tell us the call
      // ended at all, so this never runs. The radio then stays quiet until
      // the app is opened or play is pressed on the lock screen. The Swift
      // app retried by itself after a second.
      void settle().then((started) => {
        if (!started) {
          setTimeout(() => {
            void settle();
          }, 1000);
        }
      });
    }
  });

  // Headphones unplugged or Bluetooth headphones gone: turn off rather than
  // carry on through the speaker. Touch the dial or press play to turn back on.
  AudioManager.addSystemEventListener('routeChange', (event) => {
    const before = lastOutputs;
    void readOutputs()
      .then((now) => {
        lastOutputs = now;
        const lostPrivateOutput = before.some(
          (output) => PRIVATE_OUTPUT.test(output) && !now.includes(output),
        );
        if (event.reason === 'OldDeviceUnavailable' && lostPrivateOutput) {
          turnOff();
        }
      })
      .catch(() => {});
  });

  return {
    tune: (position) => {
      'worklet'; // runs on the screen thread; see the THREADS note at the top
      dialPosition.setDirty(position);
    },
    turnOn: turnOn,
    turnOff: turnOff,
    resumeIfOn: () => {
      void settle();
    },
  };
}
