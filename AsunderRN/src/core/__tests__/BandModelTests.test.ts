import {
  Tuning,
  bandDistance,
  bandMoved,
  bandPosition,
  bellStrength,
  createFMBandDisplay,
  currentBandDisplay,
} from '../index';
import type { BandDisplay, SpectrumDisplay } from '../index';

// Ported from AsunderCore/Tests/AsunderCoreTests/BandModelTests.swift.
// One test here for each Swift test, with the same name, inputs and answers.

/// Swift's XCTAssertEqual(a, b, accuracy: e): the two numbers may differ by at most e.
function expectClose(actual: number, expected: number, accuracy: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(accuracy);
}

/// Swift's stride(from:to:by:) for decimal numbers: start, start + step,
/// start + 2 × step ... stopping before `end`. Like Swift, each value is worked
/// out as start + (count × step), not by adding the step over and over, so the
/// values are exactly the ones the Swift test used.
function stride(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let i = 0; start + i * step < end; i += 1) {
    values.push(start + i * step);
  }
  return values;
}

/// Swift asked `currentBandDisplay is SpectrumDisplay`. The port has no classes
/// to ask that of, so this checks the display has the parts only the wide band
/// has (its two ends in Hz, its decades, and frequency-to-position).
function isSpectrumDisplay(display: BandDisplay): display is SpectrumDisplay {
  return (
    'bottomHz' in display && 'topHz' in display && 'decades' in display && 'positionOfHz' in display
  );
}

describe('BandModelTests', () => {
  // MARK: Positions wrap

  test('testPositionsFoldOntoTheLoop', () => {
    expectClose(bandPosition(1.2), 0.2, 1e-12);
    expectClose(bandPosition(-0.25), 0.75, 1e-12);
  });

  test('testMovingPastTheTopComesBackAtTheBottom', () => {
    expectClose(bandMoved(bandPosition(0.9), 0.3), 0.2, 1e-12);
    expectClose(bandMoved(bandPosition(0.1), -0.3), 0.8, 1e-12);
  });

  // MARK: Distance takes the short way round

  test('testDistanceInsideTheBand', () => {
    expectClose(bandDistance(bandPosition(0.2), bandPosition(0.3)), 0.1, 1e-12);
    expectClose(bandDistance(bandPosition(0.3), bandPosition(0.2)), -0.1, 1e-12);
  });

  test('testDistanceAcrossTheSeam', () => {
    expectClose(bandDistance(bandPosition(0.95), bandPosition(0.05)), 0.1, 1e-12);
    expectClose(bandDistance(bandPosition(0.05), bandPosition(0.95)), -0.1, 1e-12);
  });

  test('testDistanceIsNeverMoreThanHalfTheBand', () => {
    for (const a of stride(0.0, 1.0, 0.07)) {
      for (const b of stride(0.0, 1.0, 0.05)) {
        const d = bandDistance(bandPosition(a), bandPosition(b));
        expect(d >= -0.5 && d < 0.5).toBe(true);
      }
    }
  });

  // MARK: Bell curve

  test('testBellStrength', () => {
    expectClose(bellStrength(0, 0.01), 1, 1e-12);
    expectClose(bellStrength(0.01, 0.01), Math.exp(-0.5), 1e-12);
    // same strength either side
    expectClose(bellStrength(-0.01, 0.01), Math.exp(-0.5), 1e-12);
    expect(bellStrength(0.04, 0.01)).toBeLessThan(0.001);
  });

  // MARK: Display (placeholder FM band)

  test('testFMDisplayEnds', () => {
    const fm = createFMBandDisplay();
    expect(fm.labelAt(bandPosition(0))).toBe('87.5');
    expect(fm.labelAt(bandPosition(0.5))).toBe('97.8'); // 97.75 rounds up
    expect(fm.labelAt(bandPosition(0.9999))).toBe('108.0');
    // the top loops to the bottom
    expect(fm.labelAt(bandPosition(1.0))).toBe('87.5');
  });

  test('testFMScaleMarks', () => {
    const marks = createFMBandDisplay().scaleMarks();
    expect(marks.length).toBe(20); // 88 ... 107
    const labels = marks.map((mark) => mark.label).filter((label) => label !== null);
    expect(labels).toEqual(['88', '92', '96', '100', '104']);
    expect(createFMBandDisplay().labelAt(marks[0].position)).toBe('88.0');
  });

  test('testFMUnitIsMHz', () => {
    expect(createFMBandDisplay().unitAt(bandPosition(0.3))).toBe('MHz');
  });

  test('testTheAppUsesTheWideBand', () => {
    expect(isSpectrumDisplay(currentBandDisplay)).toBe(true);
  });

  test('testALapIsAWholeNumberOfNotches', () => {
    // Otherwise the notches would jump at the seam where the loop joins.
    const notches = 1 / Tuning.detentSpacing;
    // (Math.round matches Swift's .rounded() here because the number is positive.)
    expectClose(notches, Math.round(notches), 1e-6);
  });
});
