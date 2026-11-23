import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  DeskTuning,
  livePrintNowLine,
  livePrintShown,
  printerLogInk,
  printerLogIsRead,
  printerLogNewestFirst,
  printStamp,
  transmissionToPrintout,
} from "../core";
import type { Printout } from "../core";
import { MONOSPACED_FONT } from "../fonts";
import type { PrinterModel } from "./PrinterModel";
import { useStore } from "./Store";
import type { TransmissionPlayer } from "./TransmissionPlayer";

/**
 * PLACEHOLDER printer: the roll of print-outs, newest at the top, as plain
 * text. Tapping a slip marks it read; what tapping a LINE does is still Open.
 * No paper look, no printing animation yet (Phase 4 / Evan's art).
 * Slips do fade: each one is drawn fainter the more times the app has closed.
 *
 * THE LIVE PRINT-OUT: the slip of the transmission that's playing types
 * itself out in step with the tape (LiveLines, below). Every other slip is
 * just shown whole.
 *
 * The test buttons only appear while developing (__DEV__), so you can see a
 * print-out arrive before any transmission exists. Two print a plain slip
 * (one from before the cue starts, one from after); LIVE starts the stand-in
 * transmission from the top and prints it as it plays.
 */
export function PrinterPanel({
  model,
  player,
}: {
  model: PrinterModel;
  player: TransmissionPlayer;
}) {
  const log = useStore(model.log);
  const slips = printerLogNewestFirst(log);
  // Is a tape running? (Checked here, read in full by LiveLines.)
  const playing = useStore(player.tape) !== null;

  function startLive() {
    const now = Date.now() / 1000;
    player.start(now);
    model.receive(transmissionToPrintout(player.transmission, now));
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>PRINTER · placeholder</Text>
      {__DEV__ && (
        <View style={styles.testRow}>
          <Pressable
            style={styles.test}
            onPress={() => model.receive(testPrintout(1))}
          >
            <Text style={styles.small}>TEST PRINT (no cue)</Text>
          </Pressable>
          <Pressable
            style={styles.test}
            onPress={() =>
              model.receive(testPrintout(DeskTuning.cueFromTransmission))
            }
          >
            <Text style={styles.small}>TEST PRINT (cue)</Text>
          </Pressable>
          <Pressable style={styles.test} onPress={startLive}>
            <Text style={styles.small}>TEST PRINT (LIVE)</Text>
          </Pressable>
        </View>
      )}
      <ScrollView style={styles.roll}>
        {slips.length === 0 && (
          <Text style={styles.small}>nothing printed yet</Text>
        )}
        {slips.map((slip) => (
          <Pressable
            key={slip.id}
            onPress={() => model.markRead(slip.id)}
            // The fade: the whole slip gets fainter with each app close.
            style={[styles.slip, { opacity: printerLogInk(log, slip.id) }]}
          >
            <Text style={styles.small}>
              {printerLogIsRead(log, slip.id) ? "  " : "● "}
              TRANSMISSION {String(slip.transmission).padStart(3, "0")}
            </Text>
            {playing && slip.id === player.transmission.id ? (
              <LiveLines slip={slip} player={player} />
            ) : (
              slip.lines.map((line, i) => (
                <Text key={i} style={styles.line}>
                  {line.text}
                </Text>
              ))
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The lines of the slip that's playing right now. Each line appears when the
 * tape reaches it and types out letter by letter, stamped with its time. The
 * line being heard has a mark beside it. Tap a line to hear from there again.
 */
function LiveLines({
  slip,
  player,
}: {
  slip: Printout;
  player: TransmissionPlayer;
}) {
  const tape = useStore(player.tape);

  // Look at the tape several times a second while this slip is on screen.
  // Each look updates the tape, and that redraws these lines.
  useEffect(() => {
    const timer = setInterval(
      () => player.advance(Date.now() / 1000),
      1000 / DeskTuning.printChecksPerSecond,
    );
    return () => clearInterval(timer);
  }, [player]);

  if (tape === null) {
    return null;
  }
  const shown = livePrintShown(
    slip,
    tape.printedThroughSeconds,
    DeskTuning.printCharsPerSecond,
  );
  const nowLine = livePrintNowLine(slip, tape.lastSeconds);
  return (
    <>
      {slip.lines.map((line, i) => {
        const at = line.atSeconds;
        // Not reached yet: nothing on the paper.
        if (at !== undefined && tape.printedThroughSeconds < at) {
          return null;
        }
        return (
          <Pressable
            key={i}
            disabled={at === undefined}
            onPress={() =>
              at !== undefined && player.jump(at, Date.now() / 1000)
            }
          >
            <Text style={styles.small}>
              {i === nowLine ? "▸ " : "  "}
              {at === undefined ? "" : printStamp(at)}
            </Text>
            <Text style={[styles.line, styles.liveLine]}>{shown[i]}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

let testCount = 0;

/** A placeholder print-out for the test buttons. No story words. */
function testPrintout(transmission: number): Printout {
  testCount += 1;
  return {
    id: `test-${Date.now()}-${testCount}`,
    transmission,
    arrivedAtSeconds: Date.now() / 1000,
    lines: [{ text: "[PRINT-OUT TEXT: Evan]" }],
  };
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 12, gap: 8 },
  title: { fontFamily: MONOSPACED_FONT, fontSize: 12, color: "#8e8e93" },
  testRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  test: {
    borderWidth: 1,
    borderColor: "#5c5c5c",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  roll: { flex: 1 },
  slip: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  line: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 13,
    color: "#d6d6d6",
    marginTop: 4,
  },
  liveLine: { marginTop: 0, marginBottom: 6 },
  small: { fontFamily: MONOSPACED_FONT, fontSize: 10, color: "#8e8e93" },
});
