import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DeskTuning, printerLogUnreadCount } from '../core';
import { MONOSPACED_FONT } from '../fonts';
import type { PrinterModel } from './PrinterModel';
import { playPrintoutCueSound } from './PrintoutCueSound';
import { useStore } from './Store';

/** The pages you can switch between. The terminal will join them later. */
export type Page = 'bench' | 'desk';

/**
 * PLACEHOLDER page switch: two words at the top, BENCH and DESK. How you
 * really move between screens (swipe, a button on the hardware, something
 * in the drawing) is still to be decided.
 *
 * This is also where the "new print-out" cue shows: when the printer fires
 * its cue, DESK glows for DeskTuning.cueGlowSeconds and the cue sound plays
 * (silent for now). A small dot stays while anything is unread.
 */
export function PageSwitch({
  page,
  onChange,
  printer,
}: {
  page: Page;
  onChange: (page: Page) => void;
  printer: PrinterModel;
}) {
  const unread = printerLogUnreadCount(useStore(printer.log));
  const [glowing, setGlowing] = useState(false);

  // Listen for the printer's cue while this is on screen.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = printer.onCue((printout) => {
      playPrintoutCueSound(printout);
      setGlowing(true);
      clearTimeout(timer);
      timer = setTimeout(() => setGlowing(false), DeskTuning.cueGlowSeconds * 1000);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [printer]);

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange('bench')}>
        <Text style={[styles.word, page === 'bench' && styles.current]}>BENCH</Text>
      </Pressable>
      <Text style={styles.word}>·</Text>
      <Pressable onPress={() => onChange('desk')}>
        <Text style={[styles.word, page === 'desk' && styles.current, glowing && styles.glow]}>
          DESK{unread > 0 ? ' •' : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 8 },
  word: { fontFamily: MONOSPACED_FONT, fontSize: 12, color: '#5c5c5c' },
  current: { color: '#d6d6d6' },
  // Placeholder glow colour: the brand's lamp amber (story surfaces may use amber).
  glow: { color: '#E8A73A' },
});
