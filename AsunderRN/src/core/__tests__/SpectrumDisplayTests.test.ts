import { Tuning, bandPosition, createSpectrumDisplay, spectrumReadout } from '../index';

// Ported from AsunderCore/Tests/AsunderCoreTests/SpectrumDisplayTests.swift.
// One test here for each Swift test, with the same name, inputs and answers.

/// Swift's XCTAssertEqual(a, b, accuracy: e): the two numbers may differ by at most e.
function expectClose(actual: number, expected: number, accuracy: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(accuracy);
}

describe('SpectrumDisplayTests', () => {
  const band = createSpectrumDisplay();

  // MARK: The ends, and the loop

  test('testBottomAndTop', () => {
    expectClose(band.frequencyAt(bandPosition(0)), 3e3, 1e-6);
    expectClose(band.frequencyAt(bandPosition(0.999_999)), 1e15, 1e15 * 1e-4);
    // the top loops to the bottom
    expectClose(band.frequencyAt(bandPosition(1)), 3e3, 1e-6);
  });

  /// Log spacing: every tenfold gets the same room on the dial.
  test('testEveryTenfoldGetsTheSameRoom', () => {
    const mhz = band.positionOfHz(1e6);
    const tenMHz = band.positionOfHz(1e7);
    const ghz = band.positionOfHz(1e9);
    const tenGHz = band.positionOfHz(1e10);
    expectClose(tenMHz - mhz, tenGHz - ghz, 1e-12);
    expectClose(tenMHz - mhz, 1 / band.decades(), 1e-12);
  });

  test('testPositionAndFrequencyAreInverses', () => {
    for (const hz of [3.1e3, 1e5, 19.93e6, 2.45e9, 550e12]) {
      expectClose(band.frequencyAt(band.positionOfHz(hz)), hz, hz * 1e-9);
    }
  });

  test('testEveryNotchIsTheSameStepUp', () => {
    const step = Tuning.detentSpacing;
    const ratioLow =
      band.frequencyAt(bandPosition(0.1 + step)) / band.frequencyAt(bandPosition(0.1));
    const ratioHigh =
      band.frequencyAt(bandPosition(0.8 + step)) / band.frequencyAt(bandPosition(0.8));
    expectClose(ratioLow, ratioHigh, 1e-9);
  });

  // MARK: The readout

  test('testReadoutPicksTheUnit', () => {
    expect(spectrumReadout(3e3)).toEqual({ number: '3.000', unit: 'kHz' });
    expect(spectrumReadout(19.934e6)).toEqual({ number: '19.93', unit: 'MHz' });
    expect(spectrumReadout(172.84e9)).toEqual({ number: '172.8', unit: 'GHz' });
    expect(spectrumReadout(550e12)).toEqual({ number: '550.0', unit: 'THz' });
  });

  test('testRoundingCarriesOverCleanly', () => {
    expect(spectrumReadout(9.99996e6)).toEqual({ number: '10.00', unit: 'MHz' });
    expect(spectrumReadout(999.96e6)).toEqual({ number: '1.000', unit: 'GHz' });
    // nothing above THz
    expect(spectrumReadout(999.96e12)).toEqual({ number: '1000', unit: 'THz' });
  });

  /// Four significant digits must be enough for neighboring notches to read
  /// differently, or the readout would look stuck while the wheel turns.
  test('testNeighboringNotchesReadDifferently', () => {
    for (let i = 0; i < Math.trunc(Tuning.notchesPerLap) - 1; i += 7) {
      const a = bandPosition(i * Tuning.detentSpacing);
      const b = bandPosition((i + 1) * Tuning.detentSpacing);
      // (The notch number is written into both sides so a failure says which notch it was.)
      expect(`notch ${i}: ${band.labelAt(a) + band.unitAt(a)}`).not.toBe(
        `notch ${i}: ${band.labelAt(b) + band.unitAt(b)}`,
      );
    }
  });

  // MARK: The printed scale

  test('testScaleIsNumberedAtEveryPowerOfTen', () => {
    const labels = band
      .scaleMarks()
      .map((mark) => mark.label)
      .filter((label) => label !== null);
    expect(labels).toEqual([
      '10k',
      '100k',
      '1M',
      '10M',
      '100M',
      '1G',
      '10G',
      '100G',
      '1T',
      '10T',
      '100T',
    ]);
  });

  test('testScaleMarksRunInOrderInsideTheBand', () => {
    const positions = band.scaleMarks().map((mark) => mark.position);
    // (A copy is sorted by size; JavaScript's plain sort() would sort numbers as text.)
    const sorted = [...positions].sort((x, y) => x - y);
    expect(positions).toEqual(sorted);
    expect(positions.every((p) => p > 0 && p < 1)).toBe(true);
  });
});
