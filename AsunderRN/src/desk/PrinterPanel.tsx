import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeskTuning, printerLogInk, printerLogIsRead, printerLogNewestFirst } from '../core';
import type { Printout } from '../core';
import { MONOSPACED_FONT } from '../fonts';
import type { PrinterModel } from './PrinterModel';
import { useStore } from './Store';

/**
 * PLACEHOLDER printer: the roll of print-outs, newest at the top, as plain
 * text. Tapping a slip marks it read; what tapping a LINE does is still Open.
 * No paper look, no printing animation yet (Phase 4 / Evan's art).
 * Slips do fade: each one is drawn fainter the more times the app has closed.
 *
 * The two test buttons only appear while developing (__DEV__), so you can
 * see a print-out arrive before any transmission exists. One prints a slip
 * from before the cue starts, the other one from after.
 */
export function PrinterPanel({ model }: { model: PrinterModel }) {
  const log = useStore(model.log);
  const slips = printerLogNewestFirst(log);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>PRINTER · placeholder</Text>
      {__DEV__ && (
        <View style={styles.testRow}>
          <Pressable style={styles.test} onPress={() => model.receive(testPrintout(1))}>
            <Text style={styles.small}>TEST PRINT (no cue)</Text>
          </Pressable>
          <Pressable style={styles.test} onPress={() => model.receive(testPrintout(DeskTuning.cueFromTransmission))}>
            <Text style={styles.small}>TEST PRINT (cue)</Text>
          </Pressable>
        </View>
      )}
      <ScrollView style={styles.roll}>
        {slips.length === 0 && <Text style={styles.small}>nothing printed yet</Text>}
        {slips.map((slip) => (
          <Pressable
            key={slip.id}
            onPress={() => model.markRead(slip.id)}
            // The fade: the whole slip gets fainter with each app close.
            style={[styles.slip, { opacity: printerLogInk(log, slip.id) }]}
          >
            <Text style={styles.small}>
              {printerLogIsRead(log, slip.id) ? '  ' : '● '}
              TRANSMISSION {String(slip.transmission).padStart(3, '0')}
            </Text>
            {slip.lines.map((line, i) => (
              <Text key={i} style={styles.line}>
                {line.text}
              </Text>
            ))}
          </Pressable>
        ))}
      </ScrollView>
    </View>
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
    lines: [{ text: '[PRINT-OUT TEXT: Evan]' }],
  };
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 12, gap: 8 },
  title: { fontFamily: MONOSPACED_FONT, fontSize: 12, color: '#8e8e93' },
  testRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  test: { borderWidth: 1, borderColor: '#5c5c5c', paddingVertical: 6, paddingHorizontal: 8 },
  roll: { flex: 1 },
  slip: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  line: { fontFamily: MONOSPACED_FONT, fontSize: 13, color: '#d6d6d6', marginTop: 4 },
  small: { fontFamily: MONOSPACED_FONT, fontSize: 10, color: '#8e8e93' },
});
