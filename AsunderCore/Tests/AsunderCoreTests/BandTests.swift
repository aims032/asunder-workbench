import XCTest
@testable import AsunderCore

final class BandTests: XCTestCase {

    // MARK: distance and offset

    func testDistanceTakesTheShortWayAround() {
        XCTAssertEqual(Band.distance(0.95, 0.05), 0.1, accuracy: 1e-12)
        XCTAssertEqual(Band.distance(0.05, 0.95), 0.1, accuracy: 1e-12)
        XCTAssertEqual(Band.distance(0.2, 0.3), 0.1, accuracy: 1e-12)
    }

    func testDistanceNeverExceedsHalf() {
        XCTAssertEqual(Band.distance(0.0, 0.5), 0.5, accuracy: 1e-12)
        for i in 0..<100 {
            let a = Double(i) / 100
            for j in 0..<100 {
                XCTAssertLessThanOrEqual(Band.distance(a, Double(j) / 100), 0.5 + 1e-12)
            }
        }
    }

    func testOffsetSignShowsDirection() {
        XCTAssertEqual(Band.offset(from: 0.2, to: 0.3), 0.1, accuracy: 1e-12)   // up
        XCTAssertEqual(Band.offset(from: 0.3, to: 0.2), -0.1, accuracy: 1e-12)  // down
        // Across the seam: from 0.95 the short way to 0.05 is up.
        XCTAssertEqual(Band.offset(from: 0.95, to: 0.05), 0.1, accuracy: 1e-12)
        XCTAssertEqual(Band.offset(from: 0.05, to: 0.95), -0.1, accuracy: 1e-12)
    }

    func testOffsetHandlesUnwrappedInput() {
        // A dial that's spun past 1 still measures correctly.
        XCTAssertEqual(Band.offset(from: 3.2, to: 0.3), 0.1, accuracy: 1e-12)
    }

    // MARK: strength

    func testStrengthIsFullOnCenterAndHalfAtBandwidth() {
        XCTAssertEqual(Band.strength(dial: 0.4, center: 0.4, bandwidth: 0.01), 1, accuracy: 1e-12)
        XCTAssertEqual(Band.strength(dial: 0.41, center: 0.4, bandwidth: 0.01), 0.5, accuracy: 1e-9)
        XCTAssertEqual(Band.strength(dial: 0.39, center: 0.4, bandwidth: 0.01), 0.5, accuracy: 1e-9)
    }

    func testStrengthWorksAcrossTheSeam() {
        // A feature at 0.001 is heard from 0.999.
        let s = Band.strength(dial: 0.999, center: 0.001, bandwidth: 0.002)
        XCTAssertEqual(s, 0.5, accuracy: 1e-9)
    }

    func testStrengthFallsOffMovingAway() {
        var last = 1.0
        for step in 1...20 {
            let s = Band.strength(dial: 0.5 + Double(step) * 0.001, center: 0.5, bandwidth: 0.004)
            XCTAssertLessThan(s, last)
            last = s
        }
        XCTAssertLessThan(Band.strength(dial: 0.6, center: 0.5, bandwidth: 0.004), 1e-6)
    }

    func testZeroBandwidthIsSilentNotACrash() {
        XCTAssertEqual(Band.strength(dial: 0.5, center: 0.5, bandwidth: 0), 0)
    }

    // MARK: display

    func testPlaceholderDisplayLooksLikeFM() {
        let fm = BandDisplay.placeholder
        XCTAssertEqual(fm.value(at: 0), 87.5, accuracy: 1e-9)
        XCTAssertEqual(fm.value(at: 0.5), 97.75, accuracy: 1e-9)
        XCTAssertEqual(fm.label(at: 0), "87.5")
        XCTAssertEqual(fm.label(at: 0.2), "91.6")
    }

    func testDisplayWraps() {
        let fm = BandDisplay.placeholder
        XCTAssertEqual(fm.value(at: 1.0), fm.value(at: 0.0), accuracy: 1e-9)
        XCTAssertEqual(fm.value(at: 1.2), fm.value(at: 0.2), accuracy: 1e-9)
        XCTAssertEqual(fm.value(at: -0.2), fm.value(at: 0.8), accuracy: 1e-9)
    }
}
