import {
  analyzerMeasure,
  bandDistance,
  createClock,
  createReceiverTargets,
  nearestSignal,
  receptionTargets,
  signalBandPower,
  signalClarity,
  signalDetentsAway,
  signalDialLabel,
  signalLogHeader,
  signalNoticeId,
  signalNoticePrintout,
  signalNoticeRange,
  signalPosition,
  signalPowerOf,
  signalPrintout,
  signalReception,
  signalStage,
  SWITCHBOARD_LAYOUT,
  TRANSMISSION_SCHEDULE,
  transmissionProblems,
  TuneInTuning,
  Tuning,
  World,
} from '../index';

// Tuning in a transmission (TuningIn.ts): a faint bump from far away, a
// voiceprint as you get close, locked when you're on it. And the schedule
// (TransmissionSchedule.ts) has to make sense, because every phone reads it.

describe('TuningInTests', () => {
  const clock = createClock();
  const first = TRANSMISSION_SCHEDULE[0];
  const at = signalPosition(first);
  const notch = Tuning.detentSpacing;
  // The stand-in loops every 16 s and voice-1 speaks from 0.5 to 4 s.
  // 1,800,000,000 is a whole number of loops, so +2.15 s is mid-syllable.
  const speaking = 1_800_000_002.15;

  describe('the schedule', () => {
    test('ids are unique', () => {
      const ids = TRANSMISSION_SCHEDULE.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('every transmission is at least 5 notches from the others and from the Carrier', () => {
      const places = [World.carrierPosition, ...TRANSMISSION_SCHEDULE.map(signalPosition)];
      for (let i = 0; i < places.length; i += 1) {
        for (let j = i + 1; j < places.length; j += 1) {
          expect(Math.abs(bandDistance(places[i], places[j])) / notch).toBeGreaterThanOrEqual(5);
        }
      }
    });

    test('every recording is a valid transmission file', () => {
      for (const entry of TRANSMISSION_SCHEDULE) {
        expect(transmissionProblems(entry.recording, SWITCHBOARD_LAYOUT.outputs)).toEqual([]);
      }
    });
  });

  describe('how close counts', () => {
    test('clarity is 1 dead on and falls away either side', () => {
      expect(signalClarity(0)).toBe(1);
      expect(signalClarity(1)).toBeLessThan(1);
      expect(signalClarity(4)).toBeLessThan(signalClarity(1));
      expect(signalClarity(-2)).toBeCloseTo(signalClarity(2));
    });

    test('the three steps: locked on it, close a notch or two off, faint further out', () => {
      expect(signalStage(0)).toBe('locked');
      expect(signalStage(Tuning.lockDistance)).toBe('locked');
      expect(signalStage(1.5)).toBe('close');
      expect(signalStage(-1.5)).toBe('close');
      expect(signalStage(10)).toBe('faint');
    });

    test('distance is in notches and goes the short way', () => {
      expect(signalDetentsAway(first, at)).toBeCloseTo(0);
      expect(signalDetentsAway(first, at - 3 * notch)).toBeCloseTo(3);
      expect(signalDetentsAway(first, at + 3 * notch)).toBeCloseTo(-3);
    });

    test('the nearest transmission is the one the dial is closest to', () => {
      for (let i = 0; i < TRANSMISSION_SCHEDULE.length; i += 1) {
        const p = signalPosition(TRANSMISSION_SCHEDULE[i]);
        expect(nearestSignal(p + notch, speaking, clock)).toBe(i);
      }
    });
  });

  describe('what the analyzer sees', () => {
    test('from far away it is a faint bump above the static', () => {
      const farDial = at + 0.05; // over a hundred notches away
      const bump = signalPowerOf(first, at, 0, farDial, speaking);
      expect(10 * Math.log10(bump)).toBeCloseTo(TuneInTuning.faintDb, 0);
      // and nothing at all well clear of it
      expect(signalPowerOf(first, at + 10 * notch, 0, farDial, speaking)).toBe(0);
    });

    test('the analyzer only draws transmissions when it is told where the dial is', () => {
      const without = analyzerMeasure(at, 0, 1e-4, speaking, clock, false);
      const withDial = analyzerMeasure(at, 0, 1e-4, speaking, clock, false, at + 0.05);
      expect(withDial).toBeGreaterThan(without);
    });

    test('locked on, it is stronger and shows a voiceprint (ridges, not a smooth hump)', () => {
      const n = 61;
      const values = (dial: number) => {
        const out: number[] = [];
        for (let i = 0; i < n; i += 1) {
          const p = at + ((i / (n - 1)) * 2 - 1) * TuneInTuning.signalHalfWidthDetents * 0.9 * notch;
          out.push(10 * Math.log10(signalPowerOf(first, p, 0, dial, speaking) + 1e-30));
        }
        return out;
      };
      const far = values(at + 0.05);
      const locked = values(at);
      expect(Math.max(...locked)).toBeGreaterThan(Math.max(...far) + 10);
      // Count how often the line changes direction: a smooth bump turns once,
      // a voiceprint's harmonics make it zigzag.
      const turns = (v: number[]) => {
        let count = 0;
        for (let i = 2; i < v.length; i += 1) {
          if ((v[i] - v[i - 1]) * (v[i - 1] - v[i - 2]) < 0) count += 1;
        }
        return count;
      };
      expect(turns(far)).toBeLessThanOrEqual(1);
      expect(turns(locked)).toBeGreaterThan(4);
    });

    test('between words, a locked signal drops to a faint outline but does not vanish', () => {
      const silent = 1_800_000_004.2; // between voice-1 and voice-2
      const p = signalBandPower(at, 0, at, silent, clock);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(signalBandPower(at, 0, at, speaking, clock));
    });
  });

  describe('what you hear', () => {
    test('the static quiets and the sound opens up as you tune in', () => {
      const base = createReceiverTargets();
      const tuned = createReceiverTargets();
      receptionTargets(base, at, speaking, clock);
      receptionTargets(tuned, at, speaking, clock);
      signalReception(tuned, at, speaking, clock);
      expect(tuned.white).toBeLessThan(base.white);
      expect(tuned.lowpassHz).toBeGreaterThan(base.lowpassHz);

      const farOff = createReceiverTargets();
      receptionTargets(farOff, at + 0.05, speaking, clock);
      const before = farOff.white;
      signalReception(farOff, at + 0.05, speaking, clock);
      expect(farOff.white).toBe(before);
    });
  });

  describe('the clues', () => {
    test('labels read the way the dial reads', () => {
      expect(signalDialLabel(first)).toBe('14.23 MHz');
      expect(signalLogHeader(first)).toBe('14.23 MHz · 02:10');
    });

    test('the notice range is rough and always contains the real frequency', () => {
      expect(signalNoticeRange(first)).toBe('14.2–14.3 MHz');
      expect(signalNoticeRange({ ...first, frequencyHz: 7_135_000 })).toBe('7.13–7.14 MHz');
      expect(signalNoticeRange({ ...first, noticeRange: 'somewhere' })).toBe('somewhere MHz');
    });

    test('the notice slip is bare: the range and the time, no transmission words', () => {
      const slip = signalNoticePrintout(first, 100, '02:10');
      expect(slip.id).toBe(signalNoticeId(first));
      expect(slip.lines.map((l) => l.text)).toEqual([`${TuneInTuning.noticeWord} 14.2–14.3 MHz`, '02:10']);
    });

    test('the locked print-out carries the frequency then the script', () => {
      const slip = signalPrintout(first, 100);
      expect(slip.id).toBe(first.id);
      expect(slip.transmission).toBe(first.number);
      expect(slip.lines[0].text).toBe('14.23 MHz');
      expect(slip.lines.length).toBe(first.recording.script.length + 1);
    });
  });
});
