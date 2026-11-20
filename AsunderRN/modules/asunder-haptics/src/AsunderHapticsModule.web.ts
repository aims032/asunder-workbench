import type { AsunderHapticsNative } from './AsunderHaptics.types';

// THE WEB VERSION: almost nothing.
//
// Browsers on iPhone have no haptics at all. Chrome on Android can buzz for a
// number of milliseconds, with no strength or sharpness. So on the web:
//   tick  does nothing (45 buzzes a second would smear into one long buzz)
//   lock  is a short buzz where the browser allows it

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const webHaptics: AsunderHapticsNative | null = {
  prepare: () => canVibrate,
  tick: () => {},
  lock: (_intensity, _sharpness, durationSeconds) => {
    if (canVibrate) {
      navigator.vibrate(Math.round(durationSeconds * 1000));
    }
  },
};

export default webHaptics;
