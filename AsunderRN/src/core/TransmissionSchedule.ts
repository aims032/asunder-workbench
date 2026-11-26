// WHERE AND WHEN EVERY TRANSMISSION IS ON THE BAND. This is the one file to
// edit to add a transmission, move one to another frequency, or change when
// it appears. No other code needs to change.
//
// Decided (Evan, Nov 25): finding a transmission is a skill. Each one lives
// at ONE fixed frequency, the same for every listener, among the hundreds of
// frequencies on the band. The clues that lead you there are the Physicist's
// field log (a frequency and time written at the top of an entry) and Bess's
// bare "SIGNAL" slip when a new one comes on the band.
//
// EVERY VALUE BELOW IS A PLACEHOLDER. The frequencies, days and times are
// Evan's to pick; the words are in the recordings, which are stand-ins.
//
// HOW AN ENTRY IS WRITTEN
//   id            A short, stable name. Bess's print-out uses it, so once a
//                 transmission has shipped, don't rename it.
//   number        1 = Transmission 001.
//   frequencyHz   Where it lives, in Hz: 14_230_000 is 14.23 MHz. (The
//                 underscores are just for reading; the computer ignores them.)
//                 The dial reads four digits, so 14.23 MHz shows as "14.23".
//                 Keep it away from the Carrier (about 19.92 MHz) and from
//                 the other transmissions: at least 5 notches apart, so two
//                 bumps don't blur into one (one notch is about 1.2%).
//   onBandFromDay Which day of the shared clock it appears on (day 0 = the
//                 clock's start, World.epoch). From then on it stays on the
//                 band for good (Confirmed, Evan, Nov 25). While building,
//                 every one is on the band anyway: see
//                 TuneInTuning.everythingOnTheBand.
//   logTime       The time the Physicist writes next to the frequency in the
//                 field log, like "02:10".
//   recording     The transmission itself: its voices and timed script
//                 (Transmission.ts). All of them use the stand-in for now.
//   noticeRange   Optional. What Bess's bare slip says for the range, if you
//                 want to write it yourself instead of it being worked out
//                 (TuneInTuning.noticeDigits), e.g. '14.2–14.3'.
//
// The 'worklet' line below is kept like the other core files: the sound and
// the analyzer (on their own threads) read these numbers.
'worklet';

import type { Transmission } from './Transmission';
import { STAND_IN_TRANSMISSION } from './Transmission';

export interface ScheduledTransmission {
  id: string;
  number: number;
  frequencyHz: number;
  onBandFromDay: number;
  logTime: string;
  recording: Transmission;
  noticeRange?: string;
}

export const TRANSMISSION_SCHEDULE: ScheduledTransmission[] = [
  {
    id: 'transmission-001',
    number: 1,
    frequencyHz: 14_230_000, // PLACEHOLDER frequency: Evan
    onBandFromDay: 0, // PLACEHOLDER day: Evan (the first one is May 25, 2097 in the story)
    logTime: '02:10', // PLACEHOLDER time: Evan
    recording: STAND_IN_TRANSMISSION,
  },
  {
    id: 'transmission-002',
    number: 2,
    frequencyHz: 7_135_000, // PLACEHOLDER frequency: Evan
    onBandFromDay: 1, // PLACEHOLDER day: Evan
    logTime: '[TIME: Evan]',
    recording: STAND_IN_TRANSMISSION,
  },
  {
    id: 'transmission-003',
    number: 3,
    frequencyHz: 3_310_000, // PLACEHOLDER frequency: Evan
    onBandFromDay: 2, // PLACEHOLDER day: Evan
    logTime: '[TIME: Evan]',
    recording: STAND_IN_TRANSMISSION,
  },
];
