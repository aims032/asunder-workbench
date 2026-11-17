import XCTest
@testable import AsunderCore

final class LockDetectorTests: XCTestCase {

    func testPulsesOnceOnArrival() {
        var lock = LockDetector()
        XCTAssertFalse(lock.update(strength: 0.5, on: 0.8, off: 0.6))
        XCTAssertTrue(lock.update(strength: 0.9, on: 0.8, off: 0.6))    // arrive: pulse
        XCTAssertFalse(lock.update(strength: 1.0, on: 0.8, off: 0.6))   // sitting there: no repeat
        XCTAssertTrue(lock.isLocked)
    }

    func testHoveringAtTheEdgeDoesNotStutter() {
        var lock = LockDetector()
        _ = lock.update(strength: 0.85, on: 0.8, off: 0.6)
        // Wobble between 0.7 and 0.85: stays locked, never pulses again.
        for s in [0.7, 0.85, 0.7, 0.82, 0.65] {
            XCTAssertFalse(lock.update(strength: s, on: 0.8, off: 0.6))
            XCTAssertTrue(lock.isLocked)
        }
    }

    func testLeavingAndComingBackPulsesAgain() {
        var lock = LockDetector()
        XCTAssertTrue(lock.update(strength: 0.9, on: 0.8, off: 0.6))
        XCTAssertFalse(lock.update(strength: 0.5, on: 0.8, off: 0.6))   // leave
        XCTAssertFalse(lock.isLocked)
        XCTAssertTrue(lock.update(strength: 0.9, on: 0.8, off: 0.6))    // back
    }

    func testDefaultThresholdsAreOrdered() {
        XCTAssertGreaterThan(Tuning.lockOnStrength, Tuning.lockOffStrength,
                             "lock-off must sit below lock-on or the pulse will stutter")
    }

    func testTheCarrierCanBeLockedFromTheDial() {
        // Sitting on the Carrier's position locks; far away doesn't.
        var lock = LockDetector()
        let far = Band.strength(dial: Features.carrierPosition + 0.1, center: Features.carrierPosition)
        XCTAssertFalse(lock.update(strength: far))
        let on = Band.strength(dial: Features.carrierPosition, center: Features.carrierPosition)
        XCTAssertTrue(lock.update(strength: on))
    }
}

final class TickThrottleTests: XCTestCase {

    func testNothingCrossedNothingPlayed() {
        var t = TickThrottle()
        XCTAssertFalse(t.shouldPlay(ticks: 0, at: 1.0, minInterval: 0.01))
    }

    func testSpacedTicksAllPlay() {
        var t = TickThrottle()
        XCTAssertTrue(t.shouldPlay(ticks: 1, at: 1.00, minInterval: 0.01))
        XCTAssertTrue(t.shouldPlay(ticks: 1, at: 1.02, minInterval: 0.01))
        XCTAssertTrue(t.shouldPlay(ticks: 1, at: 1.04, minInterval: 0.01))
    }

    func testTicksTooCloseTogetherAreDropped() {
        var t = TickThrottle()
        XCTAssertTrue(t.shouldPlay(ticks: 1, at: 1.000, minInterval: 0.01))
        XCTAssertFalse(t.shouldPlay(ticks: 1, at: 1.004, minInterval: 0.01))
        XCTAssertFalse(t.shouldPlay(ticks: 3, at: 1.008, minInterval: 0.01))
        XCTAssertTrue(t.shouldPlay(ticks: 1, at: 1.011, minInterval: 0.01))
    }
}
