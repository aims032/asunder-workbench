import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { BandPosition } from '../core';
import { useStore } from '../desk/Store';
import type { Store } from '../desk/Store';
import type { TuneInStatus } from '../tunein/TuneInWatcher';
import { MONOSPACED_FONT } from '../fonts';
import { hapticTick } from '../haptics/Haptics';
import {
  bandWidthHz,
  hzLabel,
  initialPanel,
  INPUT_NAMES,
  panelChanged,
  panelKnobStep,
  panelNextInput,
  panelNextTraceMode,
  panelNextView,
  panelPress,
  panelRbw,
  panelSpan,
  panelSweepSettings,
  spanLabel,
  TRACE_MODE_NAMES,
  VIEW_NAMES,
} from './AnalyzerControls';
import type { ActiveFunction, PanelState } from './AnalyzerControls';
import type { AnalyzerModel } from './AnalyzerModel';
import { AnalyzerScreen } from './AnalyzerScreen';
import { Knob } from './Knob';

// THE ANALYZER AS A WHOLE INSTRUMENT: the screen, a row of keys under it, and
// the big knob. The chassis, keys and knob are PLAIN PLACEHOLDERS (Confirmed
// Nov 20: "screen real, chassis plain"); Evan's artwork for them comes in
// Phase 4. Each key's look is in PanelKey, apart from what it does.

const KNOB_SIZE = 64;

/**
 * Placeholder LOCK lamp: dark until the dial is locked on a transmission,
 * then it brightens over the hold (TuneInTuning.lockHoldSeconds) and stays
 * fully lit once Bess has printed it. It says nothing about how close you
 * are before that: finding it is your job, the analyzer's picture is the guide.
 */
function LockLamp({ status }: { status: Store<TuneInStatus> }) {
  const now = useStore(status);
  const glow = now.stage === 'locked' ? 0.35 + 0.65 * now.hold : 0;
  return (
    <View style={styles.lamp}>
      <View style={[styles.lampLight, { opacity: 0.15 + 0.85 * glow }]} />
      <Text style={styles.keyName}>LOCK</Text>
    </View>
  );
}

/** Placeholder key: a plain box with its name, and its setting under it. Lit when active. */
function PanelKey({
  name,
  value,
  lit,
  onPress,
}: {
  name: string;
  value: string;
  lit: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.key, lit && styles.keyLit]}>
      <Text style={styles.keyName}>{name}</Text>
      <Text style={styles.keyValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

export function AnalyzerPanel({
  model,
  needle,
  tuneIn,
}: {
  model: AnalyzerModel;
  needle: SharedValue<BandPosition>;
  tuneIn: Store<TuneInStatus>;
}) {
  const [panel, setPanel] = useState<PanelState>(initialPanel);

  // Whenever the panel changes, hand the sweep its new settings.
  useEffect(() => {
    model.settings.value = panelSweepSettings(panel);
    model.input.value = panel.input;
  }, [panel, model]);

  const press = useCallback((key: ActiveFunction) => {
    hapticTick(0.4);
    setPanel((p) => panelPress(p, key));
  }, []);

  const knobStep = useCallback((direction: number) => {
    setPanel((p) => {
      const next = panelKnobStep(p, direction);
      return panelChanged(p, next) ? next : p;
    });
  }, []);

  const nextTraceMode = useCallback(() => {
    hapticTick(0.4);
    setPanel(panelNextTraceMode);
    model.clearCount.value += 1; // a new trace mode starts a fresh trace
  }, [model]);

  const nextInput = useCallback(() => {
    hapticTick(0.4);
    setPanel(panelNextInput);
  }, []);

  const nextView = useCallback(() => {
    hapticTick(0.4);
    setPanel(panelNextView);
  }, []);

  // What each key shows under its name. The widths are read at the dial's
  // current spot, so they're only approximate as the dial moves (the screen's
  // own bottom line is the exact one).
  const here = needle.value;
  const spanValue = spanLabel(here, panelSpan(panel));
  const rbwValue =
    (panel.rbwIndex === null ? 'Auto ' : '#') + hzLabel(bandWidthHz(here, panelRbw(panel)));

  return (
    <View style={styles.chassis}>
      <View style={styles.screen}>
        <AnalyzerScreen model={model} needle={needle} panel={panel} />
      </View>
      <View style={styles.controls}>
        <View style={styles.keys}>
          <PanelKey name="SPAN" value={spanValue} lit={panel.active === 'span'} onPress={() => press('span')} />
          <PanelKey name="RES BW" value={rbwValue} lit={panel.active === 'rbw'} onPress={() => press('rbw')} />
          <PanelKey
            name="REF"
            value={`${panel.referenceDb} dBm`}
            lit={panel.active === 'reference'}
            onPress={() => press('reference')}
          />
          <PanelKey name="TRACE" value={TRACE_MODE_NAMES[panel.traceMode]} lit={false} onPress={nextTraceMode} />
          <PanelKey name="VIEW" value={VIEW_NAMES[panel.view]} lit={false} onPress={nextView} />
          <PanelKey name="INPUT" value={INPUT_NAMES[panel.input]} lit={false} onPress={nextInput} />
          <LockLamp status={tuneIn} />
        </View>
        <Knob size={KNOB_SIZE} onStep={knobStep} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Placeholder chassis: a plain dark-gray faceplate.
  chassis: {
    flex: 1,
    backgroundColor: '#1c1e20',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  screen: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keys: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  key: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 4,
    backgroundColor: '#2e3134',
    borderWidth: 1,
    borderColor: '#2e3134',
    alignItems: 'center',
  },
  lamp: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  lampLight: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffb020', // amber, like the lit keys
  },
  keyLit: {
    borderColor: '#ffb020', // amber: "this is what the knob changes"
  },
  keyName: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 9,
    color: '#d9d9d9',
  },
  keyValue: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 8,
    color: '#8e8e93',
    marginTop: 2,
  },
});
