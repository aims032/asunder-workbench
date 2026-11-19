import Foundation
@testable import AsunderCore

// Small measuring tools for the sound tests.

let testSampleRate = 48_000.0

/// Root-mean-square level: the average loudness of a signal.
func rms<S: Sequence>(_ samples: S) -> Double where S.Element: BinaryFloatingPoint {
    var sum = 0.0, n = 0
    for s in samples { sum += Double(s) * Double(s); n += 1 }
    return n == 0 ? 0 : (sum / Double(n)).squareRoot()
}

func peak(_ samples: [Float]) -> Double {
    Double(samples.map { abs($0) }.max() ?? 0)
}

func decibels(_ ratio: Double) -> Double { 20 * log10(ratio) }

/// How loud a signal is in a narrow band around `hz` (a resonant band-pass filter).
func bandLevel(_ samples: [Double], at hz: Double, q: Double = 1.4) -> Double {
    var filter = StateVariableFilter()
    filter.setCutoff(hz, resonance: q, sampleRate: testSampleRate)
    // Skip the first 0.1 s while the filter settles.
    let settled = samples.map { filter.process($0).band }.dropFirst(Int(testSampleRate / 10))
    return rms(settled)
}

/// A brightness measure: 0 for very dull sounds, ~1 for white noise.
/// (One minus how alike each sample is to the one before it.)
func brightness(_ samples: [Float]) -> Double {
    var same = 0.0, total = 0.0
    for i in 1..<samples.count {
        same += Double(samples[i]) * Double(samples[i - 1])
        total += Double(samples[i]) * Double(samples[i])
    }
    return 1 - same / total
}

/// A UTC moment from a string like "2026-11-18 12:00:00".
func utc(_ s: String) -> Date {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd HH:mm:ss"
    return f.date(from: s)!
}

// Known days, counted from the placeholder epoch (Sunday 1 Nov 2026).
// Week 0 runs P = [W, L, S, R, W, S, L], so:
let movingMidday = utc("2026-11-01 12:00:00")   // Sunday, W
let stillMidday = utc("2026-11-03 12:00:00")    // Tuesday, S
let movingToStillTurn = utc("2026-11-03 00:00:00")  // Monday (L) turns into Tuesday (S)
