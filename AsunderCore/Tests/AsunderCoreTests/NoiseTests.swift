import XCTest
@testable import AsunderCore

final class NoiseTests: XCTestCase {

    func makeColors(seed: UInt64 = 1, count: Int = 480_000) -> (white: [Double], pink: [Double], brown: [Double]) {
        var source = NoiseSource(seed: seed)
        var w = [Double](), p = [Double](), b = [Double]()
        w.reserveCapacity(count); p.reserveCapacity(count); b.reserveCapacity(count)
        for _ in 0..<count {
            let c = source.next()
            w.append(c.white); p.append(c.pink); b.append(c.brown)
        }
        return (w, p, b)
    }

    // MARK: The random numbers

    func testSameSeedSameSequence() {
        var a = NoiseRandom(seed: 99), b = NoiseRandom(seed: 99)
        for _ in 0..<1_000 { XCTAssertEqual(a.next(), b.next()) }
    }

    func testNearbySeedsGiveUnrelatedSequences() {
        var a = NoiseRandom(seed: 1), b = NoiseRandom(seed: 2)
        let matches = (0..<1_000).filter { _ in a.next() == b.next() }.count
        XCTAssertEqual(matches, 0)
    }

    func testSeedZeroStillMakesNoise() {
        var r = NoiseRandom(seed: 0)
        let values = Set((0..<100).map { _ in r.next() })
        XCTAssertGreaterThan(values.count, 95)
    }

    func testSignedValuesStayBetweenMinusOneAndOne() {
        var r = NoiseRandom(seed: 5)
        for _ in 0..<100_000 {
            let v = r.nextSigned()
            XCTAssertTrue(v >= -1 && v < 1)
        }
    }

    // MARK: The three colors

    func testEachColorIsAboutEquallyLoud() {
        let c = makeColors()
        for (name, s) in [("white", c.white), ("pink", c.pink), ("brown", c.brown)] {
            XCTAssertEqual(rms(s), 0.3, accuracy: 0.04, name)
        }
    }

    func testNoColorDriftsOffCenter() {
        let c = makeColors()
        for (name, s) in [("white", c.white), ("pink", c.pink), ("brown", c.brown)] {
            let mean = s.reduce(0, +) / Double(s.count)
            XCTAssertEqual(mean, 0, accuracy: 0.03, name)
        }
    }

    /// Measured in octave-wide bands three octaves apart (500 Hz vs 4 kHz):
    /// white gets ~9 dB louder going up, pink stays level, brown gets ~9 dB quieter.
    func testColorsHaveTheRightTilt() {
        let c = makeColors()
        func tilt(_ s: [Double]) -> Double { decibels(bandLevel(s, at: 4_000) / bandLevel(s, at: 500)) }
        XCTAssertEqual(tilt(c.white), 9, accuracy: 2, "white")
        XCTAssertEqual(tilt(c.pink), 0, accuracy: 2, "pink")
        XCTAssertEqual(tilt(c.brown), -9, accuracy: 2, "brown")
    }

    // MARK: Temperature (NoiseColor)

    func testGainsDependOnlyOnTheRatioOfWeights() {
        let a = NoiseColor(white: 0.5, pink: 0.5, brown: 0, level: 1).gains
        let b = NoiseColor(white: 1, pink: 1, brown: 0, level: 1).gains
        XCTAssertEqual(a.white, b.white, accuracy: 1e-12)
        XCTAssertEqual(a.pink, b.pink, accuracy: 1e-12)
    }

    func testLevelAloneSetsLoudness() {
        // Independent noises add by power, so the gains' power is the level squared.
        let g = NoiseColor(white: 3, pink: 1, brown: 2, level: 0.4).gains
        let power = (g.white * g.white + g.pink * g.pink + g.brown * g.brown).squareRoot()
        XCTAssertEqual(power, 0.4, accuracy: 1e-12)
    }

    func testAllZeroWeightsIsSilence() {
        let g = NoiseColor(white: 0, pink: 0, brown: 0, level: 1).gains
        XCTAssertEqual([g.white, g.pink, g.brown], [0, 0, 0])
    }

    func testBetweenGoesFromColdToHot() {
        let cold = NoiseColor(white: 0, pink: 0, brown: 1, level: 0.5)
        let hot = NoiseColor(white: 1, pink: 0, brown: 0, level: 1)
        XCTAssertEqual(NoiseColor.between(cold, hot, 0), cold)
        XCTAssertEqual(NoiseColor.between(cold, hot, 1), hot)
        XCTAssertEqual(NoiseColor.between(cold, hot, 0.5).level, 0.75, accuracy: 1e-12)
    }

    func testHotStaticIsBrighterAndLouderThanCold() {
        XCTAssertGreaterThan(Tuning.hotStatic.level, Tuning.coldStatic.level)
        XCTAssertGreaterThan(Tuning.hotStatic.white / Tuning.hotStatic.brown,
                             Tuning.coldStatic.white / Tuning.coldStatic.brown)
    }
}
