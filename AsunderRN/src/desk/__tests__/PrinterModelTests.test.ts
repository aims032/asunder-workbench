import { DeskTuning, printerLogCloses } from '../../core';
import type { Printout } from '../../core';
import { createPrinterModel } from '../PrinterModel';
import type { PrinterStorage } from '../PrinterStorage.types';
import { createSwitchboardModel } from '../SwitchboardModel';

// The live printer's cue hook and saving, and the live switchboard.

function memoryStorage(): PrinterStorage & { saved: string | null } {
  const storage = {
    saved: null as string | null,
    load: () => storage.saved,
    save: (text: string) => {
      storage.saved = text;
    },
  };
  return storage;
}

function slip(id: string, transmission: number): Printout {
  return { id, transmission, arrivedAtSeconds: 0, lines: [{ text: '[TRANSMISSION TEXT: Evan]' }] };
}

describe('PrinterModelTests', () => {
  test('the cue fires once for a new print-out from cueFromTransmission on', () => {
    const printer = createPrinterModel(memoryStorage());
    const cued: string[] = [];
    printer.onCue((p) => cued.push(p.id));
    printer.receive(slip('early', DeskTuning.cueFromTransmission - 1));
    printer.receive(slip('late', DeskTuning.cueFromTransmission));
    printer.receive(slip('late', DeskTuning.cueFromTransmission)); // delivered twice
    expect(cued).toEqual(DeskTuning.cueEnabled ? ['late'] : []);
  });

  test('a stopped listener hears nothing', () => {
    const printer = createPrinterModel(memoryStorage());
    const cued: string[] = [];
    const stop = printer.onCue((p) => cued.push(p.id));
    stop();
    printer.receive(slip('late', DeskTuning.cueFromTransmission));
    expect(cued).toEqual([]);
  });

  test('the roll is saved, and opening the app again fades it one step', () => {
    const storage = memoryStorage();
    const first = createPrinterModel(storage);
    first.receive(slip('a', 1));
    first.markRead('a');
    const second = createPrinterModel(storage);
    expect(second.log.get().printouts.map((p) => p.id)).toEqual(['a']);
    expect(second.log.get().readIds).toEqual(['a']);
    expect(printerLogCloses(second.log.get(), 'a')).toBe(1);
  });

  test('a slip is gone after fadeCloses closes, unless it is reprinted', () => {
    const storage = memoryStorage();
    createPrinterModel(storage).receive(slip('fades', 1));
    createPrinterModel(storage).receive(slip('kept', 1));
    // Close and reopen the app until 'fades' has seen all its closes.
    for (let close = 1; close < DeskTuning.fadeCloses; close++) {
      const printer = createPrinterModel(storage);
      printer.receive(slip('kept', 1)); // Bess prints a fresh copy each time
    }
    const last = createPrinterModel(storage);
    expect(last.log.get().printouts.map((p) => p.id)).toEqual(['kept']);
  });

  test('a brand new printer with nothing saved does not count a close', () => {
    const printer = createPrinterModel(memoryStorage());
    printer.receive(slip('a', 1));
    expect(printerLogCloses(printer.log.get(), 'a')).toBe(0);
  });
});

describe('SwitchboardModelTests', () => {
  test('a good change updates the board; a bad one is refused and changes nothing', () => {
    const switchboard = createSwitchboardModel();
    expect(switchboard.apply({ kind: 'patch', from: 'out-1', to: 'in-1' })).toBeNull();
    const before = switchboard.board.get();
    expect(switchboard.apply({ kind: 'patch', from: 'in-1', to: 'out-1' })).not.toBeNull();
    expect(switchboard.board.get()).toBe(before);
  });
});
