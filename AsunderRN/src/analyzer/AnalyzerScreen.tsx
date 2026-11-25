import {
  AlphaType,
  BlurMask,
  Canvas,
  ColorType,
  Group,
  Image,
  Path,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { FrameInfo, SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnalyzerTuning, currentBandDisplay, lineHzAt, LineTuning, TuneInTuning } from '../core';
import type { AnalyzerTrace, BandPosition } from '../core';
import { MONOSPACED_FONT } from '../fonts';
import {
  bandWidthHz,
  hzLabel,
  panelRbw,
  panelSpan,
  panelSweepSeconds,
  secondsLabel,
  spanLabel,
  TRACE_MODE_NAMES,
} from './AnalyzerControls';
import type { PanelState } from './AnalyzerControls';
import { analyzerModelFrame, ZOOM_SPAN } from './AnalyzerModel';
import type { AnalyzerModel } from './AnalyzerModel';

// THE ANALYZER'S SCREEN: the digital half of the instrument.
//
// Modeled on the Keysight N9032B's swept display (Confirmed Nov 20): a dark
// screen, a 10 x 10 grid, a glowing trace, a diamond marker, and the settings
// written around the edge in the same places the Keysight writes them
// (reference level top left, marker top right, center/span/RBW/sweep along
// the bottom). In Split view the spectrogram sits under the trace: each row is
// one past sweep, newest at the top, brighter = stronger.
//
// The screen counts as display, not artwork, so it's built properly now. The
// colors below are placeholders that Evan can change in one place.

/** Screen colors. Amber trace, like the bench's VU lights. */
const SCREEN = {
  glass: '#07090a',
  grid: '#2c3236',
  trace: '#ffc23d',
  marker: '#ffffff',
  text: '#c9ced1',
  dimText: '#7d858a',
};

/** How the spectrogram colors a level, from the floor (dark) to strong (near white). */
function spectrogramColors(): number[] {
  // 256 steps of r, g, b, one after another.
  const lut: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    const v = i / 255;
    lut.push(
      Math.round(255 * Math.min(1, v * 1.6)),
      Math.round(200 * Math.pow(v, 1.4) + 55 * Math.pow(v, 4)),
      Math.round(40 * Math.pow(v, 3) + 160 * Math.pow(v, 8)),
    );
  }
  return lut;
}

/** How far down the screen a level sits, 0 (top) to 1 (bottom), clamped. */
function levelToDepth(db: number, referenceDb: number): number {
  'worklet';
  const range = AnalyzerTuning.dbPerDivision * AnalyzerTuning.divisions;
  return Math.max(0, Math.min(1, (referenceDb - db) / range));
}

/**
 * The spectrogram as a picture: one pixel per point across, one row per past
 * sweep down, newest at the top. Runs on the screen thread.
 */
function makeSpectrogramImage(
  trace: AnalyzerTrace,
  referenceDb: number,
  lut: number[],
): SkImage | null {
  'worklet';
  const n = trace.points;
  const rows = trace.rows;
  const bytes = new Uint8Array(n * rows * 4);
  for (let r = 0; r < rows; r += 1) {
    const ringRow = (trace.newestRow - r + rows) % rows;
    for (let i = 0; i < n; i += 1) {
      const db = trace.history[ringRow * n + i];
      const at = (r * n + i) * 4;
      if (db !== db) {
        // NaN (nothing measured there yet): plain glass, #07090a.
        bytes[at] = 7;
        bytes[at + 1] = 9;
        bytes[at + 2] = 10;
      } else {
        // Brightness: 1 at the reference level, 0 at spectrogramRangeDb below it.
        const level = Math.max(0, Math.min(1, 1 - (referenceDb - db) / AnalyzerTuning.spectrogramRangeDb));
        const k = Math.round(level * 255) * 3;
        bytes[at] = lut[k];
        bytes[at + 1] = lut[k + 1];
        bytes[at + 2] = lut[k + 2];
      }
      bytes[at + 3] = 255;
    }
  }
  return Skia.Image.MakeImage(
    { width: n, height: rows, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Opaque },
    Skia.Data.fromBytes(bytes),
    n * 4,
  );
}

interface ScreenReadout {
  center: BandPosition;
  markerDb: number;
  /** The phone line patched into the analyzer (only matters on LINE). */
  line: string | null;
}

export function AnalyzerScreen({
  model,
  needle,
  panel,
}: {
  model: AnalyzerModel;
  needle: SharedValue<BandPosition>;
  panel: PanelState;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState<ScreenReadout>({ center: needle.value, markerDb: -200, line: null });

  // The panel's display settings, copied over to the screen thread.
  const referenceDb = useSharedValue(panel.referenceDb);
  useEffect(() => {
    referenceDb.value = panel.referenceDb;
  }, [panel.referenceDb, referenceDb]);

  // Where the trace and the spectrogram go, depending on the view.
  const traceHeight =
    panel.view === 'trace' ? size.height : panel.view === 'split' ? size.height / 2 : 0;
  const spectroTop = panel.view === 'split' ? traceHeight : 0;
  const spectroHeight = size.height - traceHeight;

  // MARK: Running the sweep

  /** How tall the spectrogram is right now, copied to the screen thread (0 = hidden). */
  const showSpectro = useSharedValue(spectroHeight > 0);
  useEffect(() => {
    showSpectro.value = spectroHeight > 0;
  }, [spectroHeight, showSpectro]);

  /** The spectrogram picture (see makeSpectrogramImage), remade every few frames. */
  const spectroImage = useSharedValue<SkImage | null>(null);
  const frameCount = useSharedValue(0);
  const lastReadoutTime = useSharedValue(0);
  const lut = useMemo(spectrogramColors, []);
  const showReadout = useCallback((r: ScreenReadout) => setReadout(r), []);

  // (useCallback keeps this the same function between redraws; otherwise
  // the frame loop would be taken down and set up again every redraw.)
  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const dt =
        info.timeSincePreviousFrame === null ? 1 / 60 : info.timeSincePreviousFrame / 1000;
      analyzerModelFrame(model, needle.value, dt);
      const trace = model.state.value.trace;

      // The spectrogram picture, every third frame: often enough to look
      // live, rarely enough to stay cheap.
      frameCount.value += 1;
      if (showSpectro.value && frameCount.value % 3 === 0) {
        spectroImage.value = makeSpectrogramImage(trace, referenceDb.value, lut);
      }

      // The numbers on the screen only update a few times a second.
      if (info.timestamp - lastReadoutTime.value > 1000 / AnalyzerTuning.markerReadoutRate) {
        lastReadoutTime.value = info.timestamp;
        const middle = (trace.points - 1) / 2;
        scheduleOnRN(showReadout, {
          center: needle.value,
          markerDb: trace.values[middle],
          line: model.patchedLine.value,
        });
      }
    },
    [model, needle, frameCount, showSpectro, spectroImage, referenceDb, lut, lastReadoutTime, showReadout],
  );
  useFrameCallback(onFrame);

  // MARK: Drawing

  // The grid, drawn once per size.
  const grid = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    if (traceHeight > 0) {
      for (let i = 0; i <= 10; i += 1) {
        const x = (i / 10) * size.width;
        builder.moveTo(x, 0).lineTo(x, traceHeight);
        const y = (i / AnalyzerTuning.divisions) * traceHeight;
        builder.moveTo(0, y).lineTo(size.width, y);
      }
    }
    return builder.build();
  }, [size.width, traceHeight]);

  // The trace, remade every frame. Points the sweep hasn't reached yet
  // (since a new span or a clear) are left out, so you can watch it draw.
  const tracePath = useDerivedValue(() => {
    model.frame.value; // redraw on every frame
    const trace = model.state.value.trace;
    const builder = Skia.PathBuilder.Make();
    const n = trace.points;
    const dx = size.width / (n - 1);
    const shift = model.nudge.value;
    let drawing = false;
    for (let i = 0; i < n; i += 1) {
      if (trace.counts[i] === 0) {
        drawing = false;
        continue;
      }
      const x = (i - shift) * dx;
      const y = levelToDepth(trace.values[i], referenceDb.value) * traceHeight;
      if (drawing) {
        builder.lineTo(x, y);
      } else {
        builder.moveTo(x, y);
        drawing = true;
      }
    }
    return builder.build();
  });

  // The marker: a diamond on the trace where the dial is (the middle).
  const markerPath = useDerivedValue(() => {
    model.frame.value;
    const trace = model.state.value.trace;
    const middle = (trace.points - 1) / 2;
    const x = size.width / 2;
    const y = levelToDepth(trace.values[middle], referenceDb.value) * traceHeight;
    const r = 5;
    const builder = Skia.PathBuilder.Make();
    if (trace.counts[middle] > 0 && traceHeight > 0) {
      builder.moveTo(x, y - r).lineTo(x + r, y).lineTo(x, y + r).lineTo(x - r, y).close();
    }
    return builder.build();
  });

  // THE ZOOM WINDOW (always on, BAND only): a box in the top right corner
  // with its own trace of just the few notches around the dial. It has its
  // own, magnified level scale. See TuneInTuning.zoomNotches.
  const zoomBox = useMemo(() => {
    const base = traceHeight > 0 ? traceHeight : size.height / 2;
    const width = size.width * TuneInTuning.zoomWidthShare;
    return { x: size.width - width - 4, y: 4, width: width, height: base * TuneInTuning.zoomHeightShare };
  }, [size.width, size.height, traceHeight]);

  const zoomPath = useDerivedValue(() => {
    model.frame.value; // redraw on every frame
    const zoom = model.state.value.zoom;
    const builder = Skia.PathBuilder.Make();
    const n = zoom.points;
    const dx = zoomBox.width / (n - 1);
    const shift = model.zoomNudge.value;
    let drawing = false;
    for (let i = 0; i < n; i += 1) {
      if (zoom.counts[i] === 0) {
        drawing = false;
        continue;
      }
      const x = zoomBox.x + (i - shift) * dx;
      // The window's own level scale (TuneInTuning.zoomTopDropDb, zoomRangeDb).
      const down = (referenceDb.value - TuneInTuning.zoomTopDropDb - zoom.values[i]) / TuneInTuning.zoomRangeDb;
      const y = zoomBox.y + Math.max(0, Math.min(1, down)) * zoomBox.height;
      if (drawing) {
        builder.lineTo(x, y);
      } else {
        builder.moveTo(x, y);
        drawing = true;
      }
    }
    return builder.build();
  });

  // The box's edge, and a tick top and bottom at its middle: where the dial is.
  const zoomFrame = useMemo(() => {
    const b = zoomBox;
    const builder = Skia.PathBuilder.Make();
    builder.moveTo(b.x, b.y).lineTo(b.x + b.width, b.y).lineTo(b.x + b.width, b.y + b.height).lineTo(b.x, b.y + b.height).close();
    const mid = b.x + b.width / 2;
    builder.moveTo(mid, b.y).lineTo(mid, b.y + 5);
    builder.moveTo(mid, b.y + b.height - 5).lineTo(mid, b.y + b.height);
    return builder.build();
  }, [zoomBox]);

  const spectroX = useDerivedValue(() => -model.nudge.value * (size.width / (AnalyzerTuning.points - 1)));

  // MARK: The words around the edge

  const span = panelSpan(panel);
  const rbw = panelRbw(panel);
  // On LINE the screen runs across the voice range instead of the band, so
  // the words around the edge say that instead.
  const onLine = panel.input === 'line';
  const centerHz = onLine ? lineHzAt(0.5) : currentBandDisplay.frequencyAt(readout.center);
  const manualRbw = panel.rbwIndex !== null;
  const markerText =
    readout.markerDb > -199 ? `${readout.markerDb.toFixed(1)} dBm` : '---';

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.text}>Ref {panel.referenceDb.toFixed(1)} dBm</Text>
          <Text style={styles.dim}>
            {AnalyzerTuning.dbPerDivision} dB/div · {TRACE_MODE_NAMES[panel.traceMode]}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.text}>Mkr1 {hzLabel(centerHz)}</Text>
          <Text style={styles.text}>{markerText}</Text>
        </View>
      </View>

      <View
        style={styles.glass}
        onLayout={(event) =>
          setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
        }
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.width} height={size.height} color={SCREEN.glass} />
          {spectroHeight > 0 ? (
            <Image
              image={spectroImage}
              x={spectroX}
              y={spectroTop}
              width={size.width}
              height={spectroHeight}
              fit="fill"
            />
          ) : null}
          <Path path={grid} style="stroke" strokeWidth={1} color={SCREEN.grid} />
          {/* The glow: the same trace, wider and blurred, underneath. */}
          <Path
            path={tracePath}
            style="stroke"
            strokeWidth={3}
            color={SCREEN.trace}
            opacity={AnalyzerTuning.traceGlowOpacity}
          >
            <BlurMask blur={AnalyzerTuning.traceGlow} style="normal" />
          </Path>
          <Path path={tracePath} style="stroke" strokeWidth={1.2} color={SCREEN.trace} />
          <Path path={markerPath} style="fill" color={SCREEN.marker} />
          {onLine || size.width === 0 ? null : (
            <>
              <Rect x={zoomBox.x} y={zoomBox.y} width={zoomBox.width} height={zoomBox.height} color={SCREEN.glass} />
              {/* The clip keeps the zoom trace inside its box. */}
              <Group clip={Skia.XYWHRect(zoomBox.x, zoomBox.y, zoomBox.width, zoomBox.height)}>
                <Path path={zoomPath} style="stroke" strokeWidth={1.2} color={SCREEN.trace} />
              </Group>
              <Path path={zoomFrame} style="stroke" strokeWidth={1} color={SCREEN.dimText} />
            </>
          )}
        </Canvas>
        {onLine || size.width === 0 ? null : (
          <Text style={[styles.dim, styles.zoomLabel, { left: zoomBox.x + 4, top: zoomBox.y + 3 }]}>
            ZOOM {spanLabel(readout.center, ZOOM_SPAN)}
          </Text>
        )}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.text}>
          {onLine ? `Start ${hzLabel(LineTuning.lowHz)}` : `Center ${hzLabel(centerHz)}`}
        </Text>
        <Text style={styles.text}>
          {onLine ? `Stop ${hzLabel(LineTuning.highHz)}` : `Span ${spanLabel(readout.center, span)}`}
        </Text>
      </View>
      <View style={styles.bottomRow}>
        {/* A "#" means set by hand, not Auto: the Keysight's own convention. */}
        <Text style={styles.dim}>
          {onLine
            ? `Input LINE · ${readout.line ?? 'nothing patched'}`
            : `${manualRbw ? '#' : ''}Res BW ${hzLabel(bandWidthHz(readout.center, rbw))}`}
        </Text>
        <Text style={styles.dim}>
          Sweep {secondsLabel(onLine ? LineTuning.sweepSeconds : panelSweepSeconds(panel))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN.glass,
    borderRadius: 4,
    padding: 6,
  },
  glass: {
    flex: 1,
    marginVertical: 4,
    overflow: 'hidden',
  },
  zoomLabel: {
    position: 'absolute',
    fontSize: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  right: {
    alignItems: 'flex-end',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  text: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: SCREEN.text,
  },
  dim: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 10,
    color: SCREEN.dimText,
  },
});
