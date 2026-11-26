import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { Knob } from '../analyzer/Knob';
import {
  SCOPE_KNOBS,
  scopeKnobLabel,
  scopeModes,
  scopePanelInitial,
  scopePanelTime,
  scopePanelTriggerLevel,
  scopePanelTurn,
  scopePanelValue,
  scopePanelVolts,
  ScopeTuning,
} from '../core';
import type { BandPosition, ScopeDrawMode, ScopeKnob, ScopePanelState } from '../core';
import type { SwitchboardModel } from '../desk/SwitchboardModel';
import type { TransmissionPlayer } from '../desk/TransmissionPlayer';
import { MONOSPACED_FONT } from '../fonts';
import { hapticTick } from '../haptics/Haptics';
import { ScopeScreen } from './ScopeScreen';
import type { WaveSettings } from './WaveTrace';

// THE SCOPE, WHOLE: its screen, its mode switch and its knobs.
//
// What each control does and what one click changes is in
// core/ScopePanel.ts. This file only lays them out and passes the settings
// to the screen. PLACEHOLDER LOOK: plain discs and words. The real panel
// (a classic bench scope, cream or grey, round knobs) is Evan's artwork;
// the knob's turning (analyzer/Knob.tsx) is already separate from its
// picture so the art can drop in.
//
// Settings start fresh each time the app opens. Whether they should be
// remembered is still an open question, so nothing is saved.

/** The short name printed over each knob. */
const KNOB_NAMES: Record<ScopeKnob, string> = {
  time: 'TIME',
  volts1: 'CH 1',
  volts2: 'CH 2',
  positionUp: 'V POS',
  positionAcross: 'H POS',
  intensity: 'INTEN',
  focus: 'FOCUS',
  trigger: 'TRIG',
};

/** The full name a screen reader says for each knob. */
const KNOB_SPOKEN: Record<ScopeKnob, string> = {
  time: 'Time per division',
  volts1: 'Volts per division, channel 1',
  volts2: 'Volts per division, channel 2',
  positionUp: 'Vertical position',
  positionAcross: 'Horizontal position',
  intensity: 'Intensity',
  focus: 'Focus',
  trigger: 'Trigger level',
};

const MODE_NAMES: Record<ScopeDrawMode, string> = {
  waveform: 'WAVEFORM',
  xy: 'XY',
  picture: 'PICTURE',
};

const KNOB_SIZE = 34;

/** The settings the drawing reads every frame, worked out from the panel. */
function waveSettings(panel: ScopePanelState): WaveSettings {
  return {
    timePerDivision: scopePanelTime(panel),
    voltsPerDivision: scopePanelVolts(panel, 1),
    positionUp: panel.positionUp,
    positionAcross: panel.positionAcross,
    triggerLevel: scopePanelTriggerLevel(panel),
  };
}

/** One knob with its name above and its value below. */
function PanelKnob({
  knob,
  value,
  onTurn,
}: {
  knob: ScopeKnob;
  value: string;
  onTurn: (knob: ScopeKnob, direction: number) => void;
}) {
  const onStep = useCallback((direction: number) => onTurn(knob, direction), [knob, onTurn]);
  return (
    <View
      style={styles.knob}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={KNOB_SPOKEN[knob]}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text style={styles.knobName}>{KNOB_NAMES[knob]}</Text>
      <Knob size={KNOB_SIZE} onStep={onStep} degreesPerStep={ScopeTuning.knobDegreesPerStep} />
      <Text style={styles.knobValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ScopePanel({
  needle,
  switchboard,
  player,
}: {
  needle: SharedValue<BandPosition>;
  switchboard: SwitchboardModel;
  player: TransmissionPlayer;
}) {
  const [panel, setPanel] = useState<ScopePanelState>(scopePanelInitial);

  // Whenever a knob moves, hand the drawing its new settings.
  const settings = useSharedValue<WaveSettings>(waveSettings(panel));
  useEffect(() => {
    settings.value = waveSettings(panel);
  }, [panel, settings]);

  // (Knob.tsx already gives a haptic tick for every click.)
  const turn = useCallback((knob: ScopeKnob, direction: number) => {
    setPanel((p) => {
      const next = scopePanelTurn(p, knob, direction);
      return scopePanelValue(next, knob) === scopePanelValue(p, knob) ? p : next;
    });
  }, []);

  const pickMode = useCallback((mode: ScopeDrawMode) => {
    hapticTick(0.4);
    setPanel((p) => ({ ...p, mode }));
  }, []);

  return (
    <View style={styles.chassis}>
      <View style={styles.screen}>
        <ScopeScreen
          needle={needle}
          switchboard={switchboard}
          player={player}
          mode={panel.mode}
          settings={settings}
          intensity={panel.intensity}
          focus={panel.focus}
        />
      </View>

      <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel="Scope mode">
        {scopeModes().map((mode) => (
          <Pressable
            key={mode}
            style={[styles.mode, panel.mode === mode && styles.modeOn]}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityState={{ selected: panel.mode === mode }}
            accessibilityLabel={MODE_NAMES[mode]}
            onPress={() => pickMode(mode)}
          >
            <Text style={[styles.modeText, panel.mode === mode && styles.modeTextOn]}>{MODE_NAMES[mode]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.knobs}>
        {SCOPE_KNOBS.map((knob) => (
          <PanelKnob key={knob} knob={knob} value={scopeKnobLabel(panel, knob)} onTurn={turn} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chassis: {
    flex: 1,
    backgroundColor: '#1b1d1f',
    borderRadius: 14,
    padding: 8,
  },
  screen: {
    flex: 1,
  },
  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  mode: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#26292c',
  },
  modeOn: {
    backgroundColor: '#3a3d40',
  },
  modeText: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: '#7d858a',
  },
  modeTextOn: {
    color: '#e6e6e6',
  },
  knobs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  knob: {
    alignItems: 'center',
    width: 42,
  },
  knobName: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 8,
    color: '#9aa1a6',
    marginBottom: 3,
  },
  knobValue: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 9,
    color: '#d9d9d9',
    marginTop: 3,
  },
});
