import { StyleSheet, View } from 'react-native';

import { DeskTuning } from '../core';
import type { PrinterModel } from './PrinterModel';
import { PrinterPanel } from './PrinterPanel';
import type { SwitchboardModel } from './SwitchboardModel';
import { SwitchboardPanel } from './SwitchboardPanel';

/**
 * THE SECOND SCREEN: the switchboard and the printer's read-outs together
 * (Evan, Nov 23: both are visual story pieces, so they share a screen).
 * The switchboard gets DeskTuning.switchboardShare of the height; the
 * printer gets the rest. Placeholder layout, still being brainstormed.
 */
export function DeskScreen({ printer, switchboard }: { printer: PrinterModel; switchboard: SwitchboardModel }) {
  const share = DeskTuning.switchboardShare;
  return (
    <View style={styles.screen}>
      <View style={{ flex: share }}>
        <SwitchboardPanel model={switchboard} />
      </View>
      <View style={styles.divider} />
      <View style={{ flex: 1 - share }}>
        <PrinterPanel model={printer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'black' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 12 },
});
