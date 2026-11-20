import XCTest
@testable import AsunderCore

final class SpectrumDisplayTests: XCTestCase {
    let band = SpectrumDisplay()

    // MARK: The ends, and the loop

    func testBottomAndTop() {
        XCTAssertEqual(band.frequency(at: BandPosition(0)), 3e3, accuracy: 1e-6)
        XCTAssertEqual(band.frequency(at: BandPosition(0.999_999)), 1e15, accuracy: 1e15 * 1e-4)
        XCTAssertEqual(band.frequency(at: BandPosition(1)), 3e3, accuracy: 1e-6, "the top loops to the bottom")
    }

    /// Log spacing: every tenfold gets the same room on the dial.
    func testEveryTenfoldGetsTheSameRoom() {
        let mhz = band.position(ofHz: 1e6).value, tenMHz = band.position(ofHz: 1e7).value
        let ghz = band.position(ofHz: 1e9).value, tenGHz = band.position(ofHz: 1e10).value
        XCTAssertEqual(tenMHz - mhz, tenGHz - ghz, accuracy: 1e-12)
        XCTAssertEqual(tenMHz - mhz, 1 / band.decades, accuracy: 1e-12)
    }

    func testPositionAndFrequencyAreInverses() {
        for hz in [3.1e3, 1e5, 19.93e6, 2.45e9, 550e12] {
            XCTAssertEqual(band.frequency(at: band.position(ofHz: hz)), hz, accuracy: hz * 1e-9)
        }
    }

    func testEveryNotchIsTheSameStepUp() {
        let step = Tuning.detentSpacing
        let ratioLow = band.frequency(at: BandPosition(0.1 + step)) / band.frequency(at: BandPosition(0.1))
        let ratioHigh = band.frequency(at: BandPosition(0.8 + step)) / band.frequency(at: BandPosition(0.8))
        XCTAssertEqual(ratioLow, ratioHigh, accuracy: 1e-9)
    }

    // MARK: The readout

    func testReadoutPicksTheUnit() {
        XCTAssertTrue(SpectrumDisplay.readout(hz: 3e3) == ("3.000", "kHz"))
        XCTAssertTrue(SpectrumDisplay.readout(hz: 19.934e6) == ("19.93", "MHz"))
        XCTAssertTrue(SpectrumDisplay.readout(hz: 172.84e9) == ("172.8", "GHz"))
        XCTAssertTrue(SpectrumDisplay.readout(hz: 550e12) == ("550.0", "THz"))
    }

    func testRoundingCarriesOverCleanly() {
        XCTAssertTrue(SpectrumDisplay.readout(hz: 9.99996e6) == ("10.00", "MHz"))
        XCTAssertTrue(SpectrumDisplay.readout(hz: 999.96e6) == ("1.000", "GHz"))
        XCTAssertTrue(SpectrumDisplay.readout(hz: 999.96e12) == ("1000", "THz"), "nothing above THz")
    }

    /// Four significant digits must be enough for neighboring notches to read
    /// differently, or the readout would look stuck while the wheel turns.
    func testNeighboringNotchesReadDifferently() {
        for i in stride(from: 0, to: Int(Tuning.notchesPerLap) - 1, by: 7) {
            let a = BandPosition(Double(i) * Tuning.detentSpacing)
            let b = BandPosition(Double(i + 1) * Tuning.detentSpacing)
            XCTAssertNotEqual(band.label(at: a) + band.unit(at: a), band.label(at: b) + band.unit(at: b), "notch \(i)")
        }
    }

    // MARK: The printed scale

    func testScaleIsNumberedAtEveryPowerOfTen() {
        let labels = band.scaleMarks().compactMap(\.label)
        XCTAssertEqual(labels, ["10k", "100k", "1M", "10M", "100M", "1G", "10G", "100G", "1T", "10T", "100T"])
    }

    func testScaleMarksRunInOrderInsideTheBand() {
        let positions = band.scaleMarks().map(\.position.value)
        XCTAssertEqual(positions, positions.sorted())
        XCTAssertTrue(positions.allSatisfy { $0 > 0 && $0 < 1 })
    }
}
