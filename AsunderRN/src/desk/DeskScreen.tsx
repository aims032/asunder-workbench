import { StyleSheet, View } from "react-native";

import { DeskTuning } from "../core";
import { CordBoard } from "./CordBoard";
import type { PrinterModel } from "./PrinterModel";
import { PrinterPanel } from "./PrinterPanel";
import type { SwitchboardModel } from "./SwitchboardModel";
import type { TransmissionPlayer } from "./TransmissionPlayer";

/**
 * THE SECOND SCREEN: the cord board with the printer beside it, feeding its
 * paper (Evan, Nov 23: both are visual story pieces, so they share a screen;
 * the look is the 1940s operator's cord board with the printer off to one
 * side). The board gets DeskTuning.switchboardShare of the width and the
 * printer the rest; DeskTuning.printerOnRight picks the side.
 */
export function DeskScreen({
  printer,
  switchboard,
  player,
}: {
  printer: PrinterModel;
  switchboard: SwitchboardModel;
  player: TransmissionPlayer;
}) {
  const share = DeskTuning.switchboardShare;
  return (
    <View
      style={[
        styles.screen,
        { flexDirection: DeskTuning.printerOnRight ? "row" : "row-reverse" },
      ]}
    >
      <View style={{ flex: share }}>
        <CordBoard model={switchboard} />
      </View>
      <View style={styles.divider} />
      <View style={{ flex: 1 - share }}>
        <PrinterPanel model={printer} player={player} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "black" },
  divider: { width: 1, backgroundColor: "#2a2a2a", marginVertical: 12 },
});
