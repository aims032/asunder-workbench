import type { Printout } from '../core';

// THE CUE'S SOUND: a placeholder that plays nothing.
//
// Evan, Nov 23: the cue should be subtle, and it only matters about 30
// transmissions in, so the sound is still to be chosen. When it is, it goes
// here (most likely a short sound on the same audio engine as the static, so
// it sits inside the radio's mix rather than on top of it). The printer
// already calls this at the right moment.
export function playPrintoutCueSound(_printout: Printout): void {
  // Intentionally silent for now.
}
