import XCTest
@testable import AsunderCore

final class ReceptionTests: XCTestCase {
    let clock = AsunderClock()
    let center = World.carrierPosition.value
    let farAway = World.carrierPosition.value + 0.4

    func targets(_ dial: Double, _ date: Date = movingMidday) -> ReceiverTargets {
        Reception.targets(dial: dial, at: date, clock: clock)
    }

    func staticLoudness(_ t: ReceiverTargets) -> Double {
        (t.white * t.white + t.pink * t.pink + t.brown * t.brown).squareRoot()
    }

    // MARK: Temperature follows the clock

    func testHotOnMovingDaysColdOnStillDays() {
        XCTAssertEqual(NoiseTemperature.at(movingMidday, clock: clock), 1)
        XCTAssertEqual(NoiseTemperature.at(stillMidday, clock: clock), 0)
    }

    func testTemperatureGlidesAfterTheTurn() {
        let turn = movingToStillTurn
        XCTAssertEqual(NoiseTemperature.at(turn.addingTimeInterval(-1), clock: clock), 1, "still hot before the turn")
        XCTAssertEqual(NoiseTemperature.at(turn, clock: clock), 1, accuracy: 1e-9, "the glide starts at yesterday's")
        XCTAssertEqual(NoiseTemperature.at(turn.addingTimeInterval(World.temperatureGlideSeconds / 2), clock: clock), 0.5, accuracy: 1e-9)
        XCTAssertEqual(NoiseTemperature.at(turn.addingTimeInterval(World.temperatureGlideSeconds), clock: clock), 0)
    }

    func testStillDayStaticIsQuieterAndDarker() {
        let hot = targets(farAway, movingMidday)
        let cold = targets(farAway, stillMidday)
        XCTAssertLessThan(staticLoudness(cold), staticLoudness(hot))
        XCTAssertGreaterThan(hot.white / hot.brown, cold.white / cold.brown)
    }

    // MARK: The dial

    func testFarFromTheCarrierItsSilentAndTheEQIsClosed() {
        let t = targets(farAway)
        XCTAssertEqual(t.carrierLevel, 0, accuracy: 1e-9)
        XCTAssertEqual(t.highpassHz, Tuning.closedHighpassHz, accuracy: 0.01)
        XCTAssertEqual(t.lowpassHz, Tuning.closedLowpassHz, accuracy: 0.01)
    }

    func testDeadOnTheCarrierTheEQOpensAndTheHissQuiets() {
        let on = targets(center), off = targets(farAway)
        XCTAssertEqual(on.carrierLevel, Tuning.carrierVolume * (1 + Tuning.humBoost), accuracy: 1e-9)
        XCTAssertEqual(on.carrierPitch, Tuning.humHz, accuracy: 1e-9)
        XCTAssertEqual(on.highpassHz, Tuning.openHighpassHz, accuracy: 0.01)
        XCTAssertEqual(on.lowpassHz, Tuning.openLowpassHz, accuracy: 0.01)
        XCTAssertEqual(staticLoudness(on) / staticLoudness(off), 1 - Tuning.carrierQuieting, accuracy: 1e-9)
    }

    func testOneNotchOffIsHeardButNotClear() {
        let t = targets(center + Tuning.detentSpacing)
        XCTAssertGreaterThan(t.carrierLevel, 0.5 * Tuning.carrierVolume)
        XCTAssertLessThan(t.lowpassHz, Reception.blendHz(Tuning.closedLowpassHz, Tuning.openLowpassHz, 0.5))
        XCTAssertEqual(t.carrierPitch, Tuning.humHz + Tuning.whistleHzPerDetent, accuracy: 1e-6)
    }

    func testTheLoopHasNoSeam() {
        // An unwrapped dial (laps on, or laps back) hears the same thing,
        // give or take floating-point rounding.
        for (a, b) in [(center + 3, center), (center - 2 + 0.01, center + 0.01)] {
            let ta = targets(a), tb = targets(b)
            XCTAssertEqual(ta.carrierLevel, tb.carrierLevel, accuracy: 1e-9)
            XCTAssertEqual(ta.carrierPitch, tb.carrierPitch, accuracy: 1e-6)
            XCTAssertEqual(ta.lowpassHz, tb.lowpassHz, accuracy: 1e-6)
            XCTAssertEqual(ta.white, tb.white, accuracy: 1e-9)
        }
    }

    // MARK: The day-turn dropout

    func testDuringTheDropoutTheCarrierIsGoneAndTheEQCloses() {
        let turn = utc("2026-11-18 00:00:00")
        let during = targets(center, turn.addingTimeInterval(0.5))
        XCTAssertEqual(during.carrierLevel, 0)
        XCTAssertEqual(during.lowpassHz, Tuning.closedLowpassHz, accuracy: 0.01)
        let after = targets(center, turn.addingTimeInterval(World.carrierDropoutSeconds + 0.5))
        XCTAssertEqual(after.carrierLevel, Tuning.carrierVolume * (1 + Tuning.humBoost), accuracy: 1e-9)
    }

    /// The day-turn hour is Open. If it moves, the dropout and the glide must
    /// follow the turn, not UTC midnight.
    func testDropoutAndGlideFollowAMovedDayTurn() {
        let late = AsunderClock(dayTurnHourUTC: 5)
        let midnight = utc("2026-11-18 00:00:00")
        let turn = utc("2026-11-18 05:00:00")
        XCTAssertEqual(late.secondsIntoDay(at: turn), 0, accuracy: 1e-6)
        XCTAssertTrue(Carrier.isOnAir(at: midnight.addingTimeInterval(0.5), clock: late), "midnight is nothing special")
        XCTAssertFalse(Carrier.isOnAir(at: turn.addingTimeInterval(0.5), clock: late))

        // Monday (L) into Tuesday (S), at 05:00 instead of 00:00.
        let stillTurn = utc("2026-11-03 05:00:00")
        XCTAssertEqual(NoiseTemperature.at(stillTurn.addingTimeInterval(-1), clock: late), 1)
        XCTAssertEqual(NoiseTemperature.at(stillTurn.addingTimeInterval(World.temperatureGlideSeconds / 2), clock: late),
                       0.5, accuracy: 1e-9)
    }

    // MARK: Helpers

    func testBlendHzIsHalfwayInOctaves() {
        XCTAssertEqual(Reception.blendHz(100, 400, 0.5), 200, accuracy: 1e-9)
        XCTAssertEqual(Reception.blendHz(100, 400, 0), 100, accuracy: 1e-9)
        XCTAssertEqual(Reception.blendHz(100, 400, 1), 400, accuracy: 1e-9)
    }
}
