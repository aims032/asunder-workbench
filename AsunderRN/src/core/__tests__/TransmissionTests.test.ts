import {
  STAND_IN_TRANSMISSION,
  SWITCHBOARD_LAYOUT,
  transmissionProblems,
  transmissionToPrintout,
  transmissionVoicesOn,
} from '../index';
import type { Transmission } from '../index';

// The transmission file format (Transmission.ts). New tests; no Swift version.

const lines = SWITCHBOARD_LAYOUT.outputs;

/** A small, valid transmission to break in different ways. */
function sample(): Transmission {
  return {
    id: 't',
    number: 1,
    durationSeconds: 10,
    voices: [
      { id: 'voice-1', audioFile: null, standIn: { pitchHz: 110, formantsHz: [600], breath: 0.2 } },
      { id: 'voice-2', audioFile: null, standIn: { pitchHz: 200, formantsHz: [800], breath: 0.2 } },
    ],
    script: [
      { atSeconds: 1, endSeconds: 4, line: 'line-1', voice: 'voice-1', text: '[TRANSMISSION TEXT: Evan]', note: 'click' },
      { atSeconds: 3, endSeconds: 6, line: 'line-1', voice: 'voice-2', text: '[TRANSMISSION TEXT: Evan]' },
      { atSeconds: 7, endSeconds: 9, line: 'line-2', voice: 'voice-1', text: '[TRANSMISSION TEXT: Evan]' },
    ],
  };
}

describe('TransmissionTests', () => {
  test('the stand-in and the sample have no problems', () => {
    expect(transmissionProblems(STAND_IN_TRANSMISSION, lines)).toEqual([]);
    expect(transmissionProblems(sample(), lines)).toEqual([]);
  });

  test('the stand-in holds no words of its own', () => {
    for (const entry of STAND_IN_TRANSMISSION.script) {
      expect(entry.text).toBe('[TRANSMISSION TEXT: Evan]');
    }
  });

  test('problems are named in plain words', () => {
    const t = sample();
    t.script[0].voice = 'nobody';
    t.script[1].line = 'line-99';
    t.script[2].endSeconds = 99;
    const problems = transmissionProblems(t, lines);
    expect(problems).toContain('script line 1: there is no voice called nobody');
    expect(problems).toContain('script line 2: there is no phone line called line-99');
    expect(problems).toContain('script line 3: it runs outside the transmission');
  });

  test('out-of-order lines, backwards lines and twin voices are caught', () => {
    const t = sample();
    t.script[2].atSeconds = 0.5;
    t.script[0].endSeconds = 0;
    t.voices[1].id = 'voice-1';
    const problems = transmissionProblems(t, lines);
    expect(problems).toContain('script line 3: it starts before the line above it');
    expect(problems).toContain('script line 1: it must end after it starts');
    expect(problems).toContain('two voices are both called voice-1');
  });

  test('who is on a line at a moment', () => {
    const t = sample();
    expect(transmissionVoicesOn(t, 'line-1', 0)).toEqual([]);
    expect(transmissionVoicesOn(t, 'line-1', 2)).toEqual(['voice-1']);
    expect(transmissionVoicesOn(t, 'line-1', 3.5)).toEqual(['voice-1', 'voice-2']); // talking over each other
    expect(transmissionVoicesOn(t, 'line-1', 5)).toEqual(['voice-2']);
    expect(transmissionVoicesOn(t, 'line-2', 5)).toEqual([]);
    expect(transmissionVoicesOn(t, 'line-2', 8)).toEqual(['voice-1']);
    expect(transmissionVoicesOn(t, 'line-1', 4)).toEqual(['voice-2']); // a line ends just before its end time
  });

  test('the print-out has one timed line per script line, with sound notes', () => {
    const printout = transmissionToPrintout(sample(), 1234);
    expect(printout.id).toBe('t');
    expect(printout.transmission).toBe(1);
    expect(printout.arrivedAtSeconds).toBe(1234);
    expect(printout.lines.map((l) => l.atSeconds)).toEqual([1, 3, 7]);
    expect(printout.lines[0].text).toBe('line-1 · voice-1 · [TRANSMISSION TEXT: Evan] [click]');
    expect(printout.lines[2].text).toBe('line-2 · voice-1 · [TRANSMISSION TEXT: Evan]');
  });
});
