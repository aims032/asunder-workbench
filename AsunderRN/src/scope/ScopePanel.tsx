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

// THE SCOPE, WHOLE: its screen, its mode switch and its controls.
//
// HOW THE CONTROLS FIT (Nov 25): eight separate knobs in a row were too
// tight on a phone (Evan). So it works like the analyzer's panel: each
// control is a KEY showing its name and value. Tap a key to pick it, then
// turn the one big knob to change it. A real bench scope has a knob per
// control; whether the finished art goes back to that is Evan's call.
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

const KNOB_SIZE = 84;

/** The settings the drawing reads every frame, worked out from the panel. */
function waveSettings(panel: ScopePanelState): WaveSettings {
  return {
    timePerDivision: scopePanelTime(panel),
    voltsPerDivision: scopePanelVolts(panel, 1),
    voltsPerDivision2: scopePanelVolts(panel, 2),
    positionUp: panel.positionUp,
    positionAcross: panel.positionAcross,
    triggerLevel: scopePanelTriggerLevel(panel),
  };
}

/** One control's key: its name and value. Lit when the big knob is set to change it. */
function PanelKey({
  knob,
  value,
  lit,
  onPick,
  onTurn,
}: {
  knob: ScopeKnob;
  value: string;
  lit: boolean;
  onPick: (knob: ScopeKnob) => void;
  onTurn: (knob: ScopeKnob, direction: number) => void;
}) {
  return (
    <Pressable
      style={[styles.key, lit && styles.keyLit]}
      onPress={() => onPick(knob)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={KNOB_SPOKEN[knob]}
      accessibilityValue={{ text: value }}
      accessibilityState={{ selected: lit }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onTurn(knob, event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text style={styles.keyName}>{KNOB_NAMES[knob]}</Text>
      <Text style={styles.keyValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
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
  /** Which control the big knob changes right now. */
  const [active, setActive] = useState<ScopeKnob>('time');

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

  const pick = useCallback((knob: ScopeKnob) => {
    hapticTick(0.4);
    setActive(knob);
  }, []);

  const turnActive = useCallback((direction: number) => turn(active, direction), [active, turn]);

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

      <View style={styles.controls}>
        <View style={styles.keys}>
          {SCOPE_KNOBS.map((knob) => (
            <PanelKey
              key={knob}
              knob={knob}
              value={scopeKnobLabel(panel, knob)}
              lit={active === knob}
              onPick={pick}
              onTurn={turn}
            />
          ))}
        </View>
        <Knob size={KNOB_SIZE} onStep={turnActive} degreesPerStep={ScopeTuning.knobDegreesPerStep} />
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  keys: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  key: {
    // Four keys to a row.
    flexBasis: '22%',
    flexGrow: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#26292c',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  keyLit: {
    borderColor: '#f0b23a',
  },
  keyName: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: '#e6e6e6',
  },
  keyValue: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: '#9aa1a6',
    marginTop: 2,
  },
});
