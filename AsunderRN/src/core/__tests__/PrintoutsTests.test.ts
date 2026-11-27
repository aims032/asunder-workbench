import {
  DeskTuning,
  emptyPrinterLog,
  printerLogAdd,
  printerLogFromText,
  printerLogIsRead,
  printerLogMarkRead,
  printerLogNewestFirst,
  printerLogToText,
  printerLogUnreadCount,
  printoutShouldCue,
} from '../index';
import type { Printout } from '../index';

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
});
