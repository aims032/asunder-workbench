import {
  Canvas,
  FilterMode,
  Fill,
  ImageShader,
  MipmapMode,
  Shader,
  useImage,
  useVideo,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  SCOPE_JACK,
  SCOPE_OVERRIDES,
  scopeClarity,
  scopeLook,
  scopeOverrideAt,
  scopeXYLook,
  scopeRoll,
  ScopeTuning,
} from '../core';
import type { BandPosition, ScopeOverride } from '../core';
import type { SwitchboardModel } from '../desk/SwitchboardModel';
import { useStore } from '../desk/Store';
import { MONOSPACED_FONT } from '../fonts';
import { bundledFileUri, LINE_PICTURES, OVERRIDE_PICTURES } from './ScopePictures';
import { OVERRIDE_SHADER, SCOPE_SHADER } from './ScopeShader';
import { useVectorArt, XYTrace } from './XYTrace';

// THE SCOPE'S SCREEN: the picture from whatever phone line is patched into
// the SCOPE jack on the switchboard. Photos and clips are drawn as an old TV
// tube (CRT mode); vector art as a glowing line drawing (XY mode, in
// XYTrace.tsx). How clear it is follows the dial: tune in and the snow
// clears, the roll stops, the color comes back. All the look numbers are in
// ScopeTuning.
//
// Only the screen is built. The case and controls around it are Evan's
// artwork (Phase 4).
//
// TEST ONLY: press and hold the screen to preview Asunder's override for a
// few seconds, using the placeholder picture. Real overrides come from
// SCOPE_OVERRIDES on the shared clock (core/Scope.ts).

/** How long the press-and-hold preview of the override lasts, in seconds. */
const PREVIEW_SECONDS = 4;

const OVERRIDE_PREVIEW_PICTURE = 'placeholder';

export function ScopeScreen({
  needle,
  switchboard,
  overrides = SCOPE_OVERRIDES,
}: {
  needle: SharedValue<BandPosition>;
  switchboard: SwitchboardModel;
  overrides?: readonly ScopeOverride[];
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Which phone line is patched into the scope (null = nothing).
  const board = useStore(switchboard.board);
  const line = board.cables[SCOPE_JACK] ?? null;
  const patched = useSharedValue(false);
  useEffect(() => {
    patched.value = line !== null && LINE_PICTURES[line] !== undefined;
  }, [line, patched]);

  // The pictures. useImage loads a bundled still and useVideo a clip; each
  // gives nothing until it has loaded. With nothing patched in there's no
  // picture to show, so the override's picture stands in (it's hidden under
  // the snow anyway).
  const linePicture = line !== null ? LINE_PICTURES[line] : undefined;
  const overrideImage = useImage(OVERRIDE_PICTURES[OVERRIDE_PREVIEW_PICTURE]);
  const lineImage = useImage(linePicture?.kind === 'image' ? linePicture.file : undefined);
  const clip = useVideo(linePicture?.kind === 'video' ? bundledFileUri(linePicture.file) : null, {
    looping: true,
    volume: 0,
  });
  const isClip = linePicture?.kind === 'video';
  const isVector = linePicture?.kind === 'vector';
  const art = useVectorArt(isVector ? linePicture.file : undefined);
  // The picture the tube draws this frame: the clip's latest frame, or the still.
  const picture = useDerivedValue(() => {
    const still = lineImage ?? overrideImage;
    return isClip ? (clip.currentFrame.value ?? still) : still;
  });

  // Time, and the roll of the picture, moved on every frame.
  const time = useSharedValue(0);
  const roll = useSharedValue(0);
  const previewStartsAt = useSharedValue(-1e9);

  useFrameCallback((frame) => {
    'worklet';
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 16) / 1000);
    // Kept small so the graphics chip's numbers stay precise.
    time.value = (time.value + dt) % 1000;
    const look = scopeLook(scopeClarity(needle.value), patched.value);
    roll.value = scopeRoll(roll.value, look, dt);
  });

  // How fully Asunder has the screen right now: a scheduled override, or
  // the press-and-hold preview. (Reading `time` makes this update every frame.)
  const overrideAmount = useDerivedValue(() => {
    time.value;
    const now = Date.now() / 1000;
    const scheduled = scopeOverrideAt(now, overrides);
    const preview = scopeOverrideAt(now, [
      { startsAt: previewStartsAt.value, seconds: PREVIEW_SECONDS, picture: OVERRIDE_PREVIEW_PICTURE },
    ]);
    return Math.max(scheduled.amount, preview.amount);
  });

  // XY mode's look (vector art).
  const xyLook = useDerivedValue(() => scopeXYLook(scopeClarity(needle.value), patched.value));

  const uniforms = useDerivedValue(() => {
    const T = ScopeTuning;
    const look = scopeLook(scopeClarity(needle.value), patched.value);
    return {
      size: [Math.max(1, size.width), Math.max(1, size.height)],
      time: time.value,
      roll: roll.value,
      pictureAmount: look.picture,
      snow: look.snow,
      smear: look.smear,
      jitter: look.jitter,
      color: look.color,
      lines: T.scanlines,
      lineDepth: T.scanlineDepth,
      bulge: T.bulge,
      vignette: T.vignette,
      glow: T.glow,
      snowRate: T.snowRate,
      overrideAmount: overrideAmount.value,
      overridePixels: T.overridePixels,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const rect = { x: 0, y: 0, width: size.width, height: size.height };
  const shader = SCOPE_SHADER;
  const overrideOnly = OVERRIDE_SHADER;
  const overrideUniforms = useDerivedValue(() => ({
    size: [Math.max(1, size.width), Math.max(1, size.height)],
    overrideAmount: overrideAmount.value,
    overridePixels: ScopeTuning.overridePixels,
  }));

  return (
    <Pressable
      style={styles.screen}
      onLayout={onLayout}
      onLongPress={() => {
        previewStartsAt.value = Date.now() / 1000;
      }}
    >
      {isVector && overrideImage && size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <XYTrace art={art} width={size.width} height={size.height} look={xyLook} time={time} />
          {/* Asunder's square pixels, over the line drawing. */}
          {overrideOnly ? (
            <Fill>
              <Shader source={overrideOnly} uniforms={overrideUniforms}>
                <ImageShader
                  image={overrideImage}
                  fit="cover"
                  rect={rect}
                  sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                />
              </Shader>
            </Fill>
          ) : null}
        </Canvas>
      ) : null}
      {!isVector && shader && overrideImage && size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={shader} uniforms={uniforms}>
              <ImageShader image={picture} fit="cover" rect={rect} />
              <ImageShader
                image={overrideImage}
                fit="cover"
                rect={rect}
                sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
              />
            </Shader>
          </Fill>
        </Canvas>
      ) : null}
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>{line ? `SCOPE · ${line.toUpperCase()}` : 'SCOPE · NO LINE'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050605',
    borderRadius: 14,
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    left: 10,
    top: 6,
  },
  labelText: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: '#7d858a',
  },
});
