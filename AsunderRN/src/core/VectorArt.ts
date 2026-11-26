// VECTOR ART: reads an SVG file (the vector format Pixelmator Pro and most
// drawing apps export) into plain line drawings the scope's XY mode can trace.
//
// The `'worklet';` line below keeps this file like the other core files. It
// has to stay the first statement in the file.
//
// RULE: a helper function (or constant) has to be written ABOVE the first place
// it is used (the DeclarationOrder test checks this).
'worklet';

// WHAT IT READS
//
// An SVG file is text. Inside it, each shape is a tag like
// <path d="M 10 10 L 90 90"/> or <circle cx="50" cy="50" r="40"/>. The "d"
// of a path is a little drawing language (M = move, L = line, C = curve...).
// This file finds every shape and turns each one into a path "d" string,
// because the drawing library (Skia) can read those directly.
//
// Shapes it understands: path, line, polyline, polygon, rect, circle, ellipse.
// Fills, colors and line widths are ignored: an XY scope only has one beam,
// so everything becomes a glowing outline.
//
// KNOWN LIMIT: `transform="..."` on shapes or groups is ignored, so a shape
// that was moved or rotated with a transform will sit in the wrong place.
// If that happens, export the SVG with transforms "flattened" or "baked in"
// (most apps have this option), or tell Claude and it can be added.

/** The drawing area the art was made in: x, y, width and height. */
export interface VectorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A piece of vector art, ready for the scope: its drawing area and its shapes. */
export interface VectorArt {
  box: VectorBox;
  /** One path "d" string per shape. */
  shapes: string[];
}

/** The value of attribute `name` inside one tag's text, or null. */
function svgAttribute(tag: string, name: string): string | null {
  // (^|\s) makes sure "x" doesn't match the end of "cx" or "rx".
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  if (!match) {
    return null;
  }
  return match[2] ?? match[3] ?? null;
}

/** An attribute as a number (0 if missing or not a number; "12px" reads as 12). */
function svgNumber(tag: string, name: string): number {
  const text = svgAttribute(tag, name);
  const value = text === null ? NaN : parseFloat(text);
  return Number.isFinite(value) ? value : 0;
}

/** A list of numbers written with spaces and/or commas, like "10,20 30 40". */
function svgNumberList(text: string): number[] {
  return text
    .trim()
    .split(/[\s,]+/)
    .map((part) => parseFloat(part))
    .filter((value) => Number.isFinite(value));
}

/** polyline/polygon "points" as a path. `closed` joins the end back to the start. */
function pointsToPath(points: string, closed: boolean): string | null {
  const n = svgNumberList(points);
  if (n.length < 4) {
    return null;
  }
  let d = `M${n[0]} ${n[1]}`;
  for (let i = 2; i + 1 < n.length; i += 2) {
    d += ` L${n[i]} ${n[i + 1]}`;
  }
  return closed ? `${d} Z` : d;
}

/** An ellipse (or a circle, when rx = ry) as a path: two half-arcs. */
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string | null {
  if (!(rx > 0 && ry > 0)) {
    return null;
  }
  return (
    `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}` +
    ` A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  );
}

/** One shape tag (its name and its text) as a path, or null if it isn't a shape. */
function shapeToPath(name: string, tag: string): string | null {
  switch (name) {
    case 'path': {
      const d = svgAttribute(tag, 'd');
      return d && d.trim() !== '' ? d.trim() : null;
    }
    case 'line':
      return `M${svgNumber(tag, 'x1')} ${svgNumber(tag, 'y1')} L${svgNumber(tag, 'x2')} ${svgNumber(tag, 'y2')}`;
    case 'polyline':
      return pointsToPath(svgAttribute(tag, 'points') ?? '', false);
    case 'polygon':
      return pointsToPath(svgAttribute(tag, 'points') ?? '', true);
    case 'rect': {
      const x = svgNumber(tag, 'x');
      const y = svgNumber(tag, 'y');
      const w = svgNumber(tag, 'width');
      const h = svgNumber(tag, 'height');
      return w > 0 && h > 0 ? `M${x} ${y} H${x + w} V${y + h} H${x} Z` : null;
    }
    case 'circle': {
      const r = svgNumber(tag, 'r');
      return ellipseToPath(svgNumber(tag, 'cx'), svgNumber(tag, 'cy'), r, r);
    }
    case 'ellipse':
      return ellipseToPath(svgNumber(tag, 'cx'), svgNumber(tag, 'cy'), svgNumber(tag, 'rx'), svgNumber(tag, 'ry'));
    default:
      return null;
  }
}

/**
 * The art's drawing area: its viewBox if it has one, else its width and
 * height, else null (the scope then fits the shapes themselves).
 */
export function svgBox(svg: string): VectorBox | null {
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) {
    return null;
  }
  const viewBox = svgAttribute(open[0], 'viewBox');
  if (viewBox) {
    const n = svgNumberList(viewBox);
    if (n.length === 4 && n[2] > 0 && n[3] > 0) {
      return { x: n[0], y: n[1], width: n[2], height: n[3] };
    }
  }
  const width = svgNumber(open[0], 'width');
  const height = svgNumber(open[0], 'height');
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

/** Every shape in an SVG file, in the order they're drawn, as path "d" strings. */
export function svgShapes(svg: string): string[] {
  // Comments and <defs> (things defined for later use, not drawn) are skipped.
  const text = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<defs\b[\s\S]*?<\/defs>/gi, '');
  const shapes: string[] = [];
  const tags = /<(path|line|polyline|polygon|rect|circle|ellipse)\b([^>]*)>/gi;
  let match = tags.exec(text);
  while (match) {
    const d = shapeToPath(match[1].toLowerCase(), ` ${match[2]}`);
    if (d) {
      shapes.push(d);
    }
    match = tags.exec(text);
  }
  return shapes;
}

/** Read an SVG file's text into vector art. `box` is null if the file doesn't say. */
export function readVectorArt(svg: string): { box: VectorBox | null; shapes: string[] } {
  return { box: svgBox(svg), shapes: svgShapes(svg) };
}
