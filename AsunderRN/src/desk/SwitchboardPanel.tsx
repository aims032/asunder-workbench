import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MONOSPACED_FONT } from '../fonts';
import { useStore } from './Store';
import type { SwitchboardModel } from './SwitchboardModel';

/**
 * PLACEHOLDER switchboard: plain boxes, no artwork, no sound. It's here so
 * the cable logic can be tried by hand, not as a design.
 *
 * How to use it: tap an output (top row), then an input (bottom row) to plug
 * a cable between them. Tap a plugged input to pull its cable out.
 * Each input shows which output feeds it.
 */
export function SwitchboardPanel({ model }: { model: SwitchboardModel }) {
  const board = useStore(model.board);
  // The output you've tapped and are about to plug in, if any.
  const [holding, setHolding] = useState<string | null>(null);

  function tapInput(input: string) {
    if (holding) {
      model.apply({ kind: 'patch', from: holding, to: input });
      setHolding(null);
    } else if (board.cables[input]) {
      model.apply({ kind: 'unpatch', to: input });
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>SWITCHBOARD · placeholder</Text>
      <View style={styles.row}>
        {model.layout.outputs.map((output) => (
          <Pressable
            key={output}
            onPress={() => setHolding(holding === output ? null : output)}
            style={[styles.jack, holding === output && styles.held]}
          >
            <Text style={styles.label}>{output}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {model.layout.inputs.map((input) => (
          <Pressable key={input} onPress={() => tapInput(input)} style={[styles.jack, board.cables[input] && styles.plugged]}>
            <Text style={styles.label}>{input}</Text>
            <Text style={styles.small}>{board.cables[input] ?? '—'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.small}>{holding ? `holding ${holding}: tap an input` : 'tap an output, then an input'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 12, gap: 14, justifyContent: 'center' },
  title: { fontFamily: MONOSPACED_FONT, fontSize: 12, color: '#8e8e93' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jack: {
    minWidth: 48,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#5c5c5c',
    alignItems: 'center',
  },
  held: { borderColor: '#d6d6d6' },
  plugged: { backgroundColor: '#2a2a2a' },
  label: { fontFamily: MONOSPACED_FONT, fontSize: 11, color: '#d6d6d6' },
  small: { fontFamily: MONOSPACED_FONT, fontSize: 10, color: '#8e8e93' },
});
