import XCTest
@testable import AsunderCore

final class FilterTests: XCTestCase {

    func sine(_ hz: Double, seconds: Double = 0.5) -> [Double] {
        (0..<Int(seconds * testSampleRate)).map { sin(2 * .pi * hz * Double($0) / testSampleRate) }
    }

    /// Level after the filter relative to before, in dB, once it has settled.
    func gain(of hz: Double, through pick: (StateVariableFilter, Double) -> (StateVariableFilter, Double),
              cutoff: Double) -> Double {
        var filter = StateVariableFilter()
        filter.setCutoff(cutoff, resonance: 0.707, sampleRate: testSampleRate)
        let input = sine(hz)
        var output = [Double]()
        for x in input {
            let (f, y) = pick(filter, x)
            filter = f
            output.append(y)
        }
        let skip = input.count / 2
        return decibels(rms(output.dropFirst(skip)) / rms(input.dropFirst(skip)))
    }

    func lowpass(_ f: StateVariableFilter, _ x: Double) -> (StateVariableFilter, Double) {
        var f = f; let y = f.process(x).low; return (f, y)
    }

    func highpass(_ f: StateVariableFilter, _ x: Double) -> (StateVariableFilter, Double) {
        var f = f; let y = f.process(x).high; return (f, y)
    }

    func testLowpassKeepsLowsAndCutsHighs() {
        XCTAssertEqual(gain(of: 100, through: lowpass, cutoff: 1_000), 0, accuracy: 0.5)
        XCTAssertEqual(gain(of: 1_000, through: lowpass, cutoff: 1_000), -3, accuracy: 0.5)
        XCTAssertLessThan(gain(of: 10_000, through: lowpass, cutoff: 1_000), -35)
    }

    func testHighpassKeepsHighsAndCutsLows() {
        XCTAssertEqual(gain(of: 10_000, through: highpass, cutoff: 1_000), 0, accuracy: 0.5)
        XCTAssertEqual(gain(of: 1_000, through: highpass, cutoff: 1_000), -3, accuracy: 0.5)
        XCTAssertLessThan(gain(of: 100, through: highpass, cutoff: 1_000), -35)
    }

    /// The receiver sweeps its filters whenever you tune. Slamming the cutoff
    /// around while noise runs through must never blow up.
    func testSweepingTheCutoffNeverBlowsUp() {
        var filter = StateVariableFilter()
        var random = NoiseRandom(seed: 3)
        var worst = 0.0
        for i in 0..<200_000 {
            if i % 16 == 0 {
                let hz = i % 32 == 0 ? 30.0 : 20_000.0
                filter.setCutoff(hz, resonance: 0.8, sampleRate: testSampleRate)
            }
            let out = filter.process(random.nextSigned())
            XCTAssertTrue(out.low.isFinite && out.high.isFinite)
            worst = max(worst, abs(out.low), abs(out.high))
        }
        XCTAssertLessThan(worst, 10)
    }

    func testCutoffAboveTheLimitIsClampedNotBroken() {
        var filter = StateVariableFilter()
        filter.setCutoff(1_000_000, resonance: 0.707, sampleRate: testSampleRate)
        XCTAssertTrue(filter.process(1).low.isFinite)
    }

    // MARK: Smoothed

    func testSmoothedCoversAboutTwoThirdsInItsTime() {
        var s = Smoothed(0, seconds: 0.01, sampleRate: testSampleRate)
        for _ in 0..<480 { s.step(toward: 1) }  // 0.01 s
        XCTAssertEqual(s.value, 1 - exp(-1), accuracy: 0.01)
    }

    func testSmoothedWithZeroTimeJumpsStraightThere() {
        var s = Smoothed(0, seconds: 0, sampleRate: testSampleRate)
        XCTAssertEqual(s.step(toward: 5), 5)
    }
}
