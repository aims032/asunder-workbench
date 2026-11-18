import XCTest
@testable import AsunderCore

final class BandModelTests: XCTestCase {

    // MARK: Positions wrap

    func testPositionsFoldOntoTheLoop() {
        XCTAssertEqual(BandPosition(1.2).value, 0.2, accuracy: 1e-12)
        XCTAssertEqual(BandPosition(-0.25).value, 0.75, accuracy: 1e-12)
    }

    func testMovingPastTheTopComesBackAtTheBottom() {
        XCTAssertEqual(BandPosition(0.9).moved(by: 0.3).value, 0.2, accuracy: 1e-12)
        XCTAssertEqual(BandPosition(0.1).moved(by: -0.3).value, 0.8, accuracy: 1e-12)
    }

    // MARK: Distance takes the short way round

    func testDistanceInsideTheBand() {
        XCTAssertEqual(BandPosition(0.2).distance(to: BandPosition(0.3)), 0.1, accuracy: 1e-12)
        XCTAssertEqual(BandPosition(0.3).distance(to: BandPosition(0.2)), -0.1, accuracy: 1e-12)
    }

    func testDistanceAcrossTheSeam() {
        XCTAssertEqual(BandPosition(0.95).distance(to: BandPosition(0.05)), 0.1, accuracy: 1e-12)
        XCTAssertEqual(BandPosition(0.05).distance(to: BandPosition(0.95)), -0.1, accuracy: 1e-12)
    }

    func testDistanceIsNeverMoreThanHalfTheBand() {
        for a in stride(from: 0.0, to: 1.0, by: 0.07) {
            for b in stride(from: 0.0, to: 1.0, by: 0.05) {
                let d = BandPosition(a).distance(to: BandPosition(b))
                XCTAssertTrue(d >= -0.5 && d < 0.5)
            }
        }
    }

    // MARK: Bell curve

    func testBellStrength() {
        XCTAssertEqual(bellStrength(distance: 0, width: 0.01), 1, accuracy: 1e-12)
        XCTAssertEqual(bellStrength(distance: 0.01, width: 0.01), exp(-0.5), accuracy: 1e-12)
        XCTAssertEqual(bellStrength(distance: -0.01, width: 0.01), exp(-0.5), accuracy: 1e-12,
                       "same strength either side")
        XCTAssertLessThan(bellStrength(distance: 0.04, width: 0.01), 0.001)
    }

    // MARK: Display (placeholder FM band)

    func testFMDisplayEnds() {
        let fm = FMBandDisplay()
        XCTAssertEqual(fm.label(at: BandPosition(0)), "87.5")
        XCTAssertEqual(fm.label(at: BandPosition(0.5)), "97.8") // 97.75 rounds up
        XCTAssertEqual(fm.label(at: BandPosition(0.9999)), "108.0")
        XCTAssertEqual(fm.label(at: BandPosition(1.0)), "87.5", "the top loops to the bottom")
    }

    func testOneDetentIsOneTenth() {
        let fm = FMBandDisplay()
        let a = fm.frequency(at: BandPosition(0.3))
        let b = fm.frequency(at: BandPosition(0.3 + Tuning.detentSpacing))
        XCTAssertEqual(b - a, 0.1, accuracy: 1e-9)
    }
}
