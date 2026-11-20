// SWIFT PARITY: does the TypeScript core give the same answers as the Swift core?
//
// The core (src/core) was ported file for file from the Swift package
// AsunderCore. This test is the proof that the port is faithful.
//
// How it works:
//   1. A small Swift program (tools/swift-golden/Sources/SwiftGolden/main.swift)
//      feeds fixed inputs to the REAL Swift code and writes every answer to
//      fixtures/swift-golden.json. Nothing in it is random and nothing reads
//      the clock, so it writes the same file every time.
//   2. This test feeds the SAME inputs to the TypeScript code and compares
//      every answer with the one in the file.
//
// There is one describe() below per section of the JSON, in the same order as
// main.swift, so the two files can be read side by side.
//
// To regenerate the JSON (after changing main.swift or the Swift core):
//     npm run golden
// To run just this test:
//     npx jest src/core/__tests__/SwiftParity.test.ts
//
// If a test here fails, the Swift code is the reference: fix the TypeScript.
// (The exception is a constant in Tuning or World that was changed on purpose.
// Change it on both sides, then run `npm run golden`.)

import type { BandDisplay } from '../index';
import {
  bandDistance,
  bandMoved,
  bandPosition,
  bellStrength,
  carrierClarity,
  carrierDetentsAway,
  carrierIsOnAir,
  carrierPitch,
  carrierStrength,
  chainRender,
  chainRestartFade,
  clockDayIndex,
  clockDayOfWeek,
  clockDayProgress,
  clockIsStill,
  clockRule,
  clockRuleForDay,
  clockSecondsIntoDay,
  clockWeeksSinceEpoch,
  createCarrierOscillator,
  createClock,
  createDialPhysics,
  createFMBandDisplay,
  createLockDetector,
  createNoiseColor,
  createNoiseRandom,
  createNoiseSource,
  createReceiverChain,
  createReceiverTargets,
  createSmoothed,
  createSpectrumDisplay,
  createStateVariableFilter,
  dialBand,
  dialDetentIndex,
  dialDetentIndexOf,
  dialDrag,
  dialGrab,
  dialIsAtRest,
  dialNeedleBand,
  dialRelease,
  dialStep,
  filterProcess,
  filterSetCutoff,
  floorDivide,
  lockUpdate,
  noiseColorBetween,
  noiseColorGains,
  noiseNext,
  noiseTemperatureAt,
  oscillatorNext,
  positiveModulo,
  randomNext,
  randomNextSigned,
  receptionBlendHz,
  receptionTargets,
  smoothedStep,
  spectrumReadout,
  spectrumShortLabel,
  Tuning,
  World,
  wrapUnit,
} from '../index';
import goldenJson from './fixtures/swift-golden.json';

// MARK: - How close is close enough?
//
// Both languages use the same kind of number (a 64-bit "double"), and both
// add, subtract, multiply, divide and take square roots with exactly the same
// rounding. So most answers must match EXACTLY, down to the last bit:
//
//   - whole numbers, true/false, and text
//   - the random generator's raw output (compared as 16 hex digits)
//   - anything made only with + - * / and square root: the noise, the noise
//     temperature mixes, wrapping, distances round the band
//
// Those use checkSame() below, which allows no error at all.
//
// The exceptions each get a named tolerance:

/// For answers that went through exp, sin, tan, pow or log10.
/// Those functions come from each language's own math library, and two
/// libraries are allowed to disagree in the very last digit (a double has
/// about 16 digits). The disagreement can then grow a little as the number is
/// used again and again (a filter running for 500 samples, a wheel coasting for
/// 1,000 frames). 1e-12 means "the first 12 digits agree", which leaves room
/// for that growth and is still far tighter than any real mistake would be.
/// This is a RELATIVE tolerance: it's measured against the size of the number.
const MATH_LIBRARY_TOLERANCE = 1e-12;

/// For the clock's "how far into the day" answers, in seconds (an ABSOLUTE
/// tolerance: one millionth of a second).
/// Swift keeps a moment in time (Date) as seconds since 1 Jan 2001. The
/// TypeScript core keeps it as seconds since 1 Jan 1970. Those are different
/// sizes of number, and a double can only hold a number of that size to a
/// fixed step: near the year 2026, about 0.12 millionths of a second counted
/// from 2001, and about 0.24 millionths counted from 1970. So the two can
/// round the same moment to slightly different places, and "seconds into the
/// day" is allowed to differ by a few of those steps (four of them), no more.
/// (Every moment in the golden file was built from 1970 seconds on the Swift
/// side too, and for those the two come out identical: the biggest difference
/// seen is 0. The allowance is there so that a moment built another way in
/// main.swift, say with Date.addingTimeInterval, doesn't fail for no reason.)
const CLOCK_SECONDS_TOLERANCE = 1e-6;

/// The same allowance for "day progress", which is seconds into the day
/// divided by the seconds in a day.
const CLOCK_DAY_PROGRESS_TOLERANCE = CLOCK_SECONDS_TOLERANCE / 86_400;

/// The same allowance for the noise temperature, which glides with the clock
/// right after a day turn. It runs 0...1 and changes by less than 1 per second,
/// so a millionth of a second can't move it by more than a millionth.
const CLOCK_TEMPERATURE_TOLERANCE = CLOCK_SECONDS_TOLERANCE;

/// For the finished audio samples (an ABSOLUTE tolerance).
/// The receiver's output is stored as 32-bit floats, which keep only about
/// 7 digits. A sample that differs in its 13th digit between the two languages
/// (see MATH_LIBRARY_TOLERANCE) usually rounds to the same float, but when it
/// sits right on the edge between two floats it can round the other way.
/// For samples between -1 and 1 neighboring floats are at most 0.00000006
/// apart (2 to the power -24), so this allows one such step and nothing more.
const CHAIN_SAMPLE_TOLERANCE = Math.pow(2, -24);

/// Five of Swift's Tuning constants are 32-bit Floats (the haptics API wants
/// them that way). In TypeScript every number is a 64-bit double, and the JSON
/// holds the Float's exact value written out as a double (0.35 became
/// 0.3499999940395355). So for these, the TypeScript value is rounded to
/// 32 bits (Math.fround) before comparing.
const SWIFT_FLOAT_CONSTANTS = [
  'tickIntensity',
  'tickSharpness',
  'tickStrengthSteps',
  'lockIntensity',
  'lockSharpness',
];

/// Set this to true to print, after the run, the biggest error seen in each
/// section. Useful when deciding whether a tolerance above is still right.
const PRINT_WORST_ERRORS = false;

// MARK: - The shape of the JSON file
// (One entry per section that main.swift writes.)

interface DisplayDump {
  samples: { position: number; frequency: number; label: string; unit: string }[];
  scaleMarks: { position: number; label: string | null }[];
}

interface ClockRow {
  seconds: number;
  dayIndex: number;
  dayOfWeek: number;
  weeksSinceEpoch: number;
  dayProgress: number;
  secondsIntoDay: number;
  rule: string;
  isStill: boolean;
  carrierOnAir: boolean;
  temperature: number;
}

interface DialRow {
  position: number;
  velocity: number;
  needle: number;
  isHeld: boolean;
  isAtRest: boolean;
  detentIndex: number;
  band: number;
  needleBand: number;
}

interface DialScenario {
  start: number;
  snap: number[];
  /// Each step is ["grab"], ["release"], ["drag", delta] or ["step", dt].
  script: (string | number)[][];
  /// The dial's whole visible state after each step.
  rows: DialRow[];
}

interface ChainRun {
  sampleRate: number;
  seed: number;
  bufferSize: number;
  buffers: number;
  startDial: number;
  dialStepPerBuffer: number;
  startSeconds: number;
  restartFadeAtBuffer: number | null;
  samples: number[];
}

interface Golden {
  tuning: Record<string, number | number[]>;
  world: Record<string, number | string[]>;
  wrapUnit: { in: number; out: number }[];
  integerHelpers: { a: number; n: number; positiveModulo: number; floorDivide: number }[];
  bandDistance: { from: number; to: number; fromWrapped: number; distance: number; moved: number }[];
  bellStrength: { distance: number; width: number; out: number }[];
  spectrumDisplay: DisplayDump;
  fmBandDisplay: DisplayDump;
  readout: { hz: number; number: string; unit: string; short: string }[];
  spectrumPositionOfHz: { hz: number; position: number }[];
  spectrumDecades: number;
  clockDefault: ClockRow[];
  clockTurnAtFive: ClockRow[];
  ruleTable: { k: number; w: number; rule: string }[];
  dial: Record<string, DialScenario>;
  detentIndexOf: { position: number; index: number }[];
  lockDetector: { distances: number[]; fired: boolean[]; isLocked: boolean[] }[];
  noiseRandom: { seed: number; next: string[]; nextSigned: number[] }[];
  noiseSource: { seed: number; white: number[]; pink: number[]; brown: number[] }[];
  noiseColorGains: { color: number[]; gains: number[] }[];
  noiseColorBetween: { t: number; color: number[] }[];
  filter: {
    hz: number;
    resonance: number;
    sampleRate: number;
    low: number[];
    band: number[];
    high: number[];
  }[];
  filterDefault: number[];
  filterSwept: number[];
  smoothed: {
    start: number;
    seconds: number;
    sampleRate: number;
    target: number;
    values: number[];
  }[];
  carrierDetentsAway: { dial: number; detents: number }[];
  carrierCurves: { detents: number; strength: number; clarity: number; pitch: number }[];
  carrierOscillator: { pitch: number; sampleRate: number; samples: number[] }[];
  carrierOscillatorSweep: number[];
  reception: {
    dial: number;
    seconds: number;
    white: number;
    pink: number;
    brown: number;
    carrierLevel: number;
    carrierPitch: number;
    highpassHz: number;
    lowpassHz: number;
  }[];
  blendHz: { a: number; b: number; t: number; out: number }[];
  chain: ChainRun[];
}

/// The Swift answers. (Giving it the type Golden also makes the type checker
/// confirm that the file really has every section in the shape written above.)
const golden: Golden = goldenJson;

// MARK: - Comparing
//
// A test here compares thousands of numbers. Rather than stopping at the
// first wrong one, each test keeps a Tally: a list of what went wrong (in
// words, saying which value it was) and the biggest error it saw. At the end
// finish() fails the test if the list isn't empty.

interface Tally {
  section: string;
  /// How many values have been compared.
  compared: number;
  /// What went wrong, one line each. Only the first few are kept.
  problems: string[];
  /// How many things went wrong in all.
  problemCount: number;
  /// The biggest error seen, and the tolerance it was held to.
  /// "Relative" is measured against the size of the number; "absolute" isn't.
  worstRelative: number;
  allowedRelative: number;
  worstAbsolute: number;
  allowedAbsolute: number;
}

/// The worst errors of every section, gathered for the printout at the end.
const report = new Map<string, Tally>();

const PROBLEMS_TO_SHOW = 12;

function startTally(section: string): Tally {
  return {
    section: section,
    compared: 0,
    problems: [],
    problemCount: 0,
    worstRelative: 0,
    allowedRelative: 0,
    worstAbsolute: 0,
    allowedAbsolute: 0,
  };
}

function addProblem(tally: Tally, line: string): void {
  tally.problemCount += 1;
  if (tally.problems.length < PROBLEMS_TO_SHOW) {
    tally.problems.push(line);
  }
}

/// Must match exactly: whole numbers, true/false, text, and numbers made only
/// by arithmetic. (JavaScript's 0 and -0 count as the same number here.)
function checkSame(tally: Tally, what: string, actual: unknown, expected: unknown): void {
  tally.compared += 1;
  if (actual !== expected) {
    addProblem(tally, `${what}: TypeScript gave ${String(actual)}, Swift gave ${String(expected)}`);
  }
}

/// Must match within a RELATIVE tolerance: the difference, divided by the
/// size of the number. 1e-12 means the first 12 digits agree.
function checkClose(
  tally: Tally,
  what: string,
  actual: number,
  expected: number,
  tolerance: number,
): void {
  tally.compared += 1;
  tally.allowedRelative = Math.max(tally.allowedRelative, tolerance);
  if (actual === expected) {
    return;
  }
  const size = Math.max(Math.abs(actual), Math.abs(expected));
  const error = Math.abs(actual - expected) / size;
  // (Written as "not within" so that a NaN, which is never within anything, fails.)
  if (!(error <= tolerance)) {
    addProblem(
      tally,
      `${what}: TypeScript gave ${actual}, Swift gave ${expected} (relative error ${error}, allowed ${tolerance})`,
    );
  }
  if (error > tally.worstRelative) {
    tally.worstRelative = error;
  }
}

/// Must match within an ABSOLUTE tolerance: the plain difference.
function checkWithin(
  tally: Tally,
  what: string,
  actual: number,
  expected: number,
  tolerance: number,
): void {
  tally.compared += 1;
  tally.allowedAbsolute = Math.max(tally.allowedAbsolute, tolerance);
  if (actual === expected) {
    return;
  }
  const error = Math.abs(actual - expected);
  if (!(error <= tolerance)) {
    addProblem(
      tally,
      `${what}: TypeScript gave ${actual}, Swift gave ${expected} (difference ${error}, allowed ${tolerance})`,
    );
  }
  if (error > tally.worstAbsolute) {
    tally.worstAbsolute = error;
  }
}

/// A whole list that must match exactly, value by value.
function checkSameList(
  tally: Tally,
  what: string,
  actual: ArrayLike<unknown>,
  expected: ArrayLike<unknown>,
): void {
  checkSame(tally, `${what}: how many values`, actual.length, expected.length);
  const count = Math.min(actual.length, expected.length);
  for (let i = 0; i < count; i += 1) {
    checkSame(tally, `${what}[${i}]`, actual[i], expected[i]);
  }
}

/// A signal (a list of samples) that must match within a relative tolerance.
/// A signal swings through zero, and next to zero even a harmless difference
/// looks huge when it's divided by the sample's own size. So each difference
/// is measured against the LOUDEST sample of the signal instead.
function checkSignal(
  tally: Tally,
  what: string,
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  tolerance: number,
): void {
  checkSame(tally, `${what}: how many samples`, actual.length, expected.length);
  tally.allowedRelative = Math.max(tally.allowedRelative, tolerance);
  let loudest = 0;
  for (let i = 0; i < expected.length; i += 1) {
    loudest = Math.max(loudest, Math.abs(expected[i]));
  }
  const count = Math.min(actual.length, expected.length);
  for (let i = 0; i < count; i += 1) {
    tally.compared += 1;
    if (actual[i] === expected[i]) {
      continue;
    }
    const error = Math.abs(actual[i] - expected[i]) / loudest;
    if (!(error <= tolerance)) {
      addProblem(
        tally,
        `${what}[${i}]: TypeScript gave ${actual[i]}, Swift gave ${expected[i]} ` +
          `(error ${error} of the loudest sample, allowed ${tolerance})`,
      );
    }
    if (error > tally.worstRelative) {
      tally.worstRelative = error;
    }
  }
}

/// A signal that must match within an absolute tolerance, sample by sample.
function checkSignalWithin(
  tally: Tally,
  what: string,
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  tolerance: number,
): void {
  checkSame(tally, `${what}: how many samples`, actual.length, expected.length);
  const count = Math.min(actual.length, expected.length);
  for (let i = 0; i < count; i += 1) {
    checkWithin(tally, `${what}[${i}]`, actual[i], expected[i], tolerance);
  }
}

/// Call at the end of every test: fails it if anything went wrong, and
/// remembers the worst errors for the printout.
function finish(tally: Tally): void {
  const soFar = report.get(tally.section);
  if (soFar === undefined) {
    report.set(tally.section, tally);
  } else {
    soFar.compared += tally.compared;
    soFar.worstRelative = Math.max(soFar.worstRelative, tally.worstRelative);
    soFar.allowedRelative = Math.max(soFar.allowedRelative, tally.allowedRelative);
    soFar.worstAbsolute = Math.max(soFar.worstAbsolute, tally.worstAbsolute);
    soFar.allowedAbsolute = Math.max(soFar.allowedAbsolute, tally.allowedAbsolute);
  }

  const problems = tally.problems.slice();
  if (tally.problemCount > problems.length) {
    problems.push(`... and ${tally.problemCount - problems.length} more`);
  }
  expect(problems).toEqual([]);
}

afterAll(() => {
  if (!PRINT_WORST_ERRORS) {
    return;
  }
  const lines = ['SwiftParity: the biggest error seen in each section'];
  for (const tally of report.values()) {
    let line = `  ${tally.section.padEnd(24)} ${String(tally.compared).padStart(6)} values`;
    if (tally.allowedRelative === 0 && tally.allowedAbsolute === 0) {
      line += '   all exact';
    }
    if (tally.allowedRelative > 0) {
      line += `   relative ${tally.worstRelative.toExponential(2)} (allowed ${tally.allowedRelative})`;
    }
    if (tally.allowedAbsolute > 0) {
      line += `   absolute ${tally.worstAbsolute.toExponential(2)} (allowed ${tally.allowedAbsolute.toExponential(2)})`;
    }
    lines.push(line);
  }
  console.log(lines.join('\n'));
});

// MARK: - Helpers that mirror main.swift

/// A 64-bit number, held as two 32-bit halves, written as 16 hex digits.
/// (The same text main.swift's hex() writes.)
function hex(hi: number, lo: number): string {
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

/// main.swift's deterministic "wiggle": different every index, no randomness.
/// (It uses sin, so even this INPUT can differ from Swift's in the last digit.
/// That's why everything fed by it is compared with MATH_LIBRARY_TOLERANCE.)
function wiggle(i: number): number {
  return Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 78.233) * 0.5;
}

// MARK: - Every section is covered

/// The sections of the JSON, in main.swift's order. Each has a describe() below.
const SECTIONS = [
  'tuning',
  'world',
  'wrapUnit',
  'integerHelpers',
  'bandDistance',
  'bellStrength',
  'spectrumDisplay',
  'fmBandDisplay',
  'readout',
  'spectrumPositionOfHz',
  'spectrumDecades',
  'clockDefault',
  'clockTurnAtFive',
  'ruleTable',
  'dial',
  'detentIndexOf',
  'lockDetector',
  'noiseRandom',
  'noiseSource',
  'noiseColorGains',
  'noiseColorBetween',
  'filter',
  'filterDefault',
  'filterSwept',
  'smoothed',
  'carrierDetentsAway',
  'carrierCurves',
  'carrierOscillator',
  'carrierOscillatorSweep',
  'reception',
  'blendHz',
  'chain',
];

describe('the golden file', () => {
  // If main.swift gains a section, this fails until a describe() is written for it.
  it('has exactly the sections this test checks', () => {
    expect(Object.keys(golden).sort()).toEqual(SECTIONS.slice().sort());
  });
});

// MARK: - Tuning and World
// One test per constant, so a constant changed on only one side fails with its name.

/// A TypeScript constant, turned into the form main.swift wrote it in.
function asSwiftWroteIt(name: string, value: unknown): unknown {
  // Swift wrote a noise temperature as a list: [white, pink, brown, level].
  if (name === 'hotStatic' || name === 'coldStatic') {
    const color = value as { white: number; pink: number; brown: number; level: number };
    return [color.white, color.pink, color.brown, color.level];
  }
  // Swift holds these as 32-bit Floats (see SWIFT_FLOAT_CONSTANTS above).
  if (SWIFT_FLOAT_CONSTANTS.includes(name)) {
    if (Array.isArray(value)) {
      return value.map((item: number) => Math.fround(item));
    }
    return typeof value === 'number' ? Math.fround(value) : value;
  }
  return value;
}

describe('tuning', () => {
  const ours: Record<string, unknown> = Tuning;

  it.each(Object.keys(golden.tuning))('Tuning.%s is the same in Swift and TypeScript', (name) => {
    expect(asSwiftWroteIt(name, ours[name])).toEqual(golden.tuning[name]);
  });

  // The other direction: a constant added to Tuning.ts but not to Swift.
  // (If this fails, add the constant to Tuning.swift and to main.swift's
  // "tuning" list, then run `npm run golden`.)
  it('has no constant that the Swift side lacks', () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(golden.tuning).sort());
  });
});

describe('world', () => {
  const ours: Record<string, unknown> = World;

  it.each(Object.keys(golden.world))('World.%s is the same in Swift and TypeScript', (name) => {
    expect(ours[name]).toEqual(golden.world[name]);
  });

  it('has no constant that the Swift side lacks', () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(golden.world).sort());
  });
});

// MARK: - Wrap and band

describe('wrapUnit', () => {
  it('folds every input onto the loop exactly as Swift does', () => {
    const tally = startTally('wrapUnit');
    for (const row of golden.wrapUnit) {
      checkSame(tally, `wrapUnit(${row.in})`, wrapUnit(row.in), row.out);
    }
    finish(tally);
  });
});

describe('integerHelpers', () => {
  it('positiveModulo and floorDivide match, including below zero', () => {
    const tally = startTally('integerHelpers');
    for (const row of golden.integerHelpers) {
      const call = `(${row.a}, ${row.n})`;
      checkSame(tally, `positiveModulo${call}`, positiveModulo(row.a, row.n), row.positiveModulo);
      checkSame(tally, `floorDivide${call}`, floorDivide(row.a, row.n), row.floorDivide);
    }
    finish(tally);
  });
});

describe('bandDistance', () => {
  it('wraps, measures and moves round the loop exactly as Swift does', () => {
    const tally = startTally('bandDistance');
    for (const row of golden.bandDistance) {
      const from = bandPosition(row.from);
      const to = bandPosition(row.to);
      checkSame(tally, `bandPosition(${row.from})`, from, row.fromWrapped);
      checkSame(tally, `bandDistance(${row.from}, ${row.to})`, bandDistance(from, to), row.distance);
      checkSame(tally, `bandMoved(${row.from}, ${row.to})`, bandMoved(from, row.to), row.moved);
    }
    finish(tally);
  });
});

describe('bellStrength', () => {
  it('draws the same bell curve (uses exp)', () => {
    const tally = startTally('bellStrength');
    for (const row of golden.bellStrength) {
      checkClose(
        tally,
        `bellStrength(${row.distance}, ${row.width})`,
        bellStrength(row.distance, row.width),
        row.out,
        MATH_LIBRARY_TOLERANCE,
      );
    }
    finish(tally);
  });
});

// MARK: - Displays

/// Mirrors main.swift's displayDump: the readout at every sampled position,
/// and the marks printed on the scale.
/// `tolerance` is for the numbers; 0 means they must match exactly.
/// The labels are text, so they must always match exactly.
function checkDisplay(
  tally: Tally,
  display: BandDisplay,
  expected: DisplayDump,
  tolerance: number,
): void {
  for (const sample of expected.samples) {
    const position = bandPosition(sample.position);
    const at = `at position ${sample.position}`;
    if (tolerance === 0) {
      checkSame(tally, `frequency ${at}`, display.frequencyAt(position), sample.frequency);
    } else {
      checkClose(tally, `frequency ${at}`, display.frequencyAt(position), sample.frequency, tolerance);
    }
    checkSame(tally, `label ${at}`, display.labelAt(position), sample.label);
    checkSame(tally, `unit ${at}`, display.unitAt(position), sample.unit);
  }

  const marks = display.scaleMarks();
  checkSame(tally, 'how many scale marks', marks.length, expected.scaleMarks.length);
  const count = Math.min(marks.length, expected.scaleMarks.length);
  for (let i = 0; i < count; i += 1) {
    const want = expected.scaleMarks[i];
    if (tolerance === 0) {
      checkSame(tally, `scale mark ${i} position`, marks[i].position, want.position);
    } else {
      checkClose(tally, `scale mark ${i} position`, marks[i].position, want.position, tolerance);
    }
    checkSame(tally, `scale mark ${i} label`, marks[i].label, want.label);
  }
}

describe('spectrumDisplay', () => {
  it('reads the same frequency, label and unit all the way round (uses pow and log10)', () => {
    const tally = startTally('spectrumDisplay');
    checkDisplay(tally, createSpectrumDisplay(), golden.spectrumDisplay, MATH_LIBRARY_TOLERANCE);
    finish(tally);
  });
});

describe('fmBandDisplay', () => {
  it('reads the same frequency, label and unit all the way round (arithmetic only: exact)', () => {
    const tally = startTally('fmBandDisplay');
    checkDisplay(tally, createFMBandDisplay(), golden.fmBandDisplay, 0);
    finish(tally);
  });
});

describe('readout', () => {
  it('writes every frequency as the same text, including the rounding carries', () => {
    const tally = startTally('readout');
    for (const row of golden.readout) {
      const readout = spectrumReadout(row.hz);
      checkSame(tally, `spectrumReadout(${row.hz}).number`, readout.number, row.number);
      checkSame(tally, `spectrumReadout(${row.hz}).unit`, readout.unit, row.unit);
      checkSame(tally, `spectrumShortLabel(${row.hz})`, spectrumShortLabel(row.hz), row.short);
    }
    finish(tally);
  });
});

describe('spectrumPositionOfHz', () => {
  it('finds the same place on the band for a frequency (uses log10)', () => {
    const tally = startTally('spectrumPositionOfHz');
    const spectrum = createSpectrumDisplay();
    for (const row of golden.spectrumPositionOfHz) {
      checkClose(
        tally,
        `positionOfHz(${row.hz})`,
        spectrum.positionOfHz(row.hz),
        row.position,
        MATH_LIBRARY_TOLERANCE,
      );
    }
    finish(tally);
  });
});

describe('spectrumDecades', () => {
  it('counts the same number of tenfold stretches (uses log10)', () => {
    const tally = startTally('spectrumDecades');
    checkClose(
      tally,
      'decades()',
      createSpectrumDisplay().decades(),
      golden.spectrumDecades,
      MATH_LIBRARY_TOLERANCE,
    );
    finish(tally);
  });
});

// MARK: - Clock

/// Mirrors main.swift's clockDump: everything the clock says about each moment.
function checkClock(
  tally: Tally,
  clock: ReturnType<typeof createClock>,
  expected: ClockRow[],
): void {
  for (const row of expected) {
    const now = row.seconds;
    const at = `at ${now}`;
    // Whole numbers, text and true/false: exact.
    checkSame(tally, `dayIndex ${at}`, clockDayIndex(clock, now), row.dayIndex);
    checkSame(tally, `dayOfWeek ${at}`, clockDayOfWeek(clock, now), row.dayOfWeek);
    checkSame(tally, `weeksSinceEpoch ${at}`, clockWeeksSinceEpoch(clock, now), row.weeksSinceEpoch);
    checkSame(tally, `rule ${at}`, clockRule(clock, now), row.rule);
    checkSame(tally, `isStill ${at}`, clockIsStill(clock, now), row.isStill);
    checkSame(tally, `carrierOnAir ${at}`, carrierIsOnAir(now, clock), row.carrierOnAir);
    // How far into the day: see CLOCK_SECONDS_TOLERANCE for why these get an allowance.
    checkWithin(
      tally,
      `dayProgress ${at}`,
      clockDayProgress(clock, now),
      row.dayProgress,
      CLOCK_DAY_PROGRESS_TOLERANCE,
    );
    checkWithin(
      tally,
      `secondsIntoDay ${at}`,
      clockSecondsIntoDay(clock, now),
      row.secondsIntoDay,
      CLOCK_SECONDS_TOLERANCE,
    );
    checkWithin(
      tally,
      `temperature ${at}`,
      noiseTemperatureAt(now, clock),
      row.temperature,
      CLOCK_TEMPERATURE_TOLERANCE,
    );
  }
}

describe('clockDefault', () => {
  it('tells the same day, rule, dropout and temperature at every moment', () => {
    const tally = startTally('clockDefault');
    checkClock(tally, createClock(), golden.clockDefault);
    finish(tally);
  });
});

describe('clockTurnAtFive', () => {
  it('does the same when the day turns at 05:00 UTC', () => {
    const tally = startTally('clockTurnAtFive');
    checkClock(tally, createClock(World.epoch, 5), golden.clockTurnAtFive);
    finish(tally);
  });
});

describe('ruleTable', () => {
  it('gives the same rule for every day of every week, before and after the epoch', () => {
    const tally = startTally('ruleTable');
    for (const row of golden.ruleTable) {
      checkSame(tally, `rule for day ${row.k} of week ${row.w}`, clockRuleForDay(row.k, row.w), row.rule);
    }
    finish(tally);
  });
});

// MARK: - Dial physics

describe('dial', () => {
  // Each scenario is a script of finger and time steps. The whole visible
  // state of the wheel is compared after every single step.
  it.each(Object.keys(golden.dial))('%s: the wheel moves the same, step for step', (name) => {
    const scenario = golden.dial[name];
    const tally = startTally('dial');

    const dial = createDialPhysics(scenario.start);
    dial.snapPoints = scenario.snap.map((place) => bandPosition(place));

    scenario.script.forEach((step, i) => {
      const kind = step[0];
      const amount = Number(step[1]); // the delta for a drag, the dt for a step
      if (kind === 'grab') {
        dialGrab(dial);
      } else if (kind === 'release') {
        dialRelease(dial);
      } else if (kind === 'drag') {
        dialDrag(dial, amount);
      } else if (kind === 'step') {
        dialStep(dial, amount);
      } else {
        throw new Error(`unknown step "${String(kind)}" in the script`);
      }

      const row = scenario.rows[i];
      const after = `after step ${i} (${step.join(' ')})`;
      // The motion uses exp (friction, easing), so the numbers get the math tolerance.
      checkClose(tally, `position ${after}`, dial.position, row.position, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `velocity ${after}`, dial.velocity, row.velocity, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `needle ${after}`, dial.needle, row.needle, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `band ${after}`, dialBand(dial), row.band, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `needleBand ${after}`, dialNeedleBand(dial), row.needleBand, MATH_LIBRARY_TOLERANCE);
      // Which notch, and the true/false states: exact.
      checkSame(tally, `isHeld ${after}`, dial.isHeld, row.isHeld);
      checkSame(tally, `isAtRest ${after}`, dialIsAtRest(dial), row.isAtRest);
      checkSame(tally, `detentIndex ${after}`, dialDetentIndex(dial), row.detentIndex);
    });
    checkSame(tally, 'how many steps', scenario.script.length, scenario.rows.length);
    finish(tally);
  });
});

describe('detentIndexOf', () => {
  it('picks the same notch, including exactly halfway and below zero', () => {
    const tally = startTally('detentIndexOf');
    for (const row of golden.detentIndexOf) {
      checkSame(tally, `dialDetentIndexOf(${row.position})`, dialDetentIndexOf(row.position), row.index);
    }
    finish(tally);
  });
});

// MARK: - Lock detector

describe('lockDetector', () => {
  it('fires and lets go on the same frames', () => {
    const tally = startTally('lockDetector');
    golden.lockDetector.forEach((run, r) => {
      const lock = createLockDetector();
      run.distances.forEach((distance, i) => {
        const fired = lockUpdate(lock, distance);
        checkSame(tally, `run ${r} frame ${i} (distance ${distance}) fired`, fired, run.fired[i]);
        checkSame(tally, `run ${r} frame ${i} (distance ${distance}) isLocked`, lock.isLocked, run.isLocked[i]);
      });
    });
    finish(tally);
  });
});

// MARK: - Noise

describe('noiseRandom', () => {
  it('makes the same random numbers, bit for bit', () => {
    const tally = startTally('noiseRandom');
    for (const run of golden.noiseRandom) {
      // Two generators from the same seed, as in main.swift: one read raw,
      // one read as numbers between -1 and 1.
      const raw = createNoiseRandom(run.seed);
      const signed = createNoiseRandom(run.seed);
      for (let i = 0; i < run.next.length; i += 1) {
        randomNext(raw);
        checkSame(tally, `seed ${run.seed} next ${i}`, hex(raw.outHi, raw.outLo), run.next[i]);
      }
      for (let i = 0; i < run.nextSigned.length; i += 1) {
        checkSame(tally, `seed ${run.seed} nextSigned ${i}`, randomNextSigned(signed), run.nextSigned[i]);
      }
    }
    finish(tally);
  });
});

describe('noiseSource', () => {
  it('makes the same white, pink and brown noise, exactly (arithmetic only)', () => {
    const tally = startTally('noiseSource');
    for (const run of golden.noiseSource) {
      const source = createNoiseSource(run.seed);
      const white: number[] = [];
      const pink: number[] = [];
      const brown: number[] = [];
      for (let i = 0; i < run.white.length; i += 1) {
        noiseNext(source);
        white.push(source.white);
        pink.push(source.pink);
        brown.push(source.brown);
      }
      checkSameList(tally, `seed ${run.seed} white`, white, run.white);
      checkSameList(tally, `seed ${run.seed} pink`, pink, run.pink);
      checkSameList(tally, `seed ${run.seed} brown`, brown, run.brown);
    }
    finish(tally);
  });
});

describe('noiseColorGains', () => {
  it('turns a temperature into the same three loudnesses, exactly', () => {
    const tally = startTally('noiseColorGains');
    for (const row of golden.noiseColorGains) {
      const color = createNoiseColor(row.color[0], row.color[1], row.color[2], row.color[3]);
      const gains = { white: 0, pink: 0, brown: 0 };
      noiseColorGains(color, gains);
      checkSameList(tally, `gains of [${row.color.join(', ')}]`, [gains.white, gains.pink, gains.brown], row.gains);
    }
    finish(tally);
  });
});

describe('noiseColorBetween', () => {
  it('blends cold and hot static the same way, exactly', () => {
    const tally = startTally('noiseColorBetween');
    for (const row of golden.noiseColorBetween) {
      const color = createNoiseColor(0, 0, 0, 0);
      noiseColorBetween(color, Tuning.coldStatic, Tuning.hotStatic, row.t);
      checkSameList(
        tally,
        `cold to hot at t = ${row.t}`,
        [color.white, color.pink, color.brown, color.level],
        row.color,
      );
    }
    finish(tally);
  });
});

// MARK: - Filters
// The filter itself is only arithmetic, but its coefficients come from tan and
// its test input (wiggle) comes from sin. So these get the math tolerance.

describe('filter', () => {
  it.each(golden.filter.map((run, i) => [`${run.hz} Hz, Q ${run.resonance}, at ${run.sampleRate} Hz`, i]))(
    '%s: low, band and high outputs match',
    (_title, i) => {
      const run = golden.filter[Number(i)];
      const tally = startTally('filter');
      const filter = createStateVariableFilter();
      filterSetCutoff(filter, run.hz, run.resonance, run.sampleRate);
      const low: number[] = [];
      const band: number[] = [];
      const high: number[] = [];
      for (let n = 0; n < run.low.length; n += 1) {
        // A single click first, then the wiggle.
        filterProcess(filter, n === 0 ? 1.0 : wiggle(n));
        low.push(filter.low);
        band.push(filter.band);
        high.push(filter.high);
      }
      checkSignal(tally, 'low', low, run.low, MATH_LIBRARY_TOLERANCE);
      checkSignal(tally, 'band', band, run.band, MATH_LIBRARY_TOLERANCE);
      checkSignal(tally, 'high', high, run.high, MATH_LIBRARY_TOLERANCE);
      finish(tally);
    },
  );
});

describe('filterDefault', () => {
  it('a filter that was never told a cutoff behaves the same', () => {
    const tally = startTally('filterDefault');
    const filter = createStateVariableFilter();
    const low: number[] = [];
    for (let n = 0; n < golden.filterDefault.length; n += 1) {
      filterProcess(filter, wiggle(n));
      low.push(filter.low);
    }
    checkSignal(tally, 'low', low, golden.filterDefault, MATH_LIBRARY_TOLERANCE);
    finish(tally);
  });
});

describe('filterSwept', () => {
  it('a filter swept while it runs behaves the same', () => {
    const tally = startTally('filterSwept');
    const filter = createStateVariableFilter();
    const high: number[] = [];
    for (let n = 0; n < golden.filterSwept.length; n += 1) {
      if (n % 16 === 0) {
        filterSetCutoff(filter, 200 + n * 20, 0.8, 48_000);
      }
      filterProcess(filter, wiggle(n));
      high.push(filter.high);
    }
    checkSignal(tally, 'high', high, golden.filterSwept, MATH_LIBRARY_TOLERANCE);
    finish(tally);
  });
});

describe('smoothed', () => {
  it('glides toward its target the same way (its speed comes from exp)', () => {
    const tally = startTally('smoothed');
    for (const run of golden.smoothed) {
      const smoothed = createSmoothed(run.start, run.seconds, run.sampleRate);
      const values: number[] = [];
      for (let n = 0; n < run.values.length; n += 1) {
        values.push(smoothedStep(smoothed, run.target));
      }
      checkSignal(
        tally,
        `from ${run.start} toward ${run.target} over ${run.seconds} s`,
        values,
        run.values,
        MATH_LIBRARY_TOLERANCE,
      );
    }
    finish(tally);
  });
});

// MARK: - Carrier

describe('carrierDetentsAway', () => {
  it('measures the same distance to the Carrier, exactly (arithmetic only)', () => {
    const tally = startTally('carrierDetentsAway');
    for (const row of golden.carrierDetentsAway) {
      checkSame(
        tally,
        `carrierDetentsAway(${row.dial})`,
        carrierDetentsAway(bandPosition(row.dial)),
        row.detents,
      );
    }
    finish(tally);
  });
});

describe('carrierCurves', () => {
  it('has the same strength, clarity and pitch at every distance', () => {
    const tally = startTally('carrierCurves');
    for (const row of golden.carrierCurves) {
      const at = `at ${row.detents} detents`;
      // Strength and clarity are bell curves (exp). Pitch is arithmetic: exact.
      checkClose(tally, `strength ${at}`, carrierStrength(row.detents), row.strength, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `clarity ${at}`, carrierClarity(row.detents), row.clarity, MATH_LIBRARY_TOLERANCE);
      checkSame(tally, `pitch ${at}`, carrierPitch(row.detents), row.pitch);
    }
    finish(tally);
  });
});

describe('carrierOscillator', () => {
  it('plays the same wave at every test pitch (uses sin)', () => {
    const tally = startTally('carrierOscillator');
    for (const run of golden.carrierOscillator) {
      const oscillator = createCarrierOscillator();
      const samples: number[] = [];
      for (let n = 0; n < run.samples.length; n += 1) {
        samples.push(oscillatorNext(oscillator, run.pitch, run.sampleRate));
      }
      checkSignal(tally, `${run.pitch} Hz at ${run.sampleRate} Hz`, samples, run.samples, MATH_LIBRARY_TOLERANCE);
    }
    finish(tally);
  });
});

describe('carrierOscillatorSweep', () => {
  it('plays the same wave while the pitch slides every sample (uses sin)', () => {
    const tally = startTally('carrierOscillatorSweep');
    const oscillator = createCarrierOscillator();
    const samples: number[] = [];
    for (let n = 0; n < golden.carrierOscillatorSweep.length; n += 1) {
      samples.push(oscillatorNext(oscillator, 165 + n * 37.5, 48_000));
    }
    checkSignal(tally, 'sweep', samples, golden.carrierOscillatorSweep, MATH_LIBRARY_TOLERANCE);
    finish(tally);
  });
});

// MARK: - Reception

describe('reception', () => {
  it('aims the sound at the same targets for every dial place and moment (uses exp and pow)', () => {
    const tally = startTally('reception');
    const clock = createClock();
    const targets = createReceiverTargets(); // one, reused, as the app does
    for (const row of golden.reception) {
      receptionTargets(targets, row.dial, row.seconds, clock);
      const at = `with the dial at ${row.dial} at time ${row.seconds}`;
      checkClose(tally, `white ${at}`, targets.white, row.white, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `pink ${at}`, targets.pink, row.pink, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `brown ${at}`, targets.brown, row.brown, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `carrierLevel ${at}`, targets.carrierLevel, row.carrierLevel, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `carrierPitch ${at}`, targets.carrierPitch, row.carrierPitch, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `highpassHz ${at}`, targets.highpassHz, row.highpassHz, MATH_LIBRARY_TOLERANCE);
      checkClose(tally, `lowpassHz ${at}`, targets.lowpassHz, row.lowpassHz, MATH_LIBRARY_TOLERANCE);
    }
    finish(tally);
  });
});

describe('blendHz', () => {
  it('blends two frequencies by octaves the same way (uses pow)', () => {
    const tally = startTally('blendHz');
    for (const row of golden.blendHz) {
      checkClose(
        tally,
        `receptionBlendHz(${row.a}, ${row.b}, ${row.t})`,
        receptionBlendHz(row.a, row.b, row.t),
        row.out,
        MATH_LIBRARY_TOLERANCE,
      );
    }
    finish(tally);
  });
});

// MARK: - The whole chain
// The finished sound, rendered the way the app does it: new targets each
// buffer, then render that buffer. Every sample is compared.

describe('chain', () => {
  const titles = [
    'sitting dead on the Carrier on a moving day',
    'tuning through the Carrier from 12 notches below to 12 above',
    'a Still day at 44.1 kHz with an odd buffer size and a fade restart',
    'across a day turn: the dropout and the start of the temperature glide',
  ];

  it.each(golden.chain.map((_run, i) => [titles[i] ?? `run ${i}`, i]))(
    '%s: every sample matches',
    (_title, i) => {
      const run = golden.chain[Number(i)];
      const tally = startTally('chain');
      const clock = createClock();
      const chain = createReceiverChain(run.sampleRate, run.seed);
      const targets = createReceiverTargets();
      const samples = new Float32Array(run.buffers * run.bufferSize);
      const buffer = new Float32Array(run.bufferSize);

      for (let b = 0; b < run.buffers; b += 1) {
        if (b === run.restartFadeAtBuffer) {
          chainRestartFade(chain);
        }
        const dial = run.startDial + b * run.dialStepPerBuffer;
        const seconds = run.startSeconds + (b * run.bufferSize) / run.sampleRate;
        receptionTargets(targets, dial, seconds, clock);
        chainRender(chain, buffer, run.bufferSize, targets);
        samples.set(buffer, b * run.bufferSize);
      }

      checkSignalWithin(tally, 'sample', samples, run.samples, CHAIN_SAMPLE_TOLERANCE);
      finish(tally);
    },
  );
});
