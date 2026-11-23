import {
  livePrintNowLine,
  livePrintShown,
  printStamp,
  STAND_IN_TRANSMISSION,
  tapeAdvance,
  tapeJump,
  tapeSeconds,
  tapeStart,
  transmissionToPrintout,
} from '../index';
import type { Printout } from '../index';

// The live print-out and its tape (LivePrint.ts). New tests; there's no Swift version.

const slip: Printout = {
  id: 'test',
  transmission: 0,
  arrivedAtSeconds: 0,
  lines: [{ text: 'HEADER' }, { text: 'abcdefghij', atSeconds: 2 }, { text: 'klmnop', atSeconds: 5 }],
};

describe('LivePrintTests: the tape', () => {
  test('a fresh tape is at 0 and moves with the clock', () => {
    const tape = tapeStart(1000);
    expect(tapeSeconds(tape, 16, 1000)).toBe(0);
    expect(tapeSeconds(tape, 16, 1003.5)).toBe(3.5);
  });

  test('it loops at the end', () => {
    expect(tapeSeconds(tapeStart(1000), 16, 1018)).toBe(2);
  });

  test('the paper only ever gets further', () => {
    let tape = tapeStart(1000);
    tape = tapeAdvance(tape, 16, 1006);
    expect(tape.printedThroughSeconds).toBe(6);
    tape = tapeJump(tape, 1006, 2); // back to 2 s
    expect(tapeSeconds(tape, 16, 1006)).toBe(2);
    tape = tapeAdvance(tape, 16, 1007);
    expect(tape.lastSeconds).toBe(3);
    expect(tape.printedThroughSeconds).toBe(6);
  });

  test("a jump can't go past what's printed", () => {
    const tape = tapeJump(tapeAdvance(tapeStart(1000), 16, 1004), 1004, 12);
    expect(tapeSeconds(tape, 16, 1004)).toBe(4);
  });

  test('once the tape loops by itself, everything is printed', () => {
    let tape = tapeAdvance(tapeStart(1000), 16, 1015);
    tape = tapeAdvance(tape, 16, 1017);
    expect(tape.printedThroughSeconds).toBe(16);
    expect(tape.lastSeconds).toBe(1);
  });
});

describe('LivePrintTests: the paper', () => {
  test('a line with no time is there from the start; the rest wait their turn', () => {
    expect(livePrintShown(slip, 0, 4)).toEqual(['HEADER', '', '']);
  });

  test('a line types out at the set speed from the moment it starts', () => {
    expect(livePrintShown(slip, 3, 4)).toEqual(['HEADER', 'abcd', '']);
    expect(livePrintShown(slip, 5.5, 4)).toEqual(['HEADER', 'abcdefghij', 'kl']);
    expect(livePrintShown(slip, 100, 4)).toEqual(['HEADER', 'abcdefghij', 'klmnop']);
  });

  test('the "now" mark sits on the last line that has started', () => {
    expect(livePrintNowLine(slip, 1)).toBe(-1);
    expect(livePrintNowLine(slip, 2)).toBe(1);
    expect(livePrintNowLine(slip, 4.9)).toBe(1);
    expect(livePrintNowLine(slip, 9)).toBe(2);
  });

  test('time stamps read as minutes and seconds', () => {
    expect(printStamp(0.5)).toBe('00:00');
    expect(printStamp(67.9)).toBe('01:07');
    expect(printStamp(600)).toBe('10:00');
  });

  test('the stand-in transmission prints one line per script line, in order', () => {
    const made = transmissionToPrintout(STAND_IN_TRANSMISSION, 0);
    const end = STAND_IN_TRANSMISSION.durationSeconds;
    expect(livePrintShown(made, end, 1000).every((text) => text.length > 0)).toBe(true);
    expect(livePrintNowLine(made, end)).toBe(made.lines.length - 1);
  });
});
