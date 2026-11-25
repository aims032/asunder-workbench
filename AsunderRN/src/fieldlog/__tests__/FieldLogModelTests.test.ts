import {
  fadeOrder,
  glyphInk,
  openPages,
  pageSignalHeader,
  parseInk,
  scriptGlyphs,
  wordsInk,
} from '../FieldLogModel';
import { FIELD_LOG_PAGES } from '../FieldLogPages';
import { TRANSMISSION_SCHEDULE } from '../../core';

describe('parseInk', () => {
  test('plain text stays whole', () => {
    expect(parseInk('E ≈ T · ΔS')).toEqual([{ text: 'E ≈ T · ΔS', mark: 'plain' }]);
  });

  test('finds strikes and circles in order', () => {
    expect(parseInk('a ~~b~~ ((c)) d')).toEqual([
      { text: 'a ', mark: 'plain' },
      { text: 'b', mark: 'strike' },
      { text: ' ', mark: 'plain' },
      { text: 'c', mark: 'circle' },
      { text: ' d', mark: 'plain' },
    ]);
  });

  test('an unclosed mark is just text', () => {
    expect(parseInk('x ~~y')).toEqual([{ text: 'x ~~y', mark: 'plain' }]);
  });

  test('the corrected pendulum circles the minus sign', () => {
    const page = FIELD_LOG_PAGES.find((p) => p.id === 'pendulum-corrected')!;
    const circled = page.lines.flatMap((l) => parseInk(l.ink)).filter((s) => s.mark === 'circle');
    expect(circled.map((s) => s.text)).toEqual(['−']);
  });
});

describe('the fade', () => {
  test('every letter is solid at the start and gone at the end', () => {
    for (let i = 0; i < 20; i++) {
      const order = fadeOrder(i, 20, 0.45);
      expect(glyphInk(0, order, 0.35)).toBe(1);
      expect(glyphInk(1, order, 0.35)).toBe(0);
    }
  });

  test('a letter only ever fades, never comes back', () => {
    const order = fadeOrder(7, 20, 0.45);
    let previous = 1;
    for (let p = 0; p <= 1; p += 0.05) {
      const ink = glyphInk(p, order, 0.35);
      expect(ink).toBeLessThanOrEqual(previous + 1e-9);
      previous = ink;
    }
  });

  test('with no scatter it runs left to right', () => {
    expect(fadeOrder(0, 10, 0)).toBe(0);
    expect(fadeOrder(9, 10, 0)).toBe(1);
  });

  test('the order is the same every time', () => {
    expect(fadeOrder(5, 12, 0.45)).toBe(fadeOrder(5, 12, 0.45));
  });

  test('words come in behind the math', () => {
    expect(wordsInk(0)).toBe(0);
    expect(wordsInk(0.1)).toBe(0);
    expect(wordsInk(1)).toBe(1);
  });
});

describe('pages', () => {
  test('there are seven, unlocking in order', () => {
    expect(FIELD_LOG_PAGES).toHaveLength(7);
    const unlocks = FIELD_LOG_PAGES.map((p) => p.unlocksAt);
    expect([...unlocks].sort((a, b) => a - b)).toEqual(unlocks);
  });

  test('only unlocked pages are open', () => {
    expect(openPages(FIELD_LOG_PAGES, 0)).toHaveLength(0);
    expect(openPages(FIELD_LOG_PAGES, 3).map((p) => p.id)).toEqual([
      'coupling',
      'cost-per-message',
      'pendulum',
    ]);
  });

  test('no page is canon until Evan says so', () => {
    expect(FIELD_LOG_PAGES.every((p) => p.canon === false)).toBe(true);
  });

  test('fade levels are between 0 and 1 and every fading line has words', () => {
    for (const line of FIELD_LOG_PAGES.flatMap((p) => p.lines)) {
      if (line.fade !== undefined) {
        expect(line.fade).toBeGreaterThanOrEqual(0);
        expect(line.fade).toBeLessThanOrEqual(1);
        expect(line.fadesInto).toBeDefined();
      }
    }
  });
});

describe('scriptGlyphs', () => {
  test('raises exponents and lowers subscripts', () => {
    const g = scriptGlyphs('e^{iS}γ_Mx^2');
    expect(g.map((x) => `${x.ch}:${x.pos}`)).toEqual([
      'e:base', 'i:sup', 'S:sup', 'γ:base', 'M:sub', 'x:base', '2:sup',
    ]);
  });

  test('a fancy letter counts once', () => {
    expect(scriptGlyphs('𝒟x')).toHaveLength(2);
  });
});

test('a subscript inside an exponent drops its underscore', () => {
  expect(scriptGlyphs('e^{γ_A}').map((g) => g.ch).join('')).toBe('eγA');
});

describe('the frequency header', () => {
  test('a page with a signal gets that transmission\'s frequency and time', () => {
    const page = { ...FIELD_LOG_PAGES[0], signal: 'transmission-001' };
    expect(pageSignalHeader(page)).toBe('14.23 MHz · 02:10');
  });

  test('no signal, or one not in the schedule, means no header', () => {
    expect(pageSignalHeader({ ...FIELD_LOG_PAGES[0], signal: undefined })).toBeNull();
    expect(pageSignalHeader({ ...FIELD_LOG_PAGES[0], signal: 'nope' })).toBeNull();
  });

  test('every signal written on a page is a real transmission', () => {
    const ids = TRANSMISSION_SCHEDULE.map((e) => e.id);
    for (const page of FIELD_LOG_PAGES) {
      if (page.signal !== undefined) {
        expect(ids).toContain(page.signal);
      }
    }
  });
});
