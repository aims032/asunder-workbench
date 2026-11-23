// THE CORD BOARD: where the jacks and cords sit on the desk, and what a
// finger dragging a plug is closest to. Pure arithmetic, no screen: the desk
// (src/desk/CordBoard.tsx) draws it and follows the finger.
//
// The look is the 1940s operator's board (Evan, Nov 23, final): cords come up
// out of the desk shelf at the bottom, and you pull a plug up and push it
// into a jack above.
//
// How it maps onto the switchboard (core/Switchboard.ts):
//   each CORD is one of the board's INPUTS (an instrument: analyzer, scope, ear)
//   each column of JACKS is one of the board's OUTPUTS (a phone line)
// So plugging the analyzer's cord into line 2 is the message
//   { kind: 'patch', from: 'line-2', to: 'analyzer' }
// and pulling it out and letting go is { kind: 'unpatch', to: 'analyzer' }.
//
// A line has DeskTuning.jacksPerLine holes, so more than one instrument can
// listen to the same line. Which HOLE a cord is in is only a picture detail
// (the "seat"); the switchboard itself only knows which line.
//
// Jacks are numbered in one run: jack = line * holesPerLine + hole.
// A seat of -1 means the cord is resting in the shelf, not plugged in.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

import { DeskTuning } from './Tuning';

/** The measurements of one board, worked out from the space it has. */
export interface CordBoardGeometry {
  width: number;
  height: number;
  /** How many phone lines (columns of jacks). */
  lines: number;
  /** How many holes each line has. */
  holesPerLine: number;
  /** How many cords. */
  cords: number;
  /** The distance from one jack to the next, across and down. */
  pitch: number;
  /** How big a jack hole is drawn. */
  jackRadius: number;
  /** The y of the first row of jacks. */
  jackTop: number;
  /** The y of the shelf the cords rest in. */
  homeY: number;
}

/** Lay a board out in a space `width` by `height` points. */
export function cordBoardGeometry(
  width: number,
  height: number,
  lines: number,
  holesPerLine: number,
  cords: number,
): CordBoardGeometry {
  const pitch = lines > 0 ? width / lines : 0;
  // The shelf sits at the bottom, in reach of a thumb. The jacks sit
  // DeskTuning.shelfGap spacings above it, or at the top of the space if the
  // board is too short for that.
  const homeY = height - DeskTuning.boardLabelSpace - pitch * 0.5;
  const highest = DeskTuning.boardLabelSpace + pitch * 0.5;
  const wanted = homeY - (DeskTuning.shelfGap + holesPerLine - 1) * pitch;
  return {
    width: width,
    height: height,
    lines: lines,
    holesPerLine: holesPerLine,
    cords: cords,
    pitch: pitch,
    jackRadius: pitch * DeskTuning.jackSize * 0.5,
    jackTop: Math.max(highest, wanted),
    homeY: homeY,
  };
}

/** How many jacks the board has in all. */
export function cordJackCount(g: CordBoardGeometry): number {
  return g.lines * g.holesPerLine;
}

/** Which line (column) a jack belongs to. */
export function cordJackLine(g: CordBoardGeometry, jack: number): number {
  return Math.floor(jack / g.holesPerLine);
}

/** The middle of a jack, across. */
export function cordJackX(g: CordBoardGeometry, jack: number): number {
  return (cordJackLine(g, jack) + 0.5) * g.pitch;
}

/** The middle of a jack, down. */
export function cordJackY(g: CordBoardGeometry, jack: number): number {
  return g.jackTop + (jack % g.holesPerLine) * g.pitch;
}

/** Where a cord comes out of the shelf, across. (Down is g.homeY.) */
export function cordHomeX(g: CordBoardGeometry, cord: number): number {
  return g.cords > 0 ? ((cord + 0.5) * g.width) / g.cords : 0;
}

/** Where a cord's plug sits when nobody is holding it, across. */
export function cordRestX(g: CordBoardGeometry, seats: number[], cord: number): number {
  const seat = seats[cord];
  return seat >= 0 ? cordJackX(g, seat) : cordHomeX(g, cord);
}

/** Where a cord's plug sits when nobody is holding it, down. */
export function cordRestY(g: CordBoardGeometry, seats: number[], cord: number): number {
  const seat = seats[cord];
  return seat >= 0 ? cordJackY(g, seat) : g.homeY;
}

/**
 * Which hole each cord sits in, worked out from the switchboard's cables.
 *
 * `cables` is the switchboard's own record (input -> output). `inputs` are
 * the cords in order and `outputs` the lines in order. A cord that is still
 * on the line it was on last time keeps its hole (`previous`), so nothing
 * jumps about; otherwise it takes the first empty hole on its line. If a line
 * somehow has more cords than holes (only a loaded board could do that), the
 * extras share the last hole rather than being lost.
 */
export function cordSeats(
  cables: Record<string, string>,
  inputs: string[],
  outputs: string[],
  previous: number[],
  holesPerLine: number,
): number[] {
  const seats: number[] = [];
  // First pass: cords that can stay exactly where they were.
  for (let cord = 0; cord < inputs.length; cord += 1) {
    const line = outputs.indexOf(cables[inputs[cord]] ?? '');
    const was = previous[cord] ?? -1;
    const stays = line >= 0 && was >= 0 && Math.floor(was / holesPerLine) === line && !seats.includes(was);
    seats.push(stays ? was : -1);
  }
  // Second pass: everyone else takes the first empty hole on their line.
  for (let cord = 0; cord < inputs.length; cord += 1) {
    const line = outputs.indexOf(cables[inputs[cord]] ?? '');
    if (line < 0 || seats[cord] >= 0) {
      continue;
    }
    let seat = line * holesPerLine + holesPerLine - 1;
    for (let hole = 0; hole < holesPerLine; hole += 1) {
      if (!seats.includes(line * holesPerLine + hole)) {
        seat = line * holesPerLine + hole;
        break;
      }
    }
    seats[cord] = seat;
  }
  return seats;
}

/**
 * The empty jack closest to a point, or -1 if none is within
 * DeskTuning.cordSnapReach. The hole `cord` itself is sitting in counts as
 * empty (you can put a plug back where it came from).
 */
export function cordNearestFreeJack(g: CordBoardGeometry, x: number, y: number, seats: number[], cord: number): number {
  const reach = g.pitch * DeskTuning.cordSnapReach;
  let best = -1;
  let bestDistance = reach;
  const count = cordJackCount(g);
  for (let jack = 0; jack < count; jack += 1) {
    const holder = seats.indexOf(jack);
    if (holder >= 0 && holder !== cord) {
      continue;
    }
    const distance = Math.hypot(x - cordJackX(g, jack), y - cordJackY(g, jack));
    if (distance <= bestDistance) {
      best = jack;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The cord whose plug is closest to a touch, or -1 if the touch isn't within
 * DeskTuning.cordGrabReach of any plug.
 */
export function cordNearestPlug(g: CordBoardGeometry, x: number, y: number, seats: number[]): number {
  const reach = g.pitch * DeskTuning.cordGrabReach;
  let best = -1;
  let bestDistance = reach;
  for (let cord = 0; cord < g.cords; cord += 1) {
    const distance = Math.hypot(x - cordRestX(g, seats, cord), y - cordRestY(g, seats, cord));
    if (distance <= bestDistance) {
      best = cord;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * How far a cord droops below the straight line between its two ends, in
 * points. A cord has a fixed amount of slack, so it hangs lowest when the
 * ends are close together and pulls nearly straight when they are far apart.
 */
export function cordSag(g: CordBoardGeometry, ax: number, ay: number, bx: number, by: number): number {
  const far = Math.hypot(g.width, g.height);
  if (far <= 0) {
    return 0;
  }
  const stretched = Math.min(1, Math.hypot(bx - ax, by - ay) / far);
  return g.pitch * DeskTuning.cordSlack * (1 - stretched);
}
