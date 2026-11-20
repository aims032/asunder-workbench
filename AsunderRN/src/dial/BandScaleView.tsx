import { Canvas, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { BandDisplay, BandPosition } from '../core';
import { MONOSPACED_FONT } from '../fonts';

/** How tall the two kinds of mark are, in points. Numbered ones are taller. */
const TALL_MARK = 14;
const SHORT_MARK = 7;
/** How far above the bottom edge the middle of a number sits, in points. */
const LABEL_HEIGHT_ABOVE_BOTTOM = 24;
/** The box each number is centered in, in points (wide enough for "100M"). */
const LABEL_WIDTH = 40;
const LABEL_FONT_SIZE = 10;

/**
 * Placeholder printed scale with a needle, like the glass on a radio.
 * The whole band runs left to right; the needle slides along it and,
 * because the band is a loop, goes off the right edge and comes in on the left.
 */
export function BandScaleView({
  needle,
  display,
}: {
  needle: SharedValue<BandPosition>;
  display: BandDisplay;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const marks = useMemo(() => display.scaleMarks(), [display]);

  // The printed marks never move, so they're drawn once per size:
  // one shape holding all the tall marks, one holding all the short ones.
  const { tallMarks, shortMarks } = useMemo(() => {
    const tall = Skia.PathBuilder.Make();
    const short = Skia.PathBuilder.Make();
    for (const mark of marks) {
      const x = mark.position * size.width;
      const isTall = mark.label !== null;
      const builder = isTall ? tall : short;
      builder.moveTo(x, size.height);
      builder.lineTo(x, size.height - (isTall ? TALL_MARK : SHORT_MARK));
    }
    return { tallMarks: tall.build(), shortMarks: short.build() };
  }, [marks, size]);

  // The needle: a line from top to bottom that follows the `needle` box.
  const needleTop = useDerivedValue(() => vec(needle.value * size.width, 0));
  const needleBottom = useDerivedValue(() => vec(needle.value * size.width, size.height));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        setSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        });
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={tallMarks} style="stroke" strokeWidth={1} color="#8e8e93" opacity={0.8} />
        <Path path={shortMarks} style="stroke" strokeWidth={1} color="#8e8e93" opacity={0.4} />
        <Line p1={needleTop} p2={needleBottom} color="white" strokeWidth={1.5} />
      </Canvas>

      {/* The numbers are ordinary text laid over the drawing. */}
      {marks.map((mark) =>
        mark.label === null ? null : (
          <Text
            key={mark.label}
            style={[
              styles.label,
              {
                left: mark.position * size.width - LABEL_WIDTH / 2,
                top: size.height - LABEL_HEIGHT_ABOVE_BOTTOM - LABEL_FONT_SIZE / 2 - 1,
              },
            ]}
          >
            {mark.label}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontFamily: MONOSPACED_FONT,
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_FONT_SIZE + 2,
    color: '#8e8e93',
  },
});
