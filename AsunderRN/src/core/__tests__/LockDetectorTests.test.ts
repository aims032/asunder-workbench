import { Tuning, createLockDetector, lockUpdate } from '../index';

// Ported from AsunderCore/Tests/AsunderCoreTests/LockDetectorTests.swift.
// One test here per Swift test function, same name, same numbers.

describe('LockDetectorTests', () => {
  /// Feed a run of distances (detents); return the indexes where it pulsed.
  function pulses(distances: number[]): number[] {
    const lock = createLockDetector();
    const pulsed: number[] = [];
    for (let i = 0; i < distances.length; i += 1) {
      if (lockUpdate(lock, distances[i])) {
        pulsed.push(i);
      }
    }
    return pulsed;
  }

  test('testPulsesOnceOnArrival', () => {
    expect(pulses([3, 2, 1, 0, 0, 0, 0])).toEqual([3]);
  });

  test('testSittingOnTheCenterDoesntRepeat', () => {
    const fiftyZeros: number[] = new Array<number>(50).fill(0);
    expect(pulses(fiftyZeros)).toEqual([0]);
  });

  test('testMovingAwayAndBackPulsesAgain', () => {
    expect(pulses([0, 1, 0])).toEqual([0, 2]);
  });

  test('testWobblingInsideTheReleaseDoesntRepeat', () => {
    expect(pulses([0, 0.5, 0.1, 0.6, 0])).toEqual([0]);
  });

  test('testAFastSpinAcrossTheCenterStillBumps', () => {
    // Jumps from 4 above to 3 below in one frame without ever landing near.
    expect(pulses([12, 8, 4, -3, -7])).toEqual([3]);
  });

  test('testTheFarSideOfTheLoopIsNotACrossing', () => {
    // Half a band away the distance flips sign (+1149 to -1149 notches on
    // the wide band). That's the far side of the loop, not the center.
    const half = 0.5 / Tuning.detentSpacing - 1;
    expect(pulses([half, -half, half])).toEqual([]);
  });

  test('testLeavingThroughTheCenterDoesntPulseTwice', () => {
    expect(pulses([0, -4, -8])).toEqual([0]);
  });
});
