import { initialPanel, panelSweepSettings } from "./analyzer/AnalyzerControls";
import { createAnalyzerModel } from "./analyzer/AnalyzerModel";
import type { AnalyzerModel } from "./analyzer/AnalyzerModel";
import { createReceiverAudio } from "./audio/ReceiverAudio";
import { ANALYZER_JACK } from "./core";
import type { ReceiverAudio } from "./audio/ReceiverAudio.types";
import { createDialModel, DIAL_START } from "./dial/DialModel";
import type { DialModel } from "./dial/DialModel";
import { createPrinterModel } from "./desk/PrinterModel";
import type { PrinterModel } from "./desk/PrinterModel";
import { createPrinterStorage } from "./desk/PrinterStorage";
import { createSwitchboardModel } from "./desk/SwitchboardModel";
import { createTransmissionPlayer } from "./desk/TransmissionPlayer";
import type { TransmissionPlayer } from "./desk/TransmissionPlayer";
import type { SwitchboardModel } from "./desk/SwitchboardModel";

/**
 * Everything on the bench, made once when the app opens and kept for as long
 * as it runs. Phase 3 adds the analyzer here; the scope comes later.
 * The printer and switchboard live on the second screen (the desk), but
 * they're made here too so they keep running while you're on the bench.
 *
 * It's made in App.tsx (not inside a screen) because React can re-create
 * screens whenever it likes, and there must only ever be one radio.
 */
export interface Bench {
  audio: ReceiverAudio;
  dial: DialModel;
  analyzer: AnalyzerModel;
  printer: PrinterModel;
  switchboard: SwitchboardModel;
  /** The tape of the transmission on the lines (a stand-in until there's a real one). */
  player: TransmissionPlayer;
}

export function createBench(): Bench {
  const audio = createReceiverAudio();
  const analyzer = createAnalyzerModel(
    panelSweepSettings(initialPanel()),
    DIAL_START,
  );
  const switchboard = createSwitchboardModel();

  // The cable between the two screens: whenever the switchboard changes, tell
  // the analyzer which phone line (if any) is patched into its input jack.
  switchboard.board.subscribe(() => {
    analyzer.patchedLine.value =
      switchboard.board.get().cables[ANALYZER_JACK] ?? null;
  });

  // And the tape: when it starts or jumps, the analyzer's LINE input follows,
  // so the paper and the analyzer always agree about "now".
  const player = createTransmissionPlayer();
  player.tape.subscribe(() => {
    const startedAt = player.tape.get()?.startedAtSeconds ?? 0;
    if (analyzer.lineStartedAt.value !== startedAt) {
      analyzer.lineStartedAt.value = startedAt;
    }
  });

  return {
    audio: audio,
    dial: createDialModel(audio),
    analyzer: analyzer,
    printer: createPrinterModel(createPrinterStorage()),
    switchboard: switchboard,
    player: player,
  };
}
