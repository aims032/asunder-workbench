import XCTest
@testable import AsunderCore

final class ReceiverChainTests: XCTestCase {
    let clock = AsunderClock()
    let center = World.carrierPosition.value
    let farAway = World.carrierPosition.value + 0.4

    /// Two seconds of the radio at a dial position and moment, after it has
    /// warmed up (fade-in done, every control settled).
    func listen(_ dial: Double, _ date: Date = movingMidday, seed: UInt64 = 11) -> [Float] {
        var chain = ReceiverChain(sampleRate: testSampleRate, seed: seed)
        let t = Reception.targets(dial: dial, at: date, clock: clock)
        _ = chain.render(count: Int(testSampleRate), targets: t)
        return chain.render(count: Int(2 * testSampleRate), targets: t)
    }

    /// The same, with the Carrier muted: the static alone, still through the
    /// EQ path exactly as it's set at that dial position.
    func listenToStatic(_ dial: Double, _ date: Date = movingMidday) -> [Float] {
        var chain = ReceiverChain(sampleRate: testSampleRate, seed: 11)
        var t = Reception.targets(dial: dial, at: date, clock: clock)
        t.carrierLevel = 0
        _ = chain.render(count: Int(testSampleRate), targets: t)
        return chain.render(count: Int(2 * testSampleRate), targets: t)
    }

    // MARK: Deterministic

    func testSameSeedSameSound() {
        XCTAssertEqual(listen(farAway, seed: 4), listen(farAway, seed: 4))
        XCTAssertNotEqual(listen(farAway, seed: 4), listen(farAway, seed: 5))
    }

    /// The phone hands the engine buffers of whatever size it likes. The sound
    /// must not depend on how it's cut up.
    func testBufferSizeDoesntChangeTheSound() {
        let t = Reception.targets(dial: center, at: movingMidday, clock: clock)
        var whole = ReceiverChain(sampleRate: testSampleRate, seed: 9)
        var pieces = ReceiverChain(sampleRate: testSampleRate, seed: 9)
        let a = whole.render(count: 4_096, targets: t)
        let b = [100, 1_000, 7, 2_989].flatMap { pieces.render(count: $0, targets: t) }
        XCTAssertEqual(a, b)
    }

    // MARK: Turning on

    func testFadesInFromSilence() {
        var chain = ReceiverChain(sampleRate: testSampleRate, seed: 2)
        let t = Reception.targets(dial: farAway, at: movingMidday, clock: clock)
        let start = chain.render(count: 480, targets: t)  // first 10 ms
        XCTAssertLessThan(peak(start), 0.02)
        _ = chain.render(count: Int(2 * testSampleRate), targets: t)
        XCTAssertGreaterThan(rms(chain.render(count: 48_000, targets: t)), 0.05)
    }

    func testRestartFadeFadesInAgain() {
        var chain = ReceiverChain(sampleRate: testSampleRate, seed: 2)
        let t = Reception.targets(dial: farAway, at: movingMidday, clock: clock)
        _ = chain.render(count: Int(2 * testSampleRate), targets: t)
        chain.restartFade()
        XCTAssertLessThan(peak(chain.render(count: 480, targets: t)), 0.02)
    }

    // MARK: Levels

    func testNeverClipsAtTheDefaultSettings() {
        for date in [movingMidday, stillMidday] {
            for dial in [farAway, center, center + Tuning.detentSpacing, center + 4 * Tuning.detentSpacing] {
                let out = listen(dial, date)
                XCTAssertLessThan(peak(out), 0.9, "dial \(dial) on \(date)")
                XCTAssertTrue(out.allSatisfy { $0.isFinite })
            }
        }
    }

    func testStillDaysAreQuieterAndDarker() {
        let hot = listen(farAway, movingMidday)
        let cold = listen(farAway, stillMidday)
        XCTAssertLessThan(rms(cold), rms(hot) * 0.7, "at least ~3 dB quieter")
        XCTAssertLessThan(brightness(cold), brightness(hot))
    }

    // MARK: Tuning in

    func testTheHumIsHeardDeadOn() {
        let on = listen(center).map(Double.init)
        let off = listen(farAway).map(Double.init)
        XCTAssertGreaterThan(bandLevel(on, at: Tuning.humHz, q: 8), 3 * bandLevel(off, at: Tuning.humHz, q: 8))
    }

    /// Through a phone speaker (which drops everything below ~250 Hz), dead on
    /// must not sound quieter than one notch off: the arrival is a peak, not a dip.
    func testOnAPhoneSpeakerTheCenterIsNotADip() {
        func carrierOnSpeaker(_ dial: Double) -> Double {
            var chain = ReceiverChain(sampleRate: testSampleRate, seed: 1)
            var t = Reception.targets(dial: dial, at: movingMidday, clock: clock)
            t.white = 0; t.pink = 0; t.brown = 0           // the tone alone
            _ = chain.render(count: 24_000, targets: t)
            return rms(speaker(chain.render(count: 96_000, targets: t)))
        }
        let center = carrierOnSpeaker(center)
        let oneOff = carrierOnSpeaker(center + Tuning.detentSpacing)
        XCTAssertGreaterThan(decibels(center / oneOff), -1.5)
    }

    func testTheWhistleIsHeardOneNotchOff() {
        let whistle = Tuning.humHz + Tuning.whistleHzPerDetent
        let near = listen(center + Tuning.detentSpacing).map(Double.init)
        let off = listen(farAway).map(Double.init)
        XCTAssertGreaterThan(bandLevel(near, at: whistle, q: 8), 3 * bandLevel(off, at: whistle, q: 8))
    }

    /// Off-station the EQ path is closed, so the static is dull up top.
    /// Dead on, it opens: the highs (8 kHz) come up against the mids (1 kHz).
    func testStaticIsDullOffStationAndOpensOnTheCarrier() {
        func highsOverMids(_ s: [Float]) -> Double {
            let d = s.map(Double.init)
            return bandLevel(d, at: 8_000) / bandLevel(d, at: 1_000)
        }
        XCTAssertGreaterThan(highsOverMids(listenToStatic(center)), 2 * highsOverMids(listenToStatic(farAway)))
    }

    /// The high-pass half: off-station the lows are cut (thin, on headphones).
    func testStaticIsThinOffStationAndOpensOnTheCarrier() {
        func lowsOverMids(_ s: [Float]) -> Double {
            let d = s.map(Double.init)
            return bandLevel(d, at: 70) / bandLevel(d, at: 1_000)
        }
        XCTAssertGreaterThan(lowsOverMids(listenToStatic(center, stillMidday)),
                             2 * lowsOverMids(listenToStatic(farAway, stillMidday)))
    }

    func testExtremeTargetsStayFinite() {
        var chain = ReceiverChain(sampleRate: testSampleRate, seed: 1)
        let wild = ReceiverTargets(white: 5, pink: 5, brown: 5, carrierLevel: 5, carrierPitch: 30_000,
                                   highpassHz: 0, lowpassHz: 1e9)
        let out = chain.render(count: 48_000, targets: wild)
        XCTAssertTrue(out.allSatisfy { $0.isFinite && abs($0) <= 1 })
    }
}
