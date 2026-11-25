import {
  createClock,
  nearestSignal,
  printerLogHas,
  signalDetentsAway,
  signalIsOnBand,
  signalNoticeId,
  signalNoticePrintout,
  signalPrintout,
  signalStage,
  TRANSMISSION_SCHEDULE,
  TuneInTuning,
} from '../core';
import type { SignalStage } from '../core';
import type { DialModel } from '../dial/DialModel';
import type { PrinterModel } from '../desk/PrinterModel';
import { createStore } from '../desk/Store';
import type { Store } from '../desk/Store';

// THE TUNE-IN WATCHER: keeps an eye on the dial and tells Bess when to print.
//
// A few times a second (TuneInTuning.checksPerSecond) it looks at where the
// dial is and does two jobs:
//
//   1. NOTICES. Any transmission that's on the band but that Bess has never
//      printed anything for gets a bare notice slip: SIGNAL, a rough range,
//      the time. (If both slips fade away unfound, the notice comes back.)
//   2. LOCKING ON. If the dial sits locked on a transmission for
//      TuneInTuning.lockHoldSeconds, Bess prints it. Already on the roll? Then
//      it's a reprint and the slip goes back to full ink. It prints once per
//      visit: tune away and come back to print it again.
//
// It also keeps `status`, which the analyzer's LOCK lamp reads.
//
// It runs on the ordinary JS thread (a timer), not the screen thread, because
// printing saves to the phone's storage. The dial's own lock pulse is
// separate (DialModel.ts) so it lands on the exact frame.

export interface TuneInStatus {
  /** The nearest transmission on the band (its schedule id), or null if none is on. */
  nearestId: string | null;
  /** How far off it is, and which step of tuning in that is. */
  detentsAway: number;
  stage: SignalStage;
  /** How far through the hold before it prints, 0 to 1 (1 = printed this visit). */
  hold: number;
}

export interface TuneInWatcher {
  status: Store<TuneInStatus>;
  stop(): void;
}

/** The time printed on a notice slip, on the listener's own clock: "02:10". */
function clockText(nowSeconds: number): string {
  const d = new Date(nowSeconds * 1000);
  const two = (n: number) => (n < 10 ? '0' : '') + n;
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function createTuneInWatcher(dial: DialModel, printer: PrinterModel): TuneInWatcher {
  const clock = createClock();
  const status = createStore<TuneInStatus>({ nearestId: null, detentsAway: Infinity, stage: 'faint', hold: 0 });
  let lockedSince: number | null = null;
  let printedThisVisit = false;
  let lockedOn: string | null = null;

  function check() {
    const now = Date.now() / 1000;

    // 1. Notices for anything new on the band.
    for (const entry of TRANSMISSION_SCHEDULE) {
      if (!signalIsOnBand(entry, now, clock)) {
        continue;
      }
      const log = printer.log.get();
      if (!printerLogHas(log, entry.id) && !printerLogHas(log, signalNoticeId(entry))) {
        printer.receive(signalNoticePrintout(entry, now, clockText(now)));
      }
    }

    // 2. Locking on.
    const dialAt = dial.needle.value;
    const i = nearestSignal(dialAt, now, clock);
    if (i < 0) {
      lockedSince = null;
      printedThisVisit = false;
      status.set({ nearestId: null, detentsAway: Infinity, stage: 'faint', hold: 0 });
      return;
    }
    const entry = TRANSMISSION_SCHEDULE[i];
    const away = signalDetentsAway(entry, dialAt);
    const stage = signalStage(away);

    if (stage !== 'locked' || lockedOn !== entry.id) {
      // Off it (or onto a different one): the hold starts over.
      lockedSince = stage === 'locked' ? now : null;
      lockedOn = stage === 'locked' ? entry.id : null;
      printedThisVisit = false;
    }
    let hold = 0;
    if (lockedSince !== null) {
      hold = printedThisVisit ? 1 : Math.min(1, (now - lockedSince) / TuneInTuning.lockHoldSeconds);
      if (hold >= 1 && !printedThisVisit) {
        printedThisVisit = true;
        printer.receive(signalPrintout(entry, now));
      }
    }

    const before = status.get();
    if (before.nearestId !== entry.id || before.stage !== stage || before.hold !== hold || Math.abs(before.detentsAway - away) > 0.05) {
      status.set({ nearestId: entry.id, detentsAway: away, stage, hold });
    }
  }

  check();
  const timer = setInterval(check, 1000 / TuneInTuning.checksPerSecond);
  return {
    status,
    stop: () => clearInterval(timer),
  };
}
