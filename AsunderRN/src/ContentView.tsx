import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bench } from './Bench';
import { ClockLine } from './ClockLine';
import { currentBandDisplay } from './core';
import { BandScaleView } from './dial/BandScaleView';
import { DIAL_START } from './dial/DialModel';
import { DialView } from './dial/DialView';
import { EdgeWheelForm } from './dial/EdgeWheelForm';
import { Readout } from './Readout';

/**
 * Phase 1 bench, placeholder layout: the clock up top, the readout and scale
 * in the middle, the wheel at the bottom. Plain drawings only: the real look
 * is Evan's artwork in Phase 4, and how much room the dial gets is OPEN.
 */
export function ContentView({ bench }: { bench: Bench }) {
  const display = currentBandDisplay;
  const dial = bench.dial;
  // The parts of the screen to keep clear of (the notch, the home bar).
  const insets = useSafeAreaInsets();

  // The radio turns on when the app opens, and comes back on if something
  // (a call, another app's audio) stopped it while the app was away.
  // If it was turned off on purpose, it stays off until the dial is touched.
  useEffect(() => {
    bench.audio.resumeIfOn();
    const watcher = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        bench.audio.resumeIfOn();
      }
    });
    return () => watcher.remove();
  }, [bench]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.clockLine}>
        <ClockLine />
      </View>

      <View style={styles.spacer} />

      <Readout needle={dial.needle} display={display} startAt={DIAL_START} />

      <View style={styles.scale}>
        <BandScaleView needle={dial.needle} display={display} />
      </View>

      <View style={styles.spacer} />

      {/* To try another dial form, swap EdgeWheelForm for it here. */}
      <View style={styles.wheel}>
        <DialView model={dial} form={EdgeWheelForm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
  },
  clockLine: {
    alignItems: 'center',
    paddingTop: 12,
  },
  spacer: {
    flex: 1,
  },
  scale: {
    height: 44,
    marginHorizontal: 20,
    marginTop: 16,
  },
  wheel: {
    height: 80,
    marginHorizontal: 28,
    marginBottom: 28,
  },
});
