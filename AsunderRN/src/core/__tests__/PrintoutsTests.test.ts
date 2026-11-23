import {
  DeskTuning,
  emptyPrinterLog,
  printerLogAdd,
  printerLogAfterClose,
  printerLogCloses,
  printerLogInk,
  printerLogFromText,
  printerLogIsRead,
  printerLogMarkRead,
  printerLogNewestFirst,
  printerLogToText,
  printerLogUnreadCount,
  printoutShouldCue,
} from '../index';
import type { PrinterLog, Printout } from '../index';

// The printer's log (Printouts.ts). There's no Swift version of this, so
// these tests are new rather than ported.

/** A print-out with placeholder words, for testing. */
function slip(id: string, transmission: number, arrivedAtSeconds: number): Printout {
  return { id, transmission, arrivedAtSeconds, lines: [{ text: '[TRANSMISSION TEXT: Evan]' }] };
}

describe('PrintoutsTests', () => {
  test('a new print-out is added and counts as unread', () => {
    const { log, isNew } = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100));
    expect(isNew).toBe(true);
    expect(log.printouts).toHaveLength(1);
    expect(printerLogUnreadCount(log)).toBe(1);
  });

  test('the same print-out twice is only kept once', () => {
    const first = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    const second = printerLogAdd(first, slip('a', 1, 100));
    expect(second.isNew).toBe(false);
    expect(second.log.printouts).toHaveLength(1);
  });

  test('the log stays in arrival order even if slips come in late', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('late', 2, 200)).log;
    log = printerLogAdd(log, slip('early', 1, 100)).log;
    expect(log.printouts.map((p) => p.id)).toEqual(['early', 'late']);
    expect(printerLogNewestFirst(log).map((p) => p.id)).toEqual(['late', 'early']);
  });

  test('marking read lowers the unread count, and only once', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    log = printerLogAdd(log, slip('b', 2, 200)).log;
    log = printerLogMarkRead(log, 'a');
    log = printerLogMarkRead(log, 'a');
    expect(printerLogIsRead(log, 'a')).toBe(true);
    expect(log.readIds).toEqual(['a']);
    expect(printerLogUnreadCount(log)).toBe(1);
  });

  test('marking a print-out that is not there changes nothing', () => {
    const log = emptyPrinterLog();
    expect(printerLogMarkRead(log, 'nope')).toBe(log);
  });

  test('the oldest slips fall off past printerKeeps', () => {
    let log = emptyPrinterLog();
    for (let i = 0; i < DeskTuning.printerKeeps + 3; i++) {
      log = printerLogAdd(log, slip(`p${i}`, 1, i)).log;
    }
    expect(log.printouts).toHaveLength(DeskTuning.printerKeeps);
    expect(log.printouts[0].id).toBe('p3');
  });

  test('the cue only plays from cueFromTransmission on', () => {
    const from = DeskTuning.cueFromTransmission;
    expect(printoutShouldCue(slip('a', from - 1, 0))).toBe(false);
    expect(printoutShouldCue(slip('b', from, 0))).toBe(DeskTuning.cueEnabled);
  });

  test('a saved log reads back the same', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    log = printerLogMarkRead(log, 'a');
    expect(printerLogFromText(printerLogToText(log))).toEqual(log);
  });

  test('a missing or broken save gives an empty log', () => {
    expect(printerLogFromText(null)).toEqual(emptyPrinterLog());
    expect(printerLogFromText('not json')).toEqual(emptyPrinterLog());
    expect(printerLogFromText('{"version":999,"printouts":[],"readIds":[]}')).toEqual(emptyPrinterLog());
  });

  // The fading paper.

  /** Close the app this many times. */
  function closeTimes(log: PrinterLog, times: number): PrinterLog {
    for (let i = 0; i < times; i++) {
      log = printerLogAfterClose(log);
    }
    return log;
  }

  test('a fresh slip has full ink and no closes', () => {
    const log = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    expect(printerLogCloses(log, 'a')).toBe(0);
    expect(printerLogInk(log, 'a')).toBe(1);
  });

  test('each close fades every slip a little, never below the floor', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    let before = printerLogInk(log, 'a');
    for (let close = 1; close < DeskTuning.fadeCloses; close++) {
      log = printerLogAfterClose(log);
      const ink = printerLogInk(log, 'a');
      expect(printerLogCloses(log, 'a')).toBe(close);
      expect(ink).toBeLessThan(before);
      expect(ink).toBeGreaterThanOrEqual(DeskTuning.fadeFloor - 1e-12);
      before = ink;
    }
  });

  test('a slip is still there one close before fadeCloses, and gone at it', () => {
    const fresh = printerLogMarkRead(printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log, 'a');
    const almost = closeTimes(fresh, DeskTuning.fadeCloses - 1);
    expect(almost.printouts).toHaveLength(1);
    const gone = printerLogAfterClose(almost);
    expect(gone).toEqual(emptyPrinterLog());
  });

  test('a reprint goes back to full ink, stays read, and is not new', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log;
    log = closeTimes(printerLogMarkRead(log, 'a'), 20);
    const reprint = printerLogAdd(log, slip('a', 1, 100));
    expect(reprint.isNew).toBe(false);
    expect(reprint.log.printouts).toHaveLength(1);
    expect(printerLogCloses(reprint.log, 'a')).toBe(0);
    expect(printerLogInk(reprint.log, 'a')).toBe(1);
    expect(printerLogIsRead(reprint.log, 'a')).toBe(true);
    // And it lasts a full 33 closes again from here.
    expect(closeTimes(reprint.log, DeskTuning.fadeCloses - 1).printouts).toHaveLength(1);
  });

  test('slips fade on their own counts', () => {
    let log = printerLogAdd(emptyPrinterLog(), slip('old', 1, 100)).log;
    log = closeTimes(log, 5);
    log = printerLogAdd(log, slip('new', 2, 200)).log;
    log = printerLogAfterClose(log);
    expect(printerLogCloses(log, 'old')).toBe(6);
    expect(printerLogCloses(log, 'new')).toBe(1);
  });

  test('the fade counts are saved too', () => {
    const log = closeTimes(printerLogAdd(emptyPrinterLog(), slip('a', 1, 100)).log, 3);
    expect(printerLogCloses(printerLogFromText(printerLogToText(log)), 'a')).toBe(3);
  });
});
