import { readVectorArt, scopeXYLook, svgBox, svgShapes, ScopeTuning } from '../index';

// Reading SVG files for the scope's XY mode (VectorArt.ts). New, no Swift version.

describe('vector art', () => {
  test('reads the drawing area from viewBox, or else width and height', () => {
    expect(svgBox('<svg viewBox="0 0 200 100"></svg>')).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(svgBox('<svg width="64px" height="48px"></svg>')).toEqual({ x: 0, y: 0, width: 64, height: 48 });
    expect(svgBox('<svg></svg>')).toBeNull();
  });

  test('turns every kind of shape into a path, in order', () => {
    const svg = `<svg viewBox="0 0 100 100">
      <!-- <circle cx="1" cy="1" r="1"/> a comment, not drawn -->
      <defs><rect x="0" y="0" width="5" height="5"/></defs>
      <path d="M 10 10 L 90 90" fill="none"/>
      <line x1="0" y1="0" x2="10" y2="20"/>
      <polyline points="0,0 10,0 10,10"/>
      <polygon points="0 0 10 0 10 10"/>
      <rect x="5" y="6" width="10" height="20"/>
      <circle cx="50" cy="50" r="10"/>
      <ellipse cx="50" cy="50" rx="20" ry="10"/>
    </svg>`;
    expect(svgShapes(svg)).toEqual([
      'M 10 10 L 90 90',
      'M0 0 L10 20',
      'M0 0 L10 0 L10 10',
      'M0 0 L10 0 L10 10 Z',
      'M5 6 H15 V26 H5 Z',
      'M40 50 A10 10 0 1 0 60 50 A10 10 0 1 0 40 50 Z',
      'M30 50 A20 10 0 1 0 70 50 A20 10 0 1 0 30 50 Z',
    ]);
  });

  test("doesn't mix up x with cx, or r with rx", () => {
    expect(svgShapes('<ellipse cx="5" cy="5" rx="2" ry="1" r="9" x="99"/>')).toEqual([
      'M3 5 A2 1 0 1 0 7 5 A2 1 0 1 0 3 5 Z',
    ]);
  });

  test('skips shapes with nothing to draw', () => {
    expect(svgShapes('<rect width="0" height="5"/><circle r="0"/><path d=""/>')).toEqual([]);
  });

  test('reads a whole file', () => {
    const art = readVectorArt("<svg width='10' height='10'><line x1='0' y1='0' x2='10' y2='10'/></svg>");
    expect(art.box).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(art.shapes).toHaveLength(1);
  });
});

describe('XY look', () => {
  test('nothing patched in: no drawing, all grass', () => {
    expect(scopeXYLook(1, false)).toEqual({ brightness: 0, wobble: ScopeTuning.xyWobbleLost, grass: 1 });
  });

  test('tuned in: bright, steady, little grass', () => {
    const look = scopeXYLook(1, true);
    expect(look.brightness).toBe(1);
    expect(look.wobble).toBeCloseTo(ScopeTuning.xyWobbleClear, 10);
    expect(look.grass).toBeCloseTo(ScopeTuning.xyGrassClear, 10);
  });
});
