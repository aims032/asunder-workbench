import XCTest
@testable import AsunderCore

final class CarrierTests: XCTestCase {
    let clock = AsunderClock()
    let center = World.carrierPosition

    // MARK: Where it is

    /// The wheel settles into notches, so the Carrier must sit exactly on one or
    /// nobody could ever land dead on it.
    func testCarrierSitsOnANotch() {
        let inDetents = center.value / Tuning.detentSpacing
        XCTAssertEqual(inDetents, inDetents.rounded(), accuracy: 1e-9)
    }

    func testDistanceInDetents() {
        XCTAssertEqual(Carrier.detentsAway(from: center), 0, accuracy: 1e-9)
        XCTAssertEqual(Carrier.detentsAway(from: center.moved(by: -3 * Tuning.detentSpacing)), 3, accuracy: 1e-9)
        XCTAssertEqual(Carrier.detentsAway(from: center.moved(by: 2 * Tuning.detentSpacing)), -2, accuracy: 1e-9)
    }

    // MARK: How it sounds from a distance

    func testStrongestDeadOn() {
        XCTAssertEqual(Carrier.strength(detentsAway: 0), 1, accuracy: 1e-12)
        XCTAssertLessThan(Carrier.strength(detentsAway: 2), Carrier.strength(detentsAway: 1))
        XCTAssertLessThan(Carrier.strength(detentsAway: 3 * Tuning.carrierWidth), 0.02)
    }

    func testClarityIsNarrowerThanStrength() {
        XCTAssertLessThan(Carrier.clarity(detentsAway: 1), Carrier.strength(detentsAway: 1))
        XCTAssertEqual(Carrier.clarity(detentsAway: 0), 1, accuracy: 1e-12)
    }

    /// Zero-beat: dead on, it's the hum; off to either side the same whistle, rising.
    func testWhistleSlidesDownToTheHum() {
        XCTAssertEqual(Carrier.pitch(detentsAway: 0), Tuning.humHz, accuracy: 1e-9)
        XCTAssertEqual(Carrier.pitch(detentsAway: 3), Carrier.pitch(detentsAway: -3), accuracy: 1e-9)
        XCTAssertGreaterThan(Carrier.pitch(detentsAway: 3), Carrier.pitch(detentsAway: 2))
        XCTAssertEqual(Carrier.pitch(detentsAway: 1), Tuning.humHz + Tuning.whistleHzPerDetent, accuracy: 1e-9)
    }

    // MARK: The day-turn dropout

    func testDropsOutRightAfterTheDayTurn() {
        let turn = utc("2026-11-18 00:00:00")
        XCTAssertTrue(Carrier.isOnAir(at: turn.addingTimeInterval(-1), clock: clock), "on before the turn")
        XCTAssertFalse(Carrier.isOnAir(at: turn, clock: clock), "gone at the turn")
        XCTAssertFalse(Carrier.isOnAir(at: turn.addingTimeInterval(World.carrierDropoutSeconds - 0.01), clock: clock))
        XCTAssertTrue(Carrier.isOnAir(at: turn.addingTimeInterval(World.carrierDropoutSeconds), clock: clock), "back after")
        XCTAssertTrue(Carrier.isOnAir(at: turn.addingTimeInterval(3_600), clock: clock))
    }

    func testDropsOutOnStillDaysToo() {
        let stillTurn = utc("2026-11-03 00:00:00")  // into Tuesday, a Still day
        XCTAssertTrue(clock.isStill(at: stillTurn))
        XCTAssertFalse(Carrier.isOnAir(at: stillTurn.addingTimeInterval(0.5), clock: clock))
    }

    // MARK: The oscillator

    func testOscillatorPlaysTheRightPitch() {
        var osc = CarrierOscillator()
        var crossings = 0
        var last = osc.next(pitch: 440, sampleRate: testSampleRate)
        for _ in 1..<Int(testSampleRate) {
            let s = osc.next(pitch: 440, sampleRate: testSampleRate)
            if (last < 0) != (s < 0) { crossings += 1 }
            last = s
        }
        XCTAssertEqual(crossings, 880, accuracy: 2, "a 440 Hz wave crosses zero 880 times a second")
    }

    func testOscillatorStaysInRange() {
        var osc = CarrierOscillator()
        for i in 0..<100_000 {
            let s = osc.next(pitch: 50 + Double(i % 9_000), sampleRate: testSampleRate)
            XCTAssertTrue(s >= -1 && s <= 1)
        }
    }

    /// Changing pitch mid-wave must not jump: the wave carries on from where it was.
    func testPitchChangesDontClick() {
        var osc = CarrierOscillator()
        var last = osc.next(pitch: 110, sampleRate: testSampleRate)
        var biggestStep = 0.0
        for i in 1..<9_600 {
            let s = osc.next(pitch: i < 4_800 ? 110 : 1_200, sampleRate: testSampleRate)
            biggestStep = max(biggestStep, abs(s - last))
            last = s
        }
        // At 1,200 Hz a wave moves at most ~0.2 per sample; a click would be far bigger.
        XCTAssertLessThan(biggestStep, 0.3)
    }
}
