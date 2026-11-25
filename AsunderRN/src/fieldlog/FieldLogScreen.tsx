import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fadeOrder,
  glyphInk,
  openPages,
  pageSignalHeader,
  parseInk,
  scriptGlyphs,
  wordsInk,
} from './FieldLogModel';
import type { InkSegment } from './FieldLogModel';
import { FIELD_LOG_PAGES } from './FieldLogPages';
import type { LogLine, LogPage } from './FieldLogPages';
import { FieldLogTuning as T } from './FieldLogTuning';

/**
 * THE FIELD LOG SCREEN: the Physicist's notebook, one page at a time.
 *
 * PLACEHOLDER LOOK: ruled cream paper and the phone's own handwriting-style
 * font. The real paper, ink and hand are Evan's art (Phase 4); the colours
 * and spacing are in FieldLogTuning so they're easy to swap.
 *
 * THE FADE: when you turn to a page, each line of math with a `fade` level
 * starts dissolving, letter by letter, and the words written under it
 * surface as the symbols go. It runs over FieldLogTuning.fadeSeconds and
 * stops at that line's `fade` (so 0.3 = mostly still math, 0.9 = almost
 * only words). Turning away and back plays it again.
 */

/**
 * A handwriting-style font that's already on each kind of device, so no
 * font file is needed yet. iPhone has Noteworthy; Android has a casual
 * face; browsers pick whatever "cursive" means on that computer.
 */
const HAND_FONT = Platform.select({
  ios: 'Noteworthy',
  android: 'casual',
  default: '"Bradley Hand", "Segoe Print", "Comic Neue", cursive',
});

/** Make a '#RRGGBB' colour see-through by `alpha` (0 to 1). */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(3)})`;
}

/**
 * How far the fade has run since the page opened, 0 to 1. Counts up once
 * over fadeSeconds, then holds at 1. `pageKey` changing starts it over.
 */
function useFadeClock(pageKey: string): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 1000 / T.fadeSeconds);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pageKey]);
  return progress;
}

export function FieldLogScreen() {
  const pages = openPages(FIELD_LOG_PAGES, T.unlockedThrough);
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const clock = useFadeClock(page?.id ?? 'none');

  if (!page) {
    return (
      <View style={[styles.screen, styles.empty]}>
        <Text style={styles.emptyText}>the log is empty</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Paper page={page} clock={clock} />
      </ScrollView>
      <View style={styles.turnRow}>
        <Pressable disabled={index === 0} onPress={() => setIndex(index - 1)} hitSlop={16}>
          <Text style={[styles.turn, index === 0 && styles.turnOff]}>‹ back</Text>
        </Pressable>
        <Text style={styles.pageCount}>
          {index + 1} / {pages.length}
        </Text>
        <Pressable
          disabled={index >= pages.length - 1}
          onPress={() => setIndex(index + 1)}
          hitSlop={16}
        >
          <Text style={[styles.turn, index >= pages.length - 1 && styles.turnOff]}>next ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One sheet: ruled lines, margin, and the writing laid on the rules. */
function Paper({ page, clock }: { page: LogPage; clock: number }) {
  // Enough rules to fill the page, plus a few spare at the bottom.
  const rows = 4 + page.before.length + page.lines.length + page.after.length + 6;

  return (
    <View style={[styles.paper, { minHeight: rows * T.ruleSpacing }]}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.rule, { top: (i + 1) * T.ruleSpacing }]} />
      ))}
      <View style={styles.marginLine} />

      <View style={styles.writing}>
        <View style={styles.topRow}>
          {/* The frequency and time the Physicist jots down: a clue to where to tune. */}
          <Text style={styles.signalHeader}>{pageSignalHeader(page) ?? ''}</Text>
          <Text style={styles.date}>{page.date}</Text>
        </View>
        <Text style={styles.heading}>{page.heading}</Text>
        {page.before.map((text, i) => (
          <Text key={`b${i}`} style={styles.prose}>
            {text}
          </Text>
        ))}
        {page.lines.map((line, i) => (
          <MathLine key={`${page.id}-${i}`} line={line} clock={clock} />
        ))}
        {page.after.map((text, i) => (
          <Text key={`a${i}`} style={[styles.prose, i === 0 && styles.afterMath]}>
            {text}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** One line of math, with its words waiting underneath. */
function MathLine({ line, clock }: { line: LogLine; clock: number }) {
  const progress = clock * (line.fade ?? 0);
  const segments = parseInk(line.ink);
  // Count every letter on the line so each knows its place in the fade.
  const count = segments.reduce((n, s) => n + scriptGlyphs(s.text).length, 0);
  let offset = 0;

  return (
    <View style={[styles.mathLine, line.margin && styles.marginNote]}>
      {line.fadesInto !== undefined && (
        <Text
          style={[styles.words, { color: withAlpha(T.wordsColor, wordsInk(progress)) }]}
          numberOfLines={1}
        >
          {line.fadesInto}
        </Text>
      )}
      <View style={styles.glyphRow}>
        {segments.map((segment, i) => {
          const start = offset;
          offset += scriptGlyphs(segment.text).length;
          return (
            <Segment
              key={i}
              segment={segment}
              start={start}
              count={count}
              progress={progress}
              small={line.margin === true}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A run of letters with one mark: plain, crossed out, or circled. */
function Segment({
  segment,
  start,
  count,
  progress,
  small,
}: {
  segment: InkSegment;
  start: number;
  count: number;
  progress: number;
  small: boolean;
}) {
  const glyphs = scriptGlyphs(segment.text);
  const ink = segment.mark === 'circle' ? T.correctionColor : T.inkColor;
  const size = small ? 15 : 21;
  // A circle or a strike fades with its letters (as solid as the first one).
  const markInk = glyphInk(progress, fadeOrder(start, count, T.fadeScatter), T.fadeSoftness);

  return (
    <View
      style={[
        styles.segment,
        segment.mark === 'circle' && [styles.circle, { borderColor: withAlpha(T.correctionColor, markInk) }],
      ]}
    >
      {glyphs.map((g, i) => {
        const solid = glyphInk(progress, fadeOrder(start + i, count, T.fadeScatter), T.fadeSoftness);
        const lifted = g.pos !== 'base';
        return (
          <Text
            key={i}
            style={[
              styles.glyph,
              {
                fontSize: lifted ? size * 0.62 : size,
                color: withAlpha(ink, solid),
                // Raise or lower exponents and subscripts off the line.
                transform: [{ translateY: g.pos === 'sup' ? -size * 0.45 : g.pos === 'sub' ? size * 0.2 : 0 }],
              },
            ]}
          >
            {g.ch === ' ' ? ' ' : g.ch}
          </Text>
        );
      })}
      {segment.mark === 'strike' && (
        <View style={[styles.strike, { backgroundColor: withAlpha(T.inkColor, markInk) }]} />
      )}
    </View>
  );
}

const MARGIN = 44;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#14110d' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: HAND_FONT, color: '#6b6355', fontSize: 16 },
  scroll: { padding: 12 },
  paper: {
    backgroundColor: T.paperColor,
    borderRadius: 2,
    overflow: 'hidden',
    paddingBottom: T.ruleSpacing,
  },
  rule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: T.ruleColor },
  marginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: MARGIN,
    width: 1,
    backgroundColor: T.marginColor,
  },
  writing: { paddingLeft: MARGIN + 10, paddingRight: 14, paddingTop: T.ruleSpacing * 0.25 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', height: T.ruleSpacing * 0.75 },
  signalHeader: { fontFamily: HAND_FONT, fontSize: 14, color: T.inkColor },
  date: {
    fontFamily: HAND_FONT,
    fontSize: 14,
    color: T.inkColor,
    textAlign: 'right',
  },
  heading: {
    fontFamily: HAND_FONT,
    fontSize: 19,
    color: T.inkColor,
    height: T.ruleSpacing,
    textDecorationLine: 'underline',
  },
  prose: { fontFamily: HAND_FONT, fontSize: 17, color: T.inkColor, height: T.ruleSpacing },
  afterMath: { marginTop: T.ruleSpacing * 0.5 },
  mathLine: { minHeight: T.ruleSpacing * 1.5, justifyContent: 'flex-end' },
  marginNote: {
    minHeight: T.ruleSpacing,
    alignItems: 'flex-end',
    transform: [{ rotate: '-3deg' }],
  },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    fontFamily: HAND_FONT,
    fontSize: 18,
    fontStyle: 'italic',
  },
  glyphRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  // A long line wraps onto the next rule instead of running off the page.
  segment: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, alignItems: 'flex-end' },
  glyph: { fontFamily: HAND_FONT },
  circle: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 5,
    marginHorizontal: 2,
    transform: [{ rotate: '-8deg' }],
  },
  strike: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: '55%',
    height: 1.5,
    transform: [{ rotate: '-1.5deg' }],
  },
  turnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  turn: { fontFamily: HAND_FONT, fontSize: 16, color: '#d8cdb4' },
  turnOff: { color: '#4a443a' },
  pageCount: { fontFamily: HAND_FONT, fontSize: 14, color: '#8a8070' },
});
