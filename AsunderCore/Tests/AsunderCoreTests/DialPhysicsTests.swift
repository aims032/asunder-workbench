import XCTest
@testable import AsunderCore

final class DialPhysicsTests: XCTestCase {
    let frame = 1.0 / 60.0
    let detent = Tuning.detentSpacing

    /// Run time forward until the wheel comes to rest (or 30 s pass).
    func runToRest(_ dial: inout DialPhysics, frame: Double = 1.0 / 60.0) {
        var t = 0.0
        while !dial.isAtRest && t < 30 {
            dial.step(frame)
            t += frame
        }
    }

    /// Grab, swipe `perFrame` each frame for `frames` frames, then let go.
    func flick(_ dial: inout DialPhysics, perFrame: Double, frames: Int, frame: Double = 1.0 / 60.0) {
        dial.grab()
        for _ in 0..<frames {
            dial.drag(by: perFrame)
            dial.step(frame)
        }
        dial.release()
    }

    func isOnANotch(_ position: Double) -> Bool {
        let inDetents = position / detent
        return abs(inDetents - inDetents.rounded()) < 0.01
    }

    // MARK: A slow drag tracks the finger exactly

    func testDragMovesTheWheelExactly() {
        var dial = DialPhysics(start: 0.2)
        dial.grab()
        dial.drag(by: 0.01)
        XCTAssertEqual(dial.position, 0.21, accuracy: 1e-12)
        dial.step(frame)
        XCTAssertEqual(dial.position, 0.21, accuracy: 1e-12, "held: no coasting")
    }

    func testNeedleLagsThenCatchesUp() {
        var dial = DialPhysics(start: 0.2)
        dial.grab()
        dial.drag(by: 0.01)
        dial.step(frame)
        XCTAssertGreaterThan(dial.needle, 0.2)
        XCTAssertLessThan(dial.needle, 0.21, "needle is behind the hand")
        for _ in 0..<120 { dial.step(frame) }
        XCTAssertEqual(dial.needle, 0.21, accuracy: 1e-6)
    }

    // MARK: A flick coasts, slows, and clicks into a notch

    func testFlickCoastsThenStopsOnANotch() {
        var dial = DialPhysics(start: 0.3)
        flick(&dial, perFrame: 2 * detent, frames: 10)   // ~120 detents/s
        let released = dial.position
        XCTAssertGreaterThan(dial.velocity, 0)

        dial.step(frame)
        XCTAssertGreaterThan(dial.position, released, "keeps going after release")

        runToRest(&dial)
        XCTAssertTrue(dial.isAtRest)
        XCTAssertGreaterThan(dial.position - released, 20 * detent, "coasted a real distance")
        XCTAssertTrue(isOnANotch(dial.position))
        XCTAssertEqual(dial.needle, dial.position)
    }

    func testFlickBackwardsCoastsBackwards() {
        var dial = DialPhysics(start: 0.5)
        flick(&dial, perFrame: -2 * detent, frames: 10)
        let released = dial.position
        runToRest(&dial)
        XCTAssertLessThan(dial.position, released)
        XCTAssertTrue(isOnANotch(dial.position))
    }

    func testGrabbingStopsACoastDead() {
        var dial = DialPhysics(start: 0.3)
        flick(&dial, perFrame: 2 * detent, frames: 10)
        for _ in 0..<10 { dial.step(frame) }
        dial.grab()
        let held = dial.position
        XCTAssertEqual(dial.velocity, 0)
        for _ in 0..<30 { dial.step(frame) }
        XCTAssertEqual(dial.position, held, accuracy: 1e-12)
    }

    func testStoppingBeforeLiftingDoesNotFlick() {
        var dial = DialPhysics(start: 0.3)
        dial.grab()
        for _ in 0..<10 { dial.drag(by: 2 * detent); dial.step(frame) }
        for _ in 0..<30 { dial.step(frame) }     // finger holds still for half a second
        let lifted = dial.position
        dial.release()
        XCTAssertEqual(dial.velocity, 0)
        runToRest(&dial)
        XCTAssertLessThan(abs(dial.position - lifted), detent, "just seats into the nearest notch")
    }

    func testSlowReleaseSettlesToTheNearestNotch() {
        var dial = DialPhysics(start: 0)
        dial.grab()
        dial.drag(by: 0.4 * detent)
        for _ in 0..<60 { dial.step(frame) }
        dial.release()
        runToRest(&dial)
        XCTAssertEqual(dial.position, 0, accuracy: 1e-12, "0.4 of a notch rolls back to 0")
    }

    func testFlickSpeedIsCapped() {
        var dial = DialPhysics(start: 0)
        flick(&dial, perFrame: 50 * detent, frames: 10)  // absurdly fast swipe
        XCTAssertLessThanOrEqual(dial.velocity, Tuning.maxFlickSpeed * detent + 1e-12)
    }

    // MARK: No end stop

    func testTheWheelSpinsPastTheSeam() {
        var dial = DialPhysics(start: 0.99)
        dial.grab()
        dial.drag(by: 0.05)
        XCTAssertEqual(dial.position, 1.04, accuracy: 1e-12, "position keeps counting")
        XCTAssertEqual(dial.band.value, 0.04, accuracy: 1e-12, "the band wraps")
    }

    // MARK: Same feel at any frame rate

    func testCoastDistanceIsTheSameAt60And120FPS() {
        func coast(fps: Double) -> Double {
            var dial = DialPhysics(start: 0)
            let frame = 1 / fps
            // The same finger speed: 120 detents/s for 1/6 s.
            flick(&dial, perFrame: 120 * detent * frame, frames: Int(fps / 6), frame: frame)
            let released = dial.position
            runToRest(&dial, frame: frame)
            return dial.position - released
        }
        let at60 = coast(fps: 60), at120 = coast(fps: 120)
        XCTAssertEqual(at60, at120, accuracy: max(at60, at120) * 0.1 + 2 * detent)
    }

    // MARK: Lock-on snap

    func testRestingNearASnapPointSettlesOnIt() {
        let point = BandPosition(0.4 + 0.37 * detent)        // between two notches
        var dial = DialPhysics(start: 0.4 + 0.1 * detent)    // near the notch at 0.4
        dial.snapPoints = [point]
        dial.grab(); dial.release()
        runToRest(&dial)
        XCTAssertEqual(dial.band.value, point.value, accuracy: 1e-9)
    }

    func testFarFromASnapPointItSettlesOnANotch() {
        var dial = DialPhysics(start: 0.4)
        dial.snapPoints = [BandPosition(0.4 + 5 * detent)]
        dial.grab(); dial.release()
        runToRest(&dial)
        XCTAssertTrue(isOnANotch(dial.position))
    }

    func testSnapWorksAcrossTheSeam() {
        // A snap point just past the top of the band, approached from three laps up.
        let point = BandPosition(0.2 * detent)
        var dial = DialPhysics(start: 3 - 0.2 * detent)
        dial.snapPoints = [point]
        dial.grab(); dial.release()
        runToRest(&dial)
        XCTAssertEqual(dial.band.value, point.value, accuracy: 1e-9)
        XCTAssertEqual(dial.position, 3 + 0.2 * detent, accuracy: 1e-9, "same lap, no spin round")
    }

    // MARK: Detents

    func testDetentIndexChangesHalfwayBetweenNotches() {
        XCTAssertEqual(DialPhysics.detentIndex(of: 0.49 * detent), 0)
        XCTAssertEqual(DialPhysics.detentIndex(of: 0.51 * detent), 1)
        XCTAssertEqual(DialPhysics.detentIndex(of: -0.51 * detent), -1)
    }
}
