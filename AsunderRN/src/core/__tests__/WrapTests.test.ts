import { wrapUnit } from '../index';

// Ported from AsunderCore/Tests/AsunderCoreTests/WrapTests.swift.
// One test here for each Swift test, with the same name, inputs and answers.

/// Swift's XCTAssertEqual(a, b, accuracy: e): the two numbers may differ by at most e.
function expectClose(actual: number, expected: number, accuracy: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(accuracy);
}

describe('WrapTests', () => {
  test('testInsideTheLoopIsUnchanged', () => {
    expect(wrapUnit(0.0)).toBe(0.0);
    expect(wrapUnit(0.5)).toBe(0.5);
  });

  test('testPastTheEndWrapsToTheStart', () => {
    expect(wrapUnit(1.0)).toBe(0.0);
    expectClose(wrapUnit(1.25), 0.25, 1e-12);
    expect(wrapUnit(3.0)).toBe(0.0);
  });

  test('testBeforeTheStartWrapsToTheEnd', () => {
    expectClose(wrapUnit(-0.1), 0.9, 1e-12);
    expect(wrapUnit(-1.0)).toBe(0.0);
  });

  test('testTinyNegativeNeverReturnsOne', () => {
    // -1e-20 + 1 rounds to exactly 1.0 in floating point; must still land in 0..<1.
    const r = wrapUnit(-1e-20);
    expect(r >= 0 && r < 1).toBe(true);
  });
});
