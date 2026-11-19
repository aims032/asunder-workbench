import XCTest
@testable import AsunderCore

final class LockDetectorTests: XCTestCase {

    /// Feed a run of distances (detents); return the indexes where it pulsed.
    func pulses(_ distances: [Double]) -> [Int] {
        var lock = LockDetector()
        return distances.indices.filter { lock.update(detentsAway: distances[$0]) }
    }

    func testPulsesOnceOnArrival() {
        XCTAssertEqual(pulses([3, 2, 1, 0, 0, 0, 0]), [3])
    }

    func testSittingOnTheCenterDoesntRepeat() {
        XCTAssertEqual(pulses(Array(repeating: 0, count: 50)), [0])
    }

    func testMovingAwayAndBackPulsesAgain() {
        XCTAssertEqual(pulses([0, 1, 0]), [0, 2])
    }

    func testWobblingInsideTheReleaseDoesntRepeat() {
        XCTAssertEqual(pulses([0, 0.5, 0.1, 0.6, 0]), [0])
    }

    func testAFastSpinAcrossTheCenterStillBumps() {
        // Jumps from 4 above to 3 below in one frame without ever landing near.
        XCTAssertEqual(pulses([12, 8, 4, -3, -7]), [3])
    }

    func testTheFarSideOfTheLoopIsNotACrossing() {
        // Half a band away the distance flips from +102 to -102: that's not the center.
        XCTAssertEqual(pulses([102, -102, 102]), [])
    }

    func testLeavingThroughTheCenterDoesntPulseTwice() {
        XCTAssertEqual(pulses([0, -4, -8]), [0])
    }
}
