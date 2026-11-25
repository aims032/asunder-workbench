import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bench } from './Bench';
import { ContentView } from './ContentView';
import { DeskScreen } from './desk/DeskScreen';
import { PageSwitch } from './desk/PageSwitch';
import { FieldLogScreen } from './fieldlog/FieldLogScreen';
import type { Page } from './desk/PageSwitch';

/**
 * The app's screens: the bench (dial, analyzer), the desk (switchboard,
 * printer) and the field log (the Physicist's notebook), with the
 * placeholder page switch on top.
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
      {/* The log is only built while you're on it, so its fade plays each time you open it. */}
      {page === 'log' && (
        <View style={[styles.page, { paddingBottom: insets.bottom }]}>
          <FieldLogScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  page: { flex: 1 },
  hidden: { display: 'none' },
});
