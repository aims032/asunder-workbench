import type { DialPhysics } from '../index';
import {
  Tuning,
  bandPosition,
  createDialPhysics,
  dialBand,
  dialDetentIndexOf,
  dialDrag,
  dialGrab,
  dialIsAtRest,
  dialRelease,
  dialStep,
  roundHalfAwayFromZero,
} from '../index';

// Ported from AsunderCore/Tests/AsunderCoreTests/DialPhysicsTests.swift.
// One test here per Swift test function, same name, same numbers.

describe('DialPhysicsTests', () => {
  const frame = 1.0 / 60.0;
  const detent = Tuning.detentSpacing;

  /// Run time forward until the wheel comes to rest (or 30 s pass).
  function runToRest(dial: DialPhysics, frameStep: number = 1.0 / 60.0): void {
    let t = 0.0;
    while (!dialIsAtRest(dial) && t < 30) {
      dialStep(dial, frameStep);
      t += frameStep;
    }
  }

  /// Grab, swipe `perFrame` each frame for `frames` frames, then let go.
  function flick(
    dial: DialPhysics,
    perFrame: number,
    frames: number,
    frameStep: number = 1.0 / 60.0,
  ): void {
    dialGrab(dial);
    for (let i = 0; i < frames; i += 1) {
      dialDrag(dial, perFrame);
      dialStep(dial, frameStep);
    }
    dialRelease(dial);
  }

  function isOnANotch(position: number): boolean {
    const inDetents = position / detent;
    // Swift's .rounded() sends halves away from zero; Math.round doesn't.
    return Math.abs(inDetents - roundHalfAwayFromZero(inDetents)) < 0.01;
  }

  // MARK: A slow drag tracks the finger exactly

  test('testDragMovesTheWheelExactly', () => {
    const dial = createDialPhysics(0.2);
    dialGrab(dial);
    dialDrag(dial, 0.01);
    expect(Math.abs(dial.position - 0.21)).toBeLessThanOrEqual(1e-12);
    dialStep(dial, frame);
    // held: no coasting
    expect(Math.abs(dial.position - 0.21)).toBeLessThanOrEqual(1e-12);
  });

  test('testNeedleLagsThenCatchesUp', () => {
    const dial = createDialPhysics(0.2);
    dialGrab(dial);
    dialDrag(dial, 0.01);
    dialStep(dial, frame);
    expect(dial.needle).toBeGreaterThan(0.2);
    // needle is behind the hand
    expect(dial.needle).toBeLessThan(0.21);
    for (let i = 0; i < 120; i += 1) {
      dialStep(dial, frame);
    }
    expect(Math.abs(dial.needle - 0.21)).toBeLessThanOrEqual(1e-6);
  });

  // MARK: A flick coasts, slows, and clicks into a notch

  test('testFlickCoastsThenStopsOnANotch', () => {
    const dial = createDialPhysics(0.3);
    flick(dial, 2 * detent, 10); // ~120 detents/s
    const released = dial.position;
    expect(dial.velocity).toBeGreaterThan(0);

    dialStep(dial, frame);
    // keeps going after release
    expect(dial.position).toBeGreaterThan(released);

    runToRest(dial);
    expect(dialIsAtRest(dial)).toBe(true);
    // coasted a real distance
    expect(dial.position - released).toBeGreaterThan(20 * detent);
    expect(isOnANotch(dial.position)).toBe(true);
    expect(dial.needle).toBe(dial.position);
  });

  test('testFlickBackwardsCoastsBackwards', () => {
    const dial = createDialPhysics(0.5);
    flick(dial, -2 * detent, 10);
    const released = dial.position;
    runToRest(dial);
    expect(dial.position).toBeLessThan(released);
    expect(isOnANotch(dial.position)).toBe(true);
  });

  test('testGrabbingStopsACoastDead', () => {
    const dial = createDialPhysics(0.3);
    flick(dial, 2 * detent, 10);
    for (let i = 0; i < 10; i += 1) {
      dialStep(dial, frame);
    }
    dialGrab(dial);
    const held = dial.position;
    expect(dial.velocity).toBe(0);
    for (let i = 0; i < 30; i += 1) {
      dialStep(dial, frame);
    }
    expect(Math.abs(dial.position - held)).toBeLessThanOrEqual(1e-12);
  });

  test('testStoppingBeforeLiftingDoesNotFlick', () => {
    const dial = createDialPhysics(0.3);
    dialGrab(dial);
    for (let i = 0; i < 10; i += 1) {
      dialDrag(dial, 2 * detent);
      dialStep(dial, frame);
    }
    for (let i = 0; i < 30; i += 1) {
      dialStep(dial, frame); // finger holds still for half a second
    }
    const lifted = dial.position;
    dialRelease(dial);
    expect(dial.velocity).toBe(0);
    runToRest(dial);
    // just seats into the nearest notch
    expect(Math.abs(dial.position - lifted)).toBeLessThan(detent);
  });

  test('testSlowReleaseSettlesToTheNearestNotch', () => {
    const dial = createDialPhysics(0);
    dialGrab(dial);
    dialDrag(dial, 0.4 * detent);
    for (let i = 0; i < 60; i += 1) {
      dialStep(dial, frame);
    }
    dialRelease(dial);
    runToRest(dial);
    // 0.4 of a notch rolls back to 0
    expect(Math.abs(dial.position - 0)).toBeLessThanOrEqual(1e-12);
  });

  test('testFlickSpeedIsCapped', () => {
    const dial = createDialPhysics(0);
    flick(dial, 50 * detent, 10); // absurdly fast swipe
    expect(dial.velocity).toBeLessThanOrEqual(Tuning.maxFlickSpeed * detent + 1e-12);
  });

  // MARK: No end stop

  test('testTheWheelSpinsPastTheSeam', () => {
    const dial = createDialPhysics(0.99);
    dialGrab(dial);
    dialDrag(dial, 0.05);
    // position keeps counting
    expect(Math.abs(dial.position - 1.04)).toBeLessThanOrEqual(1e-12);
    // the band wraps
    expect(Math.abs(dialBand(dial) - 0.04)).toBeLessThanOrEqual(1e-12);
  });

  // MARK: Same feel at any frame rate

  test('testCoastDistanceIsTheSameAt60And120FPS', () => {
    function coast(fps: number): number {
      const dial = createDialPhysics(0);
      const frameStep = 1 / fps;
      // The same finger speed: 120 detents/s for 1/6 s.
      flick(dial, 120 * detent * frameStep, Math.trunc(fps / 6), frameStep);
      const released = dial.position;
      runToRest(dial, frameStep);
      return dial.position - released;
    }
    const at60 = coast(60);
    const at120 = coast(120);
    expect(Math.abs(at60 - at120)).toBeLessThanOrEqual(Math.max(at60, at120) * 0.1 + 2 * detent);
  });

  // MARK: Lock-on snap

  test('testRestingNearASnapPointSettlesOnIt', () => {
    const point = bandPosition(0.4 + 0.37 * detent); // between two notches
    const dial = createDialPhysics(0.4 + 0.1 * detent); // near the notch at 0.4
    dial.snapPoints = [point];
    dialGrab(dial);
    dialRelease(dial);
    runToRest(dial);
    expect(Math.abs(dialBand(dial) - point)).toBeLessThanOrEqual(1e-9);
  });

  test('testFarFromASnapPointItSettlesOnANotch', () => {
    const dial = createDialPhysics(0.4);
    dial.snapPoints = [bandPosition(0.4 + 5 * detent)];
    dialGrab(dial);
    dialRelease(dial);
    runToRest(dial);
    expect(isOnANotch(dial.position)).toBe(true);
  });

  test('testSnapWorksAcrossTheSeam', () => {
    // A snap point just past the top of the band, approached from three laps up.
    const point = bandPosition(0.2 * detent);
    const dial = createDialPhysics(3 - 0.2 * detent);
    dial.snapPoints = [point];
    dialGrab(dial);
    dialRelease(dial);
    runToRest(dial);
    expect(Math.abs(dialBand(dial) - point)).toBeLessThanOrEqual(1e-9);
    // same lap, no spin round
    expect(Math.abs(dial.position - (3 + 0.2 * detent))).toBeLessThanOrEqual(1e-9);
  });

  // MARK: Detents

  test('testDetentIndexChangesHalfwayBetweenNotches', () => {
    expect(dialDetentIndexOf(0.49 * detent)).toBe(0);
    expect(dialDetentIndexOf(0.51 * detent)).toBe(1);
    expect(dialDetentIndexOf(-0.51 * detent)).toBe(-1);
  });
});
