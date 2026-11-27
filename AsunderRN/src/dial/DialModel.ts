import { makeMutable } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ReceiverAudio } from '../audio/ReceiverAudio.types';
import {
  carrierDetentsAway,
  carrierIsOnAir,
  carrierPosition,
  createClock,
  createDialPhysics,
  createLockDetector,
  dialBand,
  dialDetentIndex,
  dialDrag,
  dialGrab,
  dialIsAtRest,
  dialNeedleBand,
  dialRelease,
  dialStep,
  lockUpdate,
  nearestSignal,
  signalDetentsAway,
  signalIsOnBand,
  signalPosition,
  TRANSMISSION_SCHEDULE,
  Tuning,
} from '../core';
import type { AsunderClock, BandPosition, DialPhysics, LockDetector } from '../core';
import { hapticLock, hapticTick } from '../haptics/Haptics';

// THE LIVE DIAL: owns the physics and runs it every frame. Each frame it
//   - tells the radio where it's tuned,
//   - plays the lock pulse when the wheel arrives on the Carrier or a transmission,
//   - plays a haptic tick when the wheel passes any other notch.
// Touching it also turns the radio on, if it was off.
//
// WHERE THIS RUNS. To follow a finger smoothly (up to 120 times a second), the
// dial's code runs on the screen's own thread, not on the ordinary JS thread
// where most of the app runs. Two things in this file make that work:
//
//   'worklet'      A function whose first line is 'worklet' is allowed to run
//                  on the screen thread. Every function below that touches the
//                  physics has it.
//
//   shared value   A box holding a value that lives on the screen thread.
//                  You read and write what's inside with `.value`. The
//                  drawings (the wheel, the needle) watch these boxes and
//                  redraw themselves whenever the contents change.
//
// Haptics and turning the radio on happen back on the JS thread, so those
// calls go through scheduleOnRN ("run this over on the JS thread").

/**
 * Everything the dial remembers from one frame to the next.
 * It lives on the screen thread, inside `model.state`.
 */
interface DialState {
  physics: DialPhysics;
  lock: LockDetector;
  /** The same lock pulse, for arriving on a transmission (TuningIn.ts). */
  signalLock: LockDetector;
  clock: AsunderClock;
  /** The notch the wheel was nearest last frame, to notice when it passes one. */
  lastDetent: number;
  /** When the last tick played, in seconds, to cap how often they play. */
  lastTickTime: number;
}

/** The dial, as the rest of the app holds it. */
export interface DialModel {
  /** Internal: the physics and its bookkeeping. Only the functions in this file touch it. */
  state: SharedValue<DialState>;

  // What the drawings read:
  /** Where the needle and readout point (lags the wheel slightly). A band position, 0..<1. */
  needle: SharedValue<BandPosition>;
  /** How far the wheel itself has turned, in detents, unwrapped. Drives the wheel drawing. */
  wheelDetents: SharedValue<number>;

  /** Internal: the wires out to the sound and the haptics. */
  tune: (position: number) => void;
  turnRadioOn: () => void;
}

/**
 * Where the dial sits when the app opens: mid-band.
 * Whether it should remember where you left it is OPEN (Instruments §9 #8);
 * for now it always opens here.
 */
export const DIAL_START = 0.5;

/** `start` is where the dial sits when the app opens. */
export function createDialModel(audio: ReceiverAudio, start: number = DIAL_START): DialModel {
  const physics = createDialPhysics(start);
  // The wheel snaps onto features: the Carrier, and every transmission that's
  // on the band when the app opens. (One that comes on while the app is open
  // gets its snap the next time the app opens; it still shows and locks.)
  const clock = createClock();
  const now = Date.now() / 1000;
  physics.snapPoints = [carrierPosition()];
  for (const entry of TRANSMISSION_SCHEDULE) {
    if (signalIsOnBand(entry, now, clock)) {
      physics.snapPoints.push(signalPosition(entry));
    }
  }

  audio.tune(start);

  return {
    state: makeMutable<DialState>({
      physics: physics,
      lock: createLockDetector(),
      signalLock: createLockDetector(),
      clock: clock,
      lastDetent: dialDetentIndex(physics),
      lastTickTime: 0,
    }),
    needle: makeMutable(dialNeedleBand(physics)),
    wheelDetents: makeMutable(physics.position / Tuning.detentSpacing),
    tune: audio.tune,
    turnRadioOn: audio.turnOn,
  };
}

/** Copy the physics' answers into the boxes the drawings watch. */
function publish(model: DialModel, physics: DialPhysics): void {
  'worklet';
  model.needle.value = dialNeedleBand(physics);
  model.wheelDetents.value = physics.position / Tuning.detentSpacing;
}

// MARK: What the touch handling calls

export function dialModelGrab(model: DialModel): void {
  'worklet';
  dialGrab(model.state.value.physics);
  scheduleOnRN(model.turnRadioOn); // does nothing if it's already playing
}

export function dialModelDrag(model: DialModel, detents: number): void {
  'worklet';
  const physics = model.state.value.physics;
  dialDrag(physics, detents * Tuning.detentSpacing);
  // Show the move straight away, without waiting for the next frame:
  // the wheel should feel glued to the finger.
  publish(model, physics);
}

export function dialModelRelease(model: DialModel): void {
  'worklet';
  dialRelease(model.state.value.physics);
}

// MARK: Every frame

function playTick(state: DialState, nowSeconds: number): void {
  'worklet';
  // On a fast spin, cap the tick rate so it reads as a buzz, not mush.
  if (nowSeconds - state.lastTickTime < 1 / Tuning.maxTicksPerSecond) {
    return;
  }
  state.lastTickTime = nowSeconds;

  // And soften each tick the faster it spins (Tuning.tickSoftenSpeed):
  // full strength when turned slowly, half at that speed, fainter beyond.
  const speed = Math.abs(state.physics.velocity) / Tuning.detentSpacing; // detents per second
  const strength = 1 / (1 + speed / Tuning.tickSoftenSpeed);
  scheduleOnRN(hapticTick, strength);
}

/**
 * Move the dial forward by `dt` seconds. Called once per screen frame while
 * the wheel is moving. Gives back false once everything has come to rest,
 * which tells the caller it can stop calling until the next touch.
 */
export function dialModelFrame(model: DialModel, dt: number): boolean {
  'worklet';
  const state = model.state.value;
  const physics = state.physics;

  dialStep(physics, dt);

  // The sound follows the wheel itself, not the lagging needle: the
  // hand, the ticks and the sound all agree on where you are.
  model.tune(physics.position);

  // The Carrier: during its day-turn dropout there's nothing there to
  // lock on to, so its notch behaves like any other.
  const away = carrierDetentsAway(dialBand(physics));
  const carrierOnAir = carrierIsOnAir(Date.now() / 1000, state.clock);

  // The distinct pulse for arriving on the Carrier (or spinning across it).
  if (lockUpdate(state.lock, away) && carrierOnAir) {
    scheduleOnRN(hapticLock);
  }

  // The same pulse for arriving on a transmission. (Far from all of them,
  // or none on the band, it's fed a distance far bigger than any lock.)
  const nearest = nearestSignal(dialBand(physics), Date.now() / 1000, state.clock);
  const signalAway = nearest < 0 ? 1e6 : signalDetentsAway(TRANSMISSION_SCHEDULE[nearest], dialBand(physics));
  if (lockUpdate(state.signalLock, signalAway)) {
    scheduleOnRN(hapticLock);
  }

  // A tick for every notch passed, except the Carrier's own notch, which
  // gets the lock pulse instead. (A notch "starts" half a detent before
  // its center, which is when its tick would play.)
  const detent = dialDetentIndex(physics);
  if (detent !== state.lastDetent) {
    state.lastDetent = detent;
    const onCarrierNotch = carrierOnAir && Math.abs(away) <= 0.5;
    const onSignalNotch = Math.abs(signalAway) <= 0.5;
    if (!onCarrierNotch && !onSignalNotch) {
      // performance.now() is a stopwatch in milliseconds that never jumps
      // (unlike the wall clock, which can be corrected while you watch).
      playTick(state, performance.now() / 1000);
    }
  }

  publish(model, physics);
  return !dialIsAtRest(physics);
}
