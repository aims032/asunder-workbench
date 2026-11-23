import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { makeMutable, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  cordBoardGeometry,
  cordHomeX,
  cordJackCount,
  cordJackLine,
  cordJackX,
  cordJackY,
  cordNearestFreeJack,
  cordNearestPlug,
  cordRestX,
  cordRestY,
  cordSag,
  cordSeats,
  DeskTuning,
} from '../core';
import type { CordBoardGeometry } from '../core';
import { MONOSPACED_FONT } from '../fonts';
import { hapticTick } from '../haptics/Haptics';
import { useStore } from './Store';
import type { SwitchboardModel } from './SwitchboardModel';

// THE CORD BOARD you can touch: pull a plug up out of the shelf at the
// bottom, carry it to a jack, let go and it drops in. Pull it out and let go
// in open space and it goes back to the shelf.
//
// Three parts, kept apart so Evan's artwork can replace the pictures without
// touching the feel:
//   CordBoard     the behavior: follows the finger, decides where a plug lands
//   BoardPicture  PLACEHOLDER picture of the jacks and the shelf
//   CordPicture   PLACEHOLDER picture of one cord and its plug
//
// All the arithmetic (where jacks are, what's nearest) is in core/CordBoard.ts,
// and every feel number is in DeskTuning (core/Tuning.ts) under "The cord board".
// The board itself is only ever changed with the patch and unpatch messages.

/** Where one plug is on the screen right now. */
interface PlugPosition {
  x: SharedValue<number>;
  y: SharedValue<number>;
}

const SPRING = { stiffness: DeskTuning.cordSpringStiffness, damping: DeskTuning.cordSpringDamping };

/** Placeholder picture: a ring per jack, a small socket per cord in the shelf. */
function BoardPicture({ g, hover }: { g: CordBoardGeometry; hover: SharedValue<number> }) {
  const jacks = [];
  for (let jack = 0; jack < cordJackCount(g); jack += 1) {
    jacks.push(jack);
  }
  const cords = [];
  for (let cord = 0; cord < g.cords; cord += 1) {
    cords.push(cord);
  }
  // A brighter ring on the jack the carried plug would drop into.
  const hoverX = useDerivedValue(() => (hover.value >= 0 ? cordJackX(g, hover.value) : -100));
  const hoverY = useDerivedValue(() => (hover.value >= 0 ? cordJackY(g, hover.value) : -100));
  return (
    <>
      {jacks.map((jack) => (
        <Circle key={`fill-${jack}`} cx={cordJackX(g, jack)} cy={cordJackY(g, jack)} r={g.jackRadius} color="#161616" />
      ))}
      {jacks.map((jack) => (
        <Circle
          key={`ring-${jack}`}
          cx={cordJackX(g, jack)}
          cy={cordJackY(g, jack)}
          r={g.jackRadius}
          color="#5c5c5c"
          style="stroke"
          strokeWidth={1.5}
        />
      ))}
      {cords.map((cord) => (
        <Circle key={`home-${cord}`} cx={cordHomeX(g, cord)} cy={g.homeY} r={g.jackRadius * 0.7} color="#2a2a2a" />
      ))}
      <Circle cx={hoverX} cy={hoverY} r={g.jackRadius + 3} color="#d6d6d6" style="stroke" strokeWidth={2} />
    </>
  );
}

/** Placeholder picture: a drooping line from the shelf to a round plug. */
function CordPicture({ g, cord, plug }: { g: CordBoardGeometry; cord: number; plug: PlugPosition }) {
  const homeX = cordHomeX(g, cord);
  const cable = useDerivedValue(() => {
    const x = plug.x.value;
    const y = plug.y.value;
    // A curve from the shelf to the plug, pulled down in the middle by the sag.
    const lowest = Math.min(g.height, (g.homeY + y) / 2 + cordSag(g, homeX, g.homeY, x, y));
    const builder = Skia.PathBuilder.Make();
    builder.moveTo(homeX, g.homeY).quadTo((homeX + x) / 2, lowest, x, y);
    return builder.build();
  });
  return (
    <>
      <Path path={cable} color="#8e8e93" style="stroke" strokeWidth={3} strokeCap="round" />
      <Circle cx={plug.x} cy={plug.y} r={g.jackRadius * 0.8} color="#d6d6d6" />
      <Circle cx={plug.x} cy={plug.y} r={g.jackRadius * 0.3} color="#3a3a3a" />
    </>
  );
}

export function CordBoard({ model }: { model: SwitchboardModel }) {
  const board = useStore(model.board);
  const { inputs, outputs } = model.layout;
  const [size, setSize] = useState({ width: 0, height: 0 });

  const g = useMemo(
    () => cordBoardGeometry(size.width, size.height, outputs.length, DeskTuning.jacksPerLine, inputs.length),
    [size, inputs, outputs],
  );

  // Which hole each cord is in. Worked out from the switchboard's cables,
  // remembering last time so a cord doesn't hop to another hole on its line.
  const lastSeats = useRef<number[]>([]);
  // (`moved` only counts plugs moved between two holes of the same line: the
  // switchboard doesn't change then, so this is what makes the seats update.)
  const [moved, setMoved] = useState(0);
  const seats = useMemo(
    () => cordSeats(board.cables, inputs, outputs, lastSeats.current, DeskTuning.jacksPerLine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, inputs, outputs, moved],
  );

  // The same facts again as "shared values", which is how the code that
  // follows your finger (running on the screen's own thread) can read them.
  const plugs = useMemo<PlugPosition[]>(() => inputs.map(() => ({ x: makeMutable(0), y: makeMutable(0) })), [inputs]);
  const sharedG = useSharedValue(g);
  const sharedSeats = useSharedValue(seats);
  /** The cord being carried (-1 = none), and the jack it would drop into (-1 = none). */
  const carrying = useSharedValue(-1);
  const hover = useSharedValue(-1);
  /** How far the plug's middle was from the finger when it was picked up. */
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  /** Has the board been drawn at its real size yet? (The first time, plugs just appear in place.) */
  const placed = useRef(false);

  // Whenever the cables or the size change, send every plug nobody is
  // holding to where it belongs.
  useEffect(() => {
    lastSeats.current = seats;
    sharedG.value = g;
    sharedSeats.value = seats;
    if (g.width <= 0) {
      return;
    }
    for (let cord = 0; cord < plugs.length; cord += 1) {
      if (carrying.value === cord) {
        continue;
      }
      const x = cordRestX(g, seats, cord);
      const y = cordRestY(g, seats, cord);
      plugs[cord].x.value = placed.current ? withSpring(x, SPRING) : x;
      plugs[cord].y.value = placed.current ? withSpring(y, SPRING) : y;
    }
    placed.current = true;
  }, [g, seats, plugs, sharedG, sharedSeats, carrying]);

  /** A plug was let go: tell the switchboard. `jack` is -1 for "in open space". */
  const drop = useCallback(
    (cord: number, jack: number) => {
      const input = inputs[cord];
      const now = model.board.get().cables[input];
      if (jack < 0) {
        if (now !== undefined) {
          model.apply({ kind: 'unpatch', to: input });
        }
        return;
      }
      hapticTick(DeskTuning.cordPlugHaptic);
      // Note the exact hole first, so the seat arithmetic keeps the plug in
      // the hole it was dropped into rather than the first empty one.
      const next = [...lastSeats.current];
      next[cord] = jack;
      lastSeats.current = next;
      const line = outputs[cordJackLine(g, jack)];
      if (now !== line) {
        model.apply({ kind: 'patch', from: line, to: input });
      } else {
        // Same line, other hole: the switchboard has nothing to change, so
        // just have the picture work the seats out again.
        setMoved((count) => count + 1);
      }
    },
    [g, inputs, outputs, model],
  );

  const drag = usePanGesture({
    minDistance: 0,
    onBegin: (touch) => {
      'worklet';
      const cord = cordNearestPlug(sharedG.value, touch.x, touch.y, sharedSeats.value);
      carrying.value = cord;
      if (cord < 0) {
        return;
      }
      grabX.value = plugs[cord].x.value - touch.x;
      grabY.value = plugs[cord].y.value - touch.y;
      // Until it moves, it would drop straight back where it is.
      hover.value = sharedSeats.value[cord];
      scheduleOnRN(hapticTick, DeskTuning.cordGrabHaptic);
    },
    onUpdate: (touch) => {
      'worklet';
      const cord = carrying.value;
      if (cord < 0) {
        return;
      }
      const geometry = sharedG.value;
      // The plug follows the finger exactly, riding a little above it, and
      // can't leave the board.
      const x = Math.max(0, Math.min(geometry.width, touch.x + grabX.value));
      const y = Math.max(0, Math.min(geometry.height, touch.y + grabY.value - DeskTuning.cordLift));
      plugs[cord].x.value = x;
      plugs[cord].y.value = y;
      const jack = cordNearestFreeJack(geometry, x, y, sharedSeats.value, cord);
      if (jack !== hover.value) {
        hover.value = jack;
        if (jack >= 0) {
          scheduleOnRN(hapticTick, DeskTuning.cordHoverHaptic);
        }
      }
    },
    onFinalize: () => {
      'worklet';
      const cord = carrying.value;
      if (cord < 0) {
        return;
      }
      const geometry = sharedG.value;
      const jack = hover.value;
      // Spring the last little way: into the jack, or back to the shelf.
      const spring = { stiffness: DeskTuning.cordSpringStiffness, damping: DeskTuning.cordSpringDamping };
      plugs[cord].x.value = withSpring(jack >= 0 ? cordJackX(geometry, jack) : cordHomeX(geometry, cord), spring);
      plugs[cord].y.value = withSpring(jack >= 0 ? cordJackY(geometry, jack) : geometry.homeY, spring);
      carrying.value = -1;
      hover.value = -1;
      scheduleOnRN(drop, cord, jack);
    },
  });

  return (
    <GestureDetector gesture={drag} touchAction="none" userSelect="none">
      <View
        collapsable={false}
        style={styles.board}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        {g.width > 0 && (
          <>
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <BoardPicture g={g} hover={hover} />
              {plugs.map((plug, cord) => (
                <CordPicture key={cord} g={g} cord={cord} plug={plug} />
              ))}
            </Canvas>
            {/* Placeholder names. What the lines and instruments are really called is Evan's. */}
            {outputs.map((name, line) => (
              <Text key={name} style={[styles.label, { left: line * g.pitch, width: g.pitch, top: g.jackTop - g.pitch * 0.5 - 16 }]}>
                {name.replace('line-', 'L')}
              </Text>
            ))}
            {inputs.map((name, cord) => (
              <Text
                key={name}
                style={[styles.label, { left: (cord * g.width) / g.cords, width: g.width / g.cords, bottom: 2 }]}
              >
                {name}
                {'\n'}
                {board.cables[name] ?? 'unplugged'}
              </Text>
            ))}
          </>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1 },
  label: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: MONOSPACED_FONT,
    fontSize: 9,
    color: '#8e8e93',
    pointerEvents: 'none',
  },
});
