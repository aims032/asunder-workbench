import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { FrameCallback } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { DialForm, Point } from './DialForm';
import { dialModelDrag, dialModelFrame, dialModelGrab, dialModelRelease } from './DialModel';
import type { DialModel } from './DialModel';

/**
 * Seconds to assume for a step when there's no "last step" to measure from:
 * one normal frame.
 */
const FIRST_FRAME_SECONDS = 1 / 60;

/**
 * If the heartbeat (below) hasn't ticked for this many milliseconds, it is
 * taken to be asleep, and the finger's own movements run the physics until
 * it wakes. About two and a half frames.
 */
const HEARTBEAT_ASLEEP_AFTER_MS = 40;

/**
 * Puts a dial form on screen and turns touches into the model's
 * grab / drag / release. Works with any DialForm.
 */
export function DialView({ model, form }: { model: DialModel; form: DialForm }) {
  /** Where the finger was last time. null when nothing is touching. */
  const lastTouch = useSharedValue<Point | null>(null);
  /** How big the dial is on screen. */
  const size = useSharedValue({ width: 0, height: 0 });
  /**
   * When the physics last moved forward, in milliseconds on the phone's
   * stopwatch (performance.now()). null while the wheel is at rest.
   */
  const lastStepTime = useSharedValue<number | null>(null);
  /** When the heartbeat last ticked, on the same stopwatch. */
  const lastHeartbeatTime = useSharedValue(0);

  /**
   * Move the dial's physics forward to this instant, by however long it has
   * really been since the last step. Gives back false once the wheel is at rest.
   *
   * (useCallback: "keep this same function between redraws of the screen".)
   */
  const stepToNow = useCallback((): boolean => {
    'worklet';
    const now = performance.now();
    const dt =
      lastStepTime.value === null ? FIRST_FRAME_SECONDS : (now - lastStepTime.value) / 1000;
    const stillMoving = dialModelFrame(model, dt);
    lastStepTime.value = stillMoving ? now : null;
    return stillMoving;
  }, [model, lastStepTime]);

  // THE HEARTBEAT: runs the dial's physics once per screen refresh.
  // It only runs while something is moving: a touch starts it, and it stops
  // itself once the wheel is at rest, so an idle dial costs no battery.
  //
  // Its on/off switch lives on the JS thread, so these two small functions
  // are what the screen thread asks for (through scheduleOnRN) to flip it.
  const heartbeatSwitch = useRef<FrameCallback | null>(null);
  const startHeartbeat = useCallback(() => heartbeatSwitch.current?.setActive(true), []);
  const stopHeartbeat = useCallback(() => heartbeatSwitch.current?.setActive(false), []);

  const onFrame = useCallback(() => {
    'worklet';
    lastHeartbeatTime.value = performance.now();
    if (!stepToNow()) {
      scheduleOnRN(stopHeartbeat);
    }
  }, [lastHeartbeatTime, stepToNow, stopHeartbeat]);
  // false: don't start by itself; a touch starts it.
  const heartbeat = useFrameCallback(onFrame, false);

  useEffect(() => {
    heartbeatSwitch.current = heartbeat;
  }, [heartbeat]);

  // WAKING UP. Starting the heartbeat from a touch takes a moment: the request
  // goes to the JS thread and back, which is a frame or three. Without help,
  // the start of a swipe would go unmeasured: the sound would lag the wheel,
  // and a quick flick could be over before the heartbeat arrived, so the wheel
  // wouldn't coast. So until the heartbeat is ticking, each movement of the
  // finger runs the physics itself.
  const stepIfHeartbeatAsleep = useCallback(() => {
    'worklet';
    if (performance.now() - lastHeartbeatTime.value > HEARTBEAT_ASLEEP_AFTER_MS) {
      stepToNow();
    }
  }, [lastHeartbeatTime, stepToNow]);

  const drag = usePanGesture({
    // minDistance 0: the wheel stops the instant you touch it.
    minDistance: 0,
    onBegin: (touch) => {
      'worklet';
      lastTouch.value = { x: touch.x, y: touch.y };
      dialModelGrab(model);
      // If the wheel was at rest, start the stopwatch now, so the first step
      // measures the real time since the finger came down.
      if (lastStepTime.value === null) {
        lastStepTime.value = performance.now();
      }
      scheduleOnRN(startHeartbeat);
    },
    onUpdate: (touch) => {
      'worklet';
      const from = lastTouch.value;
      if (from === null) {
        return;
      }
      const to = { x: touch.x, y: touch.y };
      lastTouch.value = to;
      dialModelDrag(model, form.detents(from, to, size.value));
      stepIfHeartbeatAsleep();
    },
    onFinalize: () => {
      'worklet';
      lastTouch.value = null;
      stepIfHeartbeatAsleep(); // so a very quick flick still has its speed measured
      dialModelRelease(model);
    },
  });

  const Face = form.Face;
  return (
    // touchAction/userSelect: on the web, stop a drag from scrolling the page or selecting text.
    <GestureDetector gesture={drag} touchAction="none" userSelect="none">
      <View
        collapsable={false}
        style={StyleSheet.absoluteFill} // the whole area is touchable
        onLayout={(event) => {
          size.value = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };
        }}
      >
        <Face wheelDetents={model.wheelDetents} />
      </View>
    </GestureDetector>
  );
}
