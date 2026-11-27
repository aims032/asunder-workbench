import { DeskTuning } from '../../core';
import type { Printout } from '../../core';
import { createPrinterModel } from '../PrinterModel';
import type { PrinterStorage } from '../PrinterStorage';
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

  test('the log is saved and comes back in a new printer', () => {
    const storage = memoryStorage();
    const first = createPrinterModel(storage);
    first.receive(slip('a', 1));
    first.markRead('a');
    const second = createPrinterModel(storage);
    expect(second.log.get().printouts.map((p) => p.id)).toEqual(['a']);
    expect(second.log.get().readIds).toEqual(['a']);
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
