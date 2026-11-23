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
} from '../index';

// The cord board's arithmetic (CordBoard.ts). New tests; there's no Swift version.

const inputs = ['analyzer', 'scope', 'ear'];
const outputs = ['line-1', 'line-2', 'line-3', 'line-4', 'line-5', 'line-6'];
// A board 240 wide: six lines, so jacks are 40 apart. Two holes per line.
const g = cordBoardGeometry(240, 400, outputs.length, 2, inputs.length);
const nobody = [-1, -1, -1];

describe('CordBoardTests', () => {
  test('jacks are laid out one column per line, evenly spaced', () => {
    expect(cordJackCount(g)).toBe(12);
    expect(g.pitch).toBe(40);
    expect(cordJackX(g, 0)).toBe(20);
    expect(cordJackX(g, 2)).toBe(60); // line 2, first hole
    expect(cordJackY(g, 3) - cordJackY(g, 2)).toBe(40); // second hole is one step down
    expect(cordJackLine(g, 11)).toBe(5);
  });

  test('everything fits inside the board', () => {
    for (let jack = 0; jack < cordJackCount(g); jack += 1) {
      expect(cordJackX(g, jack)).toBeGreaterThan(0);
      expect(cordJackX(g, jack)).toBeLessThan(g.width);
      expect(cordJackY(g, jack)).toBeGreaterThan(0);
      expect(cordJackY(g, jack)).toBeLessThan(g.homeY);
    }
    expect(g.homeY).toBeLessThan(g.height);
    expect(cordHomeX(g, 0)).toBe(40);
    expect(cordHomeX(g, 2)).toBe(200);
  });

  test('an unplugged cord rests in the shelf, a plugged one in its jack', () => {
    expect(cordRestX(g, nobody, 1)).toBe(cordHomeX(g, 1));
    expect(cordRestY(g, nobody, 1)).toBe(g.homeY);
    expect(cordRestX(g, [-1, 4, -1], 1)).toBe(cordJackX(g, 4));
    expect(cordRestY(g, [-1, 4, -1], 1)).toBe(cordJackY(g, 4));
  });

  test('seats: a patched cord takes the first hole on its line', () => {
    expect(cordSeats({}, inputs, outputs, [], 2)).toEqual([-1, -1, -1]);
    expect(cordSeats({ analyzer: 'line-2' }, inputs, outputs, [], 2)).toEqual([2, -1, -1]);
  });

  test('seats: two cords on one line get a hole each', () => {
    expect(cordSeats({ analyzer: 'line-2', ear: 'line-2' }, inputs, outputs, [], 2)).toEqual([2, -1, 3]);
  });

  test('seats: a cord keeps the hole it was in while it stays on that line', () => {
    // The ear was in the second hole of line 2; the analyzer joins it.
    expect(cordSeats({ analyzer: 'line-2', ear: 'line-2' }, inputs, outputs, [-1, -1, 3], 2)).toEqual([2, -1, 3]);
    // The analyzer moves to line 5; the ear doesn't shuffle up.
    expect(cordSeats({ analyzer: 'line-5', ear: 'line-2' }, inputs, outputs, [2, -1, 3], 2)).toEqual([8, -1, 3]);
  });

  test('seats: more cords than holes share the last hole instead of vanishing', () => {
    const all = { analyzer: 'line-1', scope: 'line-1', ear: 'line-1' };
    expect(cordSeats(all, inputs, outputs, [], 2)).toEqual([0, 1, 1]);
  });

  test('a plug near an empty jack snaps to it, and far from any it does not', () => {
    expect(cordNearestFreeJack(g, cordJackX(g, 5) + 6, cordJackY(g, 5) - 6, nobody, 0)).toBe(5);
    expect(cordNearestFreeJack(g, 120, g.homeY, nobody, 0)).toBe(-1);
  });

  test("a plug won't go into a jack another cord is in, but can go back into its own", () => {
    const seats = [5, -1, -1];
    expect(cordNearestFreeJack(g, cordJackX(g, 5), cordJackY(g, 5), seats, 1)).not.toBe(5);
    expect(cordNearestFreeJack(g, cordJackX(g, 5), cordJackY(g, 5), seats, 0)).toBe(5);
  });

  test('a touch picks up the nearest plug, wherever that plug is', () => {
    expect(cordNearestPlug(g, cordHomeX(g, 2) + 5, g.homeY - 5, nobody)).toBe(2);
    expect(cordNearestPlug(g, cordJackX(g, 7), cordJackY(g, 7), [-1, 7, -1])).toBe(1);
    expect(cordNearestPlug(g, cordJackX(g, 7), cordJackY(g, 7), nobody)).toBe(-1);
  });

  test('a cord hangs lower when its ends are close than when it is pulled far', () => {
    const near = cordSag(g, 40, 360, 60, 300);
    const far = cordSag(g, 40, 360, 220, 50);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  test('a board with no room yet gives zeros, not errors', () => {
    const empty = cordBoardGeometry(0, 0, 6, 2, 3);
    expect(cordSag(empty, 0, 0, 0, 0)).toBe(0);
    expect(cordNearestPlug(empty, 0, 0, nobody)).toBe(-1); // nothing to grab yet
  });
});

describe('CordBoardTests: where the jacks sit', () => {
  test('on a tall board the jacks sit a fixed reach above the shelf', () => {
    const tall = cordBoardGeometry(240, 800, 6, 2, 3);
    const lowestJackY = cordJackY(tall, 1);
    expect(tall.homeY - lowestJackY).toBeCloseTo(4 * tall.pitch); // DeskTuning.shelfGap
  });

  test('on a short board the jacks stop at the top instead of going off it', () => {
    const short = cordBoardGeometry(240, 200, 6, 2, 3);
    expect(cordJackY(short, 0)).toBeGreaterThan(0);
  });
});
