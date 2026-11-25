import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyzerPanel } from './analyzer/AnalyzerPanel';
import type { Bench } from './Bench';
import { ClockLine } from './ClockLine';
import { currentBandDisplay } from './core';
import { BandScaleView } from './dial/BandScaleView';
import { DIAL_START } from './dial/DialModel';
import { DialView } from './dial/DialView';
import { EdgeWheelForm } from './dial/EdgeWheelForm';
import { Readout } from './Readout';

/**
 * The bench, placeholder layout: the clock up top, the spectrum analyzer
 * taking most of the screen (Confirmed Nov 20: analyzer on top, dial at the
 * bottom), then the readout, scale and wheel under the thumb. Plain drawings
 * only: the real look is Evan's artwork in Phase 4. Room for the scope is
 * still to be found (Instruments §0).
 */
export function ContentView({ bench }: { bench: Bench }) {
  const display = currentBandDisplay;
  const dial = bench.dial;
  // The parts of the screen to keep clear of (the home bar). The notch at
  // the top is handled by Screens.tsx, above the page switch.
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
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={styles.clockLine}>
        <ClockLine />
      </View>

      <View style={styles.analyzer}>
        <AnalyzerPanel model={bench.analyzer} needle={dial.needle} tuneIn={bench.tuneIn.status} />
      </View>

      <Readout needle={dial.needle} display={display} startAt={DIAL_START} />

      <View style={styles.scale}>
        <BandScaleView needle={dial.needle} display={display} />
      </View>

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
  analyzer: {
    flex: 1,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  scale: {
    height: 44,
    marginHorizontal: 20,
    marginTop: 8,
  },
  wheel: {
    height: 72,
    marginHorizontal: 28,
    marginTop: 8,
    marginBottom: 16,
  },
});
