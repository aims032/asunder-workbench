import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnalyzerTuning } from '../core';
import { hapticTick } from '../haptics/Haptics';

// THE BIG KNOB (the Keysight's front-panel "RPG" knob): turn it and it steps
// whatever key is active, one step per AnalyzerTuning.knobDegreesPerStep.
//
// The behavior (Knob) and the picture (KnobFace) are separate, so Evan's art
// can replace KnobFace without touching the turning.

/** The angle from the knob's middle to a touch, in degrees. */
function angleOf(x: number, y: number, size: number): number {
  'worklet';
  return (Math.atan2(y - size / 2, x - size / 2) * 180) / Math.PI;
}

/** Placeholder picture: a plain disc with a line showing which way it points. */
function KnobFace({ turned, size }: { turned: SharedValue<number>; size: number }) {
  const r = size / 2;
  const tip = useDerivedValue(() => {
    const a = ((turned.value - 90) * Math.PI) / 180;
    return vec(r + Math.cos(a) * r * 0.75, r + Math.sin(a) * r * 0.75);
  });
  const middle = useDerivedValue(() => {
    const a = ((turned.value - 90) * Math.PI) / 180;
    return vec(r + Math.cos(a) * r * 0.3, r + Math.sin(a) * r * 0.3);
  });
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Circle cx={r} cy={r} r={r - 1} color="#3a3d40" />
      <Circle cx={r} cy={r} r={r - 1} color="#5a5e62" style="stroke" strokeWidth={1} />
      <Line p1={middle} p2={tip} color="#d9d9d9" strokeWidth={2} />
    </Canvas>
  );
}

export function Knob({
  size,
  onStep,
  degreesPerStep = AnalyzerTuning.knobDegreesPerStep,
}: {
  size: number;
  onStep: (direction: number) => void;
  /** How far the knob turns for one step. Left out, it's the analyzer's own setting. */
  degreesPerStep?: number;
}) {
  /** How far the knob has turned in all, in degrees (drives the picture). */
  const turned = useSharedValue(0);
  /** The finger's angle last time, and how far it has turned since the last step. */
  const lastAngle = useSharedValue(0);
  const sinceStep = useSharedValue(0);

  const step = useCallback(
    (direction: number) => {
      hapticTick(0.6);
      onStep(direction);
    },
    [onStep],
  );

  const turn = usePanGesture({
    minDistance: 0,
    onBegin: (touch) => {
      'worklet';
      lastAngle.value = angleOf(touch.x, touch.y, size);
      sinceStep.value = 0;
    },
    onUpdate: (touch) => {
      'worklet';
      const angle = angleOf(touch.x, touch.y, size);
      // The change since last time, taken the short way round (so crossing
      // from +180 to -180 counts as a small turn, not a full one).
      let change = angle - lastAngle.value;
      change -= 360 * Math.round(change / 360);
      lastAngle.value = angle;
      turned.value += change;
      sinceStep.value += change;
      const per = degreesPerStep;
      while (Math.abs(sinceStep.value) >= per) {
        const direction = sinceStep.value > 0 ? 1 : -1;
        sinceStep.value -= direction * per;
        scheduleOnRN(step, direction);
      }
    },
  });

  return (
    <GestureDetector gesture={turn} touchAction="none" userSelect="none">
      <View collapsable={false} style={{ width: size, height: size }}>
        <KnobFace turned={turned} size={size} />
      </View>
    </GestureDetector>
  );
}
