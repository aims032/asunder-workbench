import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createBench } from './src/Bench';
import { ContentView } from './src/ContentView';

/**
 * The top of the app. It makes the bench exactly once and shows the screen.
 *
 * The two wrappers are plumbing the libraries need around everything:
 * one so touches can be tracked (gesture handler), one so the screen knows
 * where the notch and home bar are (safe area).
 */
export default function App() {
  // useState with a function: "run this once, the first time, and keep the result".
  const [bench] = useState(createBench);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ContentView bench={bench} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'black',
  },
});
