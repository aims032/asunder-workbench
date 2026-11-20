import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { BandDisplay, BandPosition } from './core';
import { MONOSPACED_FONT } from './fonts';

/**
 * The big number and its unit: "19.93 MHz".
 * The readout follows the needle, so it lags the hand slightly too.
 */
export function Readout({
  needle,
  display,
  startAt,
}: {
  needle: SharedValue<BandPosition>;
  display: BandDisplay;
  /** Where the needle sits when the app opens (for the very first draw). */
  startAt: BandPosition;
}) {
  const [text, setText] = useState(() => ({
    number: display.labelAt(startAt),
    unit: display.unitAt(startAt),
  }));

  // Turn a needle position into the text. This runs on the JS thread (the
  // display's label-writing code lives there), and only redraws when the
  // text actually changes.
  const showNeedle = useCallback(
    (position: BandPosition) => {
      const number = display.labelAt(position);
      const unit = display.unitAt(position);
      setText((old) => (old.number === number && old.unit === unit ? old : { number, unit }));
    },
    [display],
  );

  // Watch the needle's box on the screen thread; whenever it moves, ask the
  // JS thread to update the text.
  useAnimatedReaction(
    () => needle.value,
    (position, previous) => {
      if (position !== previous) {
        scheduleOnRN(showNeedle, position);
      }
    },
  );

  return (
    <View style={styles.row}>
      <Text style={styles.number}>{text.number}</Text>
      <Text style={styles.unit}>{text.unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  number: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 40, // was 64 before the analyzer joined the bench
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: '#d9d9d9',
  },
  unit: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 20,
    fontWeight: '300',
    color: '#d9d9d9',
  },
});
