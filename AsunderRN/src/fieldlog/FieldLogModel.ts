import type { LogPage } from './FieldLogPages';
import { signalLogHeader, TRANSMISSION_SCHEDULE } from '../core';

// THE FIELD LOG'S LOGIC: no drawing here, just the rules, so they can be
// tested. The screen (FieldLogScreen.tsx) asks these functions what to draw.

/** A piece of a written line, with how it's marked. */
export interface InkSegment {
  text: string;
  /** plain writing, crossed out, or circled in red. */
  mark: 'plain' | 'strike' | 'circle';
}

/**
 * Split a line's `ink` into pieces by its marks:
 * "a ~~b~~ ((c))" becomes plain "a ", strike "b", plain " ", circle "c".
 * A mark that's never closed is just treated as plain text.
 */
export function parseInk(ink: string): InkSegment[] {
  const segments: InkSegment[] = [];
  // Matches ~~...~~ or ((...)), shortest possible inside.
  const pattern = /~~(.+?)~~|\(\((.+?)\)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(ink)) !== null) {
    if (match.index > last) {
      segments.push({ text: ink.slice(last, match.index), mark: 'plain' });
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], mark: 'strike' });
    } else {
      segments.push({ text: match[2], mark: 'circle' });
    }
    last = pattern.lastIndex;
  }
  if (last < ink.length) {
    segments.push({ text: ink.slice(last), mark: 'plain' });
  }
  return segments;
}

/** Keep a number between 0 and 1. */
function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * A fixed "random-looking" number from 0 to 1 for a letter's position.
 * Same position in, same number out, on every phone. (A tiny hash: multiply
 * by a big odd number and keep the leftover bits.)
 */
export function scatterFor(index: number): number {
  let h = (index + 1) * 2654435761;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 1000) / 999;
}

/**
 * When a letter starts to go, from 0 to 1: its place along the line, nudged
 * by `scatter` so the fade doesn't run as a clean wipe.
 */
export function fadeOrder(index: number, count: number, scatter: number): number {
  const along = count <= 1 ? 0 : index / (count - 1);
  return clamp01(along * (1 - scatter) + scatterFor(index) * scatter);
}

/**
 * How solid one letter of math is, from 1 (fully there) to 0 (gone).
 *
 * progress  how far the line has faded, 0 to 1
 * order     when this letter goes (fadeOrder above)
 * softness  how gradual each letter's own fade is
 *
 * At progress 0 every letter is solid; at 1 every letter is gone; in
 * between, letters with a low `order` go first.
 */
export function glyphInk(progress: number, order: number, softness: number): number {
  const soft = Math.max(0.0001, softness);
  const edge = progress * (1 + soft);
  return clamp01((order + soft - edge) / soft);
}

/**
 * How strongly the words under a line show, 0 to 1. They come in as the
 * math goes, a little behind it, so for a moment there's only paper.
 */
export function wordsInk(progress: number): number {
  return clamp01((progress - 0.15) / 0.85);
}

/** The pages this phone may see, in order. */
export function openPages(pages: LogPage[], unlockedThrough: number): LogPage[] {
  return pages.filter((page) => page.unlocksAt <= unlockedThrough);
}

/** One letter of math, and whether it sits raised, lowered or on the line. */
export interface Glyph {
  ch: string;
  pos: 'base' | 'sup' | 'sub';
}

/**
 * Split text into letters, lifting exponents and dropping subscripts the way
 * they're written by hand:
 *   e^{iS/ħ}  "iS/ħ" is raised      γ_M  "M" is lowered
 *   x^2       "2" is raised         k_{B}  "B" is lowered
 * A ^ or _ followed by {...} applies to the whole group, otherwise to the
 * one letter after it. Letters outside the plain alphabet (like 𝒟) count as
 * one letter, not two.
 */
export function scriptGlyphs(text: string): Glyph[] {
  const chars = Array.from(text);
  const glyphs: Glyph[] = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    const pos = c === '^' ? 'sup' : c === '_' ? 'sub' : null;
    if (pos !== null && i + 1 < chars.length) {
      if (chars[i + 1] === '{') {
        const close = chars.indexOf('}', i + 2);
        if (close !== -1) {
          // Marks inside the group (like the _A in e^{γ_A t}) are read, then
          // the whole group takes the outer position.
          const inner = scriptGlyphs(chars.slice(i + 2, close).join(''));
          for (const g of inner) glyphs.push({ ch: g.ch, pos });
          i = close + 1;
          continue;
        }
      } else {
        glyphs.push({ ch: chars[i + 1], pos });
        i += 2;
        continue;
      }
    }
    glyphs.push({ ch: c, pos: 'base' });
    i += 1;
  }
  return glyphs;
}

/**
 * The frequency-and-time header for a page ("14.23 MHz · 02:10"), worked out
 * from the transmission its `signal` names, or null if it has none (or names
 * a transmission that isn't in the schedule).
 */
export function pageSignalHeader(page: LogPage): string | null {
  if (page.signal === undefined) {
    return null;
  }
  const entry = TRANSMISSION_SCHEDULE.find((e) => e.id === page.signal);
  return entry === undefined ? null : signalLogHeader(entry);
}

