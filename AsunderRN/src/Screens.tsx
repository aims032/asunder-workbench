import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bench } from './Bench';
import { ContentView } from './ContentView';
import { DeskScreen } from './desk/DeskScreen';
import { PageSwitch } from './desk/PageSwitch';
import type { Page } from './desk/PageSwitch';

/**
 * The app's two screens: the bench (dial, analyzer) and the desk
 * (switchboard, printer), with the placeholder page switch on top.
 *
 * Both screens stay built the whole time; the one you're not on is only
 * hidden. That way the analyzer keeps its picture and the switchboard keeps
 * its cables when you flip between them.
 */
export function Screens({ bench }: { bench: Bench }) {
  const [page, setPage] = useState<Page>('bench');
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PageSwitch page={page} onChange={setPage} printer={bench.printer} />
      <View style={[styles.page, page !== 'bench' && styles.hidden]}>
        <ContentView bench={bench} />
      </View>
      <View style={[styles.page, page !== 'desk' && styles.hidden, { paddingBottom: insets.bottom }]}>
        <DeskScreen printer={bench.printer} switchboard={bench.switchboard} player={bench.player} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  page: { flex: 1 },
  hidden: { display: 'none' },
});
