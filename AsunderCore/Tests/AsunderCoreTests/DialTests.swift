import XCTest
@testable import AsunderCore

final class DialPhysicsTests: XCTestCase {

    let frame = 1.0 / 60.0

    /// Drag at a steady speed (band units per second) for `seconds`, 60 events a second.
    /// Returns the time of the last drag event.
    @discardableResult
    func drag(_ dial: inout DialPhysics, speed: Double, seconds: Double, from start: Double = 0) -> Double {
        dial.grab(at: start)
        var t = start
        let steps = Int(seconds / frame)
        for _ in 0..<steps {
            t += frame
            dial.drag(by: speed * frame, at: t)
            dial.step(dt: frame)
        }
        return t
    }

    /// Step until the wheel stops (or give up after a minute). Returns seconds taken.
    @discardableResult
    func coastToStop(_ dial: inout DialPhysics, dt: Double = 1.0 / 60.0) -> Double {
        var t = 0.0
        while dial.velocity != 0 && t < 60 {
            dial.step(dt: dt)
            t += dt
        }
        return t
    }

    // MARK: the hand

    func testSlowDragTracksTheFingerExactly() {
        var dial = DialPhysics(position: 0.3)
        dial.grab(at: 0)
        dial.drag(by: 0.01, at: 0.1)
        XCTAssertEqual(dial.position, 0.31, accuracy: 1e-12)
        dial.step(dt: frame)
        dial.drag(by: -0.025, at: 0.2)
        XCTAssertEqual(dial.position, 0.285, accuracy: 1e-12)
    }

    func testAFlickCoastsInTheSameDirectionThenStops() {
        var dial = DialPhysics(position: 0.5)
        let t = drag(&dial, speed: 1.0, seconds: 0.1)
        let atRelease = dial.rotation
        dial.release(at: t)
        XCTAssertGreaterThan(dial.velocity, 0.5)

        let took = coastToStop(&dial)
        XCTAssertEqual(dial.velocity, 0)
        XCTAssertLessThan(took, 10, "should settle within a few seconds")
        XCTAssertGreaterThan(dial.rotation, atRelease + 0.1, "should travel well past the release point")
    }

    func testAFlickDownCoastsDown() {
        var dial = DialPhysics(position: 0.5)
        let t = drag(&dial, speed: -1.0, seconds: 0.1)
        let atRelease = dial.rotation
        dial.release(at: t)
        coastToStop(&dial)
        XCTAssertLessThan(dial.rotation, atRelease - 0.1)
    }

    func testPausingBeforeLettingGoMeansNoCoast() {
        var dial = DialPhysics(position: 0.5)
        let t = drag(&dial, speed: 1.0, seconds: 0.2)
        let held = dial.rotation
        // Finger stays down, still, for a fifth of a second, then lifts.
        dial.release(at: t + 0.2)
        XCTAssertEqual(dial.velocity, 0)
        dial.step(dt: frame)
        XCTAssertEqual(dial.rotation, held)
    }

    func testATapWithoutMovingDoesNothing() {
        var dial = DialPhysics(position: 0.42)
        dial.grab(at: 1.0)
        dial.release(at: 1.05)
        XCTAssertEqual(dial.velocity, 0)
        XCTAssertEqual(dial.position, 0.42, accuracy: 1e-12)
    }

    func testGrabbingACoastingWheelStopsIt() {
        var dial = DialPhysics()
        let t = drag(&dial, speed: 2.0, seconds: 0.1)
        dial.release(at: t)
        dial.step(dt: frame)
        XCTAssertNotEqual(dial.velocity, 0)
        dial.grab(at: t + frame)
        XCTAssertEqual(dial.velocity, 0)
        let caught = dial.rotation
        dial.step(dt: frame)
        XCTAssertEqual(dial.rotation, caught)
    }

    func testAWildFlickIsCapped() {
        var dial = DialPhysics()
        dial.grab(at: 0)
        dial.drag(by: 5.0, at: 0.01)   // 500 band units per second
        dial.release(at: 0.02)
        XCTAssertEqual(dial.velocity, Tuning.dialMaxSpeed, accuracy: 1e-12)
    }

    func testCoastFeelsTheSameAt60And120FramesPerSecond() {
        // ProMotion iPhones run at 120. The coast shouldn't go farther on them.
        func coastDistance(dt: Double) -> Double {
            var dial = DialPhysics()
            let t = drag(&dial, speed: 1.0, seconds: 0.1)
            dial.release(at: t)
            let start = dial.rotation
            coastToStop(&dial, dt: dt)
            return dial.rotation - start
        }
        let at60 = coastDistance(dt: 1.0 / 60.0)
        let at120 = coastDistance(dt: 1.0 / 120.0)
        XCTAssertEqual(at60, at120, accuracy: at60 * 0.03, "within 3%")
    }

    // MARK: the loop

    func testPositionWrapsButRotationIsContinuous() {
        var dial = DialPhysics(position: 0.98)
        dial.grab(at: 0)
        dial.drag(by: 0.05, at: 0.1)
        XCTAssertEqual(dial.rotation, 1.03, accuracy: 1e-12)
        XCTAssertEqual(dial.position, 0.03, accuracy: 1e-12)

        dial.drag(by: -0.1, at: 0.2)
        XCTAssertEqual(dial.position, 0.93, accuracy: 1e-12)

        var down = DialPhysics(position: 0.01)
        down.grab(at: 0)
        down.drag(by: -0.03, at: 0.1)
        XCTAssertEqual(down.position, 0.98, accuracy: 1e-12)
    }

    // MARK: the needle

    func testNeedleLagsThenCatchesUp() {
        var dial = DialPhysics(position: 0.2)
        dial.grab(at: 0)
        dial.drag(by: 0.1, at: 0.01)
        dial.step(dt: frame)
        // One frame later the needle has moved, but not all the way.
        XCTAssertGreaterThan(dial.needlePosition, 0.2)
        XCTAssertLessThan(dial.needlePosition, 0.3)

        for _ in 0..<60 { dial.step(dt: frame) }   // a second later
        XCTAssertEqual(dial.needlePosition, 0.3, accuracy: 1e-6)
    }

    func testNeedleDoesNotSwingTheLongWayAcrossTheSeam() {
        var dial = DialPhysics(position: 0.99)
        dial.grab(at: 0)
        dial.drag(by: 0.02, at: 0.01)   // wheel now at 0.01, across the seam
        for _ in 0..<5 {
            dial.step(dt: frame)
            // The needle should always be within 0.02 of the wheel, never off near 0.5.
            XCTAssertLessThanOrEqual(Band.distance(dial.needlePosition, dial.position), 0.02 + 1e-9)
        }
    }

    func testALateFrameDoesNotJumpTheNeedle() {
        var dial = DialPhysics(position: 0.2)
        dial.grab(at: 0)
        dial.drag(by: 0.1, at: 0.01)
        dial.step(dt: 5.0)   // app came back from the background
        XCTAssertLessThan(dial.needlePosition, 0.3, "a capped step still leaves some lag")
    }
}

final class DialFormTests: XCTestCase {

    func testThumbwheelUsesSidewaysMotionOnly() {
        let wheel = Thumbwheel(bandPerPoint: 0.001)
        XCTAssertEqual(wheel.bandDelta(from: [0, 0], to: [100, 0]), 0.1, accuracy: 1e-12)
        XCTAssertEqual(wheel.bandDelta(from: [100, 0], to: [0, 0]), -0.1, accuracy: 1e-12)
        XCTAssertEqual(wheel.bandDelta(from: [0, 0], to: [0, 300]), 0)
        XCTAssertEqual(wheel.bandDelta(from: [0, 0], to: [50, 80]), 0.05, accuracy: 1e-12)
    }

    func testNegativeGearingFlipsDirection() {
        let wheel = Thumbwheel(bandPerPoint: -0.001)
        XCTAssertEqual(wheel.bandDelta(from: [0, 0], to: [100, 0]), -0.1, accuracy: 1e-12)
    }
}

final class DetentTests: XCTestCase {

    func testNoTickInsideOneDetent() {
        var d = DetentCounter(startingAt: 0.001, perBand: 100)   // detents every 0.01
        XCTAssertEqual(d.update(rotation: 0.005), 0)
        XCTAssertEqual(d.update(rotation: 0.009), 0)
    }

    func testOneTickPerDetentEitherWay() {
        var d = DetentCounter(startingAt: 0.005, perBand: 100)
        XCTAssertEqual(d.update(rotation: 0.015), 1)
        XCTAssertEqual(d.update(rotation: 0.025), 1)
        XCTAssertEqual(d.update(rotation: 0.015), 1)   // back down
    }

    func testFastSpinCrossesSeveralInOneFrame() {
        var d = DetentCounter(startingAt: 0.005, perBand: 100)
        XCTAssertEqual(d.update(rotation: 0.055), 5)
    }

    func testTheSeamIsJustAnotherDetent() {
        // 0.995 → 1.005 (that is, 0.005 on the band) crosses exactly one tick, at the seam.
        var d = DetentCounter(startingAt: 0.995, perBand: 100)
        XCTAssertEqual(d.update(rotation: 1.005), 1)
        XCTAssertEqual(d.update(rotation: 0.995), 1)
    }

    func testAFullTripAroundIsPerBandTicks() {
        var d = DetentCounter(startingAt: 0.0005, perBand: 205)
        XCTAssertEqual(d.update(rotation: 1.0005), 205)
    }
}
