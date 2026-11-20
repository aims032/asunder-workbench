import Foundation
@testable import AsunderCore

// Writes reference answers from the Swift core to a JSON file.
// Usage: swift run SwiftGolden <output.json>
//
// Every section below feeds fixed inputs to one part of AsunderCore and
// records what comes out. Nothing here is random and nothing reads the clock,
// so running it twice gives the same file.

var golden: [String: Any] = [:]

/// A UInt64 as 16 hex digits. JSON numbers can't hold 64-bit integers exactly.
func hex(_ value: UInt64) -> String {
    let text = String(value, radix: 16)
    return String(repeating: "0", count: 16 - text.count) + text
}

/// A handy deterministic "wiggle": different every index, no randomness.
func wiggle(_ i: Int) -> Double {
    sin(Double(i) * 12.9898) * 0.5 + sin(Double(i) * 78.233) * 0.5
}

// MARK: Tuning and World (so a changed constant shows up as a clear failure)

golden["tuning"] = [
    "notchesPerLap": Tuning.notchesPerLap,
    "detentSpacing": Tuning.detentSpacing,
    "pointsPerDetent": Tuning.pointsPerDetent,
    "flickSmoothing": Tuning.flickSmoothing,
    "maxFlickSpeed": Tuning.maxFlickSpeed,
    "coastFriction": Tuning.coastFriction,
    "settleSpeed": Tuning.settleSpeed,
    "settleRate": Tuning.settleRate,
    "snapToFeature": Tuning.snapToFeature,
    "needleLag": Tuning.needleLag,
    "maxFrameStep": Tuning.maxFrameStep,
    "maxTicksPerSecond": Tuning.maxTicksPerSecond,
    "tickIntensity": Double(Tuning.tickIntensity),
    "tickSharpness": Double(Tuning.tickSharpness),
    "tickSoftenSpeed": Tuning.tickSoftenSpeed,
    "tickStrengthSteps": Tuning.tickStrengthSteps.map { Double($0) },
    "lockIntensity": Double(Tuning.lockIntensity),
    "lockSharpness": Double(Tuning.lockSharpness),
    "lockDuration": Tuning.lockDuration,
    "lockDistance": Tuning.lockDistance,
    "lockRelease": Tuning.lockRelease,
    "staticVolume": Tuning.staticVolume,
    "hotStatic": [Tuning.hotStatic.white, Tuning.hotStatic.pink, Tuning.hotStatic.brown, Tuning.hotStatic.level],
    "coldStatic": [Tuning.coldStatic.white, Tuning.coldStatic.pink, Tuning.coldStatic.brown, Tuning.coldStatic.level],
    "closedHighpassHz": Tuning.closedHighpassHz,
    "openHighpassHz": Tuning.openHighpassHz,
    "closedLowpassHz": Tuning.closedLowpassHz,
    "openLowpassHz": Tuning.openLowpassHz,
    "receiverResonance": Tuning.receiverResonance,
    "carrierVolume": Tuning.carrierVolume,
    "carrierWidth": Tuning.carrierWidth,
    "clearWidth": Tuning.clearWidth,
    "carrierQuieting": Tuning.carrierQuieting,
    "whistleHzPerDetent": Tuning.whistleHzPerDetent,
    "humHz": Tuning.humHz,
    "carrierSecondHarmonic": Tuning.carrierSecondHarmonic,
    "carrierThirdHarmonic": Tuning.carrierThirdHarmonic,
    "humBoost": Tuning.humBoost,
    "soundFollowTime": Tuning.soundFollowTime,
    "powerOnFade": Tuning.powerOnFade,
    "audioBufferSeconds": Tuning.audioBufferSeconds,
] as [String: Any]

golden["world"] = [
    "epoch": World.epoch.timeIntervalSince1970,
    "dayTurnHourUTC": World.dayTurnHourUTC,
    "weekPattern": World.weekPattern.map { $0.rawValue },
    "weeklyAdvance": World.weeklyAdvance,
    "carrierPosition": World.carrierPosition.value,
    "carrierDropoutSeconds": World.carrierDropoutSeconds,
    "temperatureGlideSeconds": World.temperatureGlideSeconds,
] as [String: Any]

// MARK: Wrap and band

let wrapInputs: [Double] = [0, 0.25, 1, 1.25, -0.1, 3.0, -3.0, -0.0, 0.999999999999, 1e-17, -1e-17,
                            123456.789, -123456.789, 0.5, -0.5, 2.5, -2.5]
golden["wrapUnit"] = wrapInputs.map { ["in": $0, "out": wrapUnit($0)] }

let integerInputs: [[Int]] = [[0, 7], [1, 7], [-1, 7], [-7, 7], [-8, 7], [13, 7], [14, 7], [-15, 7], [100, 3], [-100, 3]]
golden["integerHelpers"] = integerInputs.map {
    ["a": $0[0], "n": $0[1], "positiveModulo": positiveModulo($0[0], $0[1]), "floorDivide": floorDivide($0[0], $0[1])]
}

let bandPairs: [[Double]] = [[0.95, 0.05], [0.05, 0.95], [0.2, 0.7], [0.7, 0.2], [0, 0.5], [0.5, 0], [0.1, 0.1],
                             [1.2, -0.3], [0.25, 0.7500001], [0.9999, 0.0001]]
golden["bandDistance"] = bandPairs.map {
    ["from": $0[0], "to": $0[1],
     "fromWrapped": BandPosition($0[0]).value,
     "distance": BandPosition($0[0]).distance(to: BandPosition($0[1])),
     "moved": BandPosition($0[0]).moved(by: $0[1]).value]
}

let bellInputs: [[Double]] = [[0, 4], [1, 4], [4, 4], [-4, 4], [12, 4], [0.3, 0.6], [0, 0], [0.1, 0], [2, -1]]
golden["bellStrength"] = bellInputs.map {
    ["distance": $0[0], "width": $0[1], "out": bellStrength(distance: $0[0], width: $0[1])]
}

// MARK: Displays

func displayDump(_ display: BandDisplay) -> [String: Any] {
    let samples = stride(from: 0, to: 401, by: 1).map { Double($0) / 401.0 } + [0.9999999, 68.0 / 205.0, 0.5]
    return [
        "samples": samples.map { p -> [String: Any] in
            let position = BandPosition(p)
            return ["position": p, "frequency": display.frequency(at: position),
                    "label": display.label(at: position), "unit": display.unit(at: position)]
        },
        "scaleMarks": display.scaleMarks().map { mark -> [String: Any] in
            ["position": mark.position.value, "label": mark.label ?? NSNull()]
        },
    ]
}
golden["spectrumDisplay"] = displayDump(SpectrumDisplay())
golden["fmBandDisplay"] = displayDump(FMBandDisplay())

let readoutInputs: [Double] = [3e3, 9999.6, 9.9996e3, 99996, 999.96e3, 999.96e6, 1e6, 19.93e6, 172.8e9, 1e12,
                               999.96e12, 1e15, 5.5e14, 4321, 43210, 432100, 1234567890]
golden["readout"] = readoutInputs.map { hz -> [String: Any] in
    let r = SpectrumDisplay.readout(hz: hz)
    return ["hz": hz, "number": r.number, "unit": r.unit, "short": SpectrumDisplay.shortLabel(hz: hz)]
}
let spectrum = SpectrumDisplay()
golden["spectrumPositionOfHz"] = [3e3, 1e4, 19.93e6, 1e9, 5e14, 9.99e14].map {
    ["hz": $0, "position": spectrum.position(ofHz: $0).value]
}
golden["spectrumDecades"] = spectrum.decades

// MARK: Clock

let epochSeconds = World.epoch.timeIntervalSince1970
let clockOffsets: [Double] = [
    0, 1, -1, 0.5, -0.5, 86_399, 86_400, 86_401, -86_400, -86_401, 3 * 86_400 + 12 * 3_600,
    6 * 86_400 + 86_399.999, 7 * 86_400, 7 * 86_400 - 0.001, 17 * 86_400 + 40_000, 48 * 86_400, 49 * 86_400,
    -49 * 86_400, -50 * 86_400 - 1, 365 * 86_400 + 1234.5, 1.5, 1.4999, 29.9, 30, 30.1, 15,
    2 * 86_400 + 15, 3 * 86_400 + 15, 2 * 86_400 + 1.5, 5 * 86_400 + 29.999,
]
func clockDump(_ clock: AsunderClock) -> [[String: Any]] {
    clockOffsets.map { offset -> [String: Any] in
        let date = Date(timeIntervalSince1970: epochSeconds + offset)
        return [
            "seconds": epochSeconds + offset,
            "dayIndex": clock.dayIndex(at: date),
            "dayOfWeek": clock.dayOfWeek(at: date),
            "weeksSinceEpoch": clock.weeksSinceEpoch(at: date),
            "dayProgress": clock.dayProgress(at: date),
            "secondsIntoDay": clock.secondsIntoDay(at: date),
            "rule": clock.rule(at: date).rawValue,
            "isStill": clock.isStill(at: date),
            "carrierOnAir": Carrier.isOnAir(at: date, clock: clock),
            "temperature": NoiseTemperature.at(date, clock: clock),
        ]
    }
}
golden["clockDefault"] = clockDump(AsunderClock())
golden["clockTurnAtFive"] = clockDump(AsunderClock(epoch: World.epoch, dayTurnHourUTC: 5))

var ruleTable: [[String: Any]] = []
for week in -8...16 {
    for day in 0..<7 {
        ruleTable.append(["k": day, "w": week, "rule": AsunderClock.rule(dayOfWeek: day, week: week).rawValue])
    }
}
golden["ruleTable"] = ruleTable

// MARK: Dial physics
// Each scenario is a list of steps. A step is one of:
//   ["grab"], ["release"], ["drag", delta], ["step", dt]
// After every step the whole visible state is recorded.

func runDial(start: Double, snap: [Double], script: [[Any]]) -> [String: Any] {
    var dial = DialPhysics(start: start)
    dial.snapPoints = snap.map { BandPosition($0) }
    var rows: [[String: Any]] = []
    for step in script {
        switch step[0] as! String {
        case "grab": dial.grab()
        case "release": dial.release()
        case "drag": dial.drag(by: step[1] as! Double)
        case "step": dial.step(step[1] as! Double)
        default: fatalError("unknown step")
        }
        rows.append([
            "position": dial.position, "velocity": dial.velocity, "needle": dial.needle,
            "isHeld": dial.isHeld, "isAtRest": dial.isAtRest, "detentIndex": dial.detentIndex,
            "band": dial.band.value, "needleBand": dial.needleBand.value,
        ])
    }
    return ["start": start, "snap": snap, "script": script, "rows": rows]
}

let spacing = Tuning.detentSpacing
let frame60 = 1.0 / 60.0
let frame120 = 1.0 / 120.0

/// Hold the wheel and move it `perFrame` detents each frame for `frames` frames.
func dragFrames(_ frames: Int, perFrame: Double, dt: Double) -> [[Any]] {
    (0..<frames).flatMap { _ in [["drag", perFrame * spacing] as [Any], ["step", dt] as [Any]] }
}
func coast(_ frames: Int, dt: Double) -> [[Any]] {
    (0..<frames).map { _ in ["step", dt] as [Any] }
}

var dialScenarios: [String: Any] = [:]
dialScenarios["slowDragThenRelease"] = runDial(start: 0.5, snap: [],
    script: [["grab"]] + dragFrames(30, perFrame: 0.04, dt: frame60) + [["release"]] + coast(90, dt: frame60))
dialScenarios["flickForward"] = runDial(start: 0.5, snap: [],
    script: [["grab"]] + dragFrames(8, perFrame: 3.5, dt: frame120) + [["release"]] + coast(900, dt: frame120))
dialScenarios["flickBackwardAcrossZero"] = runDial(start: 0.001, snap: [],
    script: [["grab"]] + dragFrames(8, perFrame: -2.2, dt: frame60) + [["release"]] + coast(500, dt: frame60))
dialScenarios["hardFlickHitsSpeedLimit"] = runDial(start: 0.25, snap: [],
    script: [["grab"]] + dragFrames(6, perFrame: 30, dt: frame120) + [["release"]] + coast(1200, dt: frame120))
dialScenarios["stopThenLift"] = runDial(start: 0.5, snap: [],
    script: [["grab"]] + dragFrames(10, perFrame: 2, dt: frame60) + coast(20, dt: frame60) + [["release"]] + coast(60, dt: frame60))
dialScenarios["grabWhileCoasting"] = runDial(start: 0.5, snap: [],
    script: [["grab"]] + dragFrames(8, perFrame: 3, dt: frame60) + [["release"]] + coast(20, dt: frame60)
        + [["grab"]] + coast(5, dt: frame60) + [["release"]] + coast(40, dt: frame60))
let carrier = World.carrierPosition.value
dialScenarios["settlesOntoCarrier"] = runDial(start: carrier - 6.4 * spacing, snap: [carrier],
    script: [["grab"]] + dragFrames(20, perFrame: 0.3, dt: frame60) + [["release"]] + coast(120, dt: frame60))
dialScenarios["coastsOntoCarrierFromAbove"] = runDial(start: carrier + 40.3 * spacing, snap: [carrier],
    script: [["grab"]] + dragFrames(6, perFrame: -1.1, dt: frame60) + [["release"]] + coast(900, dt: frame60))
dialScenarios["snapOnALaterLap"] = runDial(start: 2 + carrier + 0.6 * spacing, snap: [carrier, 0.9],
    script: [["grab"], ["step", frame60], ["release"]] + coast(120, dt: frame60))
dialScenarios["stalledFrames"] = runDial(start: 0.5, snap: [],
    script: [["grab"]] + dragFrames(5, perFrame: 4, dt: frame60) + [["release"], ["step", 0.5], ["step", 0.0], ["step", -1.0]]
        + coast(200, dt: 1.0 / 30.0))
golden["dial"] = dialScenarios

golden["detentIndexOf"] = [0.0, 0.5 * spacing, -0.5 * spacing, 1.5 * spacing, -1.5 * spacing, 2.4999 * spacing,
                           -2.5 * spacing, 0.5, 3.25, -3.25, 1000.5 * spacing, -1000.5 * spacing].map {
    ["position": $0, "index": DialPhysics.detentIndex(of: $0)]
}

// MARK: Lock detector

let lockRuns: [[Double]] = [
    [5, 3, 1, 0.3, 0.2, 0.1, 0, 0, 0.5, 0.8, 0.2, 2, 0.1],
    [8, 4, -3, -9, -4, 3, 0.2, -0.2, 0.9, -0.9, 0.1],
    [1100, -1100, 1100, 0.5, -0.5, 0.26, 0.25, 0.76, 0.75, 0.24],
    [0, 0, 1, 0, -1, 0, 0.74, 0.76, 0],
    [-0.0, 0.0, 600, -600, 574, -574, 575.1, -575.1],
]
golden["lockDetector"] = lockRuns.map { run -> [String: Any] in
    var lock = LockDetector()
    var fired: [Bool] = []
    var locked: [Bool] = []
    for distance in run {
        fired.append(lock.update(detentsAway: distance))
        locked.append(lock.isLocked)
    }
    return ["distances": run, "fired": fired, "isLocked": locked]
}

// MARK: Noise

let seeds: [UInt64] = [0, 1, 2, 42, 0xFFFF_FFFF, 0x1_0000_0000, 1_763_600_000_123, 9_007_199_254_740_991]
golden["noiseRandom"] = seeds.map { seed -> [String: Any] in
    var raw = NoiseRandom(seed: seed)
    var signed = NoiseRandom(seed: seed)
    return ["seed": Double(seed),
            "next": (0..<24).map { _ in hex(raw.next()) },
            "nextSigned": (0..<24).map { _ in signed.nextSigned() }]
}

golden["noiseSource"] = [UInt64(42), UInt64(1_763_600_000_123)].map { seed -> [String: Any] in
    var source = NoiseSource(seed: seed)
    var white: [Double] = [], pink: [Double] = [], brown: [Double] = []
    for _ in 0..<512 {
        let s = source.next()
        white.append(s.white); pink.append(s.pink); brown.append(s.brown)
    }
    return ["seed": Double(seed), "white": white, "pink": pink, "brown": brown]
}

let colorCases: [NoiseColor] = [
    Tuning.hotStatic, Tuning.coldStatic,
    NoiseColor(white: 0.5, pink: 0.5, brown: 0, level: 1),
    NoiseColor(white: 1, pink: 1, brown: 0, level: 1),
    NoiseColor(white: 0, pink: 0, brown: 0, level: 1),
    NoiseColor(white: 0.2, pink: 0.3, brown: 0.9, level: 0.37),
]
golden["noiseColorGains"] = colorCases.map { c -> [String: Any] in
    let g = c.gains
    return ["color": [c.white, c.pink, c.brown, c.level], "gains": [g.white, g.pink, g.brown]]
}
golden["noiseColorBetween"] = [0.0, 0.25, 0.5, 0.9, 1.0].map { t -> [String: Any] in
    let c = NoiseColor.between(Tuning.coldStatic, Tuning.hotStatic, t)
    return ["t": t, "color": [c.white, c.pink, c.brown, c.level]]
}

// MARK: Filters

let filterCases: [[Double]] = [  // cutoff Hz, resonance, sample rate
    [1_000, 0.707, 48_000], [140, 0.8, 48_000], [12_000, 0.8, 44_100], [5, 0.8, 48_000],
    [30_000, 0.8, 48_000], [4_500, 0.05, 48_000], [45, 4, 44_100],
]
golden["filter"] = filterCases.map { c -> [String: Any] in
    var filter = StateVariableFilter()
    filter.setCutoff(c[0], resonance: c[1], sampleRate: c[2])
    var low: [Double] = [], band: [Double] = [], high: [Double] = []
    for i in 0..<256 {
        let out = filter.process(i == 0 ? 1.0 : wiggle(i))
        low.append(out.low); band.append(out.band); high.append(out.high)
    }
    return ["hz": c[0], "resonance": c[1], "sampleRate": c[2], "low": low, "band": band, "high": high]
}
// The default filter (never told a cutoff), and one swept while running.
do {
    var filter = StateVariableFilter()
    golden["filterDefault"] = (0..<64).map { filter.process(wiggle($0)).low }
    var swept = StateVariableFilter()
    var out: [Double] = []
    for i in 0..<512 {
        if i % 16 == 0 { swept.setCutoff(200 + Double(i) * 20, resonance: 0.8, sampleRate: 48_000) }
        out.append(swept.process(wiggle(i)).high)
    }
    golden["filterSwept"] = out
}

golden["smoothed"] = [[0.0, 0.015, 48_000.0, 1.0], [5.0, 0.4, 44_100.0, -2.0], [1.0, 0.0, 48_000.0, 3.0], [0.0, -1.0, 48_000.0, 3.0]].map { c -> [String: Any] in
    var s = Smoothed(c[0], seconds: c[1], sampleRate: c[2])
    return ["start": c[0], "seconds": c[1], "sampleRate": c[2], "target": c[3],
            "values": (0..<64).map { _ in s.step(toward: c[3]) }]
}

// MARK: Carrier

let dialPlaces: [Double] = [carrier, carrier + 0.5 * spacing, carrier - 0.5 * spacing, carrier + 3 * spacing,
                            carrier - 10 * spacing, 0, 0.5, 0.999, carrier + 0.5, carrier - 0.4999, 7.25 + carrier]
golden["carrierDetentsAway"] = dialPlaces.map {
    ["dial": $0, "detents": Carrier.detentsAway(from: BandPosition($0))]
}
golden["carrierCurves"] = [0.0, 0.25, -0.25, 0.6, 1, -1, 4, -4, 12, 40, 1150].map {
    ["detents": $0, "strength": Carrier.strength(detentsAway: $0),
     "clarity": Carrier.clarity(detentsAway: $0), "pitch": Carrier.pitch(detentsAway: $0)]
}
golden["carrierOscillator"] = [[165.0, 48_000.0], [1_565.0, 44_100.0], [9_000.0, 48_000.0], [15_000.0, 44_100.0], [23_000.0, 48_000.0]].map { c -> [String: Any] in
    var osc = CarrierOscillator()
    return ["pitch": c[0], "sampleRate": c[1], "samples": (0..<256).map { _ in osc.next(pitch: c[0], sampleRate: c[1]) }]
}
do {
    // A pitch that changes every sample, like the whistle sliding as you tune.
    var osc = CarrierOscillator()
    golden["carrierOscillatorSweep"] = (0..<512).map { osc.next(pitch: 165 + Double($0) * 37.5, sampleRate: 48_000) }
}

// MARK: Reception

let receptionTimes: [Double] = [3 * 86_400 + 40_000, 2 * 86_400 + 40_000, 2 * 86_400 + 0.7, 2 * 86_400 + 12,
                                3 * 86_400 + 12, 3 * 86_400 + 1.5, 5 * 86_400 + 29.5, 86_400 * 100.5]
let clock = AsunderClock()
var receptionRows: [[String: Any]] = []
for offset in receptionTimes {
    for dial in dialPlaces {
        let t = Reception.targets(dial: dial, at: Date(timeIntervalSince1970: epochSeconds + offset), clock: clock)
        receptionRows.append([
            "dial": dial, "seconds": epochSeconds + offset,
            "white": t.white, "pink": t.pink, "brown": t.brown,
            "carrierLevel": t.carrierLevel, "carrierPitch": t.carrierPitch,
            "highpassHz": t.highpassHz, "lowpassHz": t.lowpassHz,
        ])
    }
}
golden["reception"] = receptionRows
golden["blendHz"] = [[140.0, 45.0, 0.0], [140.0, 45.0, 0.5], [140.0, 45.0, 1.0], [4_500.0, 12_000.0, 0.3]].map {
    ["a": $0[0], "b": $0[1], "t": $0[2], "out": Reception.blendHz($0[0], $0[1], $0[2])]
}

// MARK: The whole chain
// Render a few buffers while the dial moves, exactly as the app does it:
// new targets each buffer, then render that buffer.

func runChain(sampleRate: Double, seed: UInt64, bufferSize: Int, buffers: Int,
              startDial: Double, dialStepPerBuffer: Double, startSeconds: Double,
              restartFadeAtBuffer: Int?) -> [String: Any] {
    var chain = ReceiverChain(sampleRate: sampleRate, seed: seed)
    var samples: [Double] = []
    for b in 0..<buffers {
        if b == restartFadeAtBuffer { chain.restartFade() }
        let dial = startDial + Double(b) * dialStepPerBuffer
        let seconds = startSeconds + Double(b * bufferSize) / sampleRate
        let targets = Reception.targets(dial: dial, at: Date(timeIntervalSince1970: seconds), clock: clock)
        samples += chain.render(count: bufferSize, targets: targets).map { Double($0) }
    }
    return ["sampleRate": sampleRate, "seed": Double(seed), "bufferSize": bufferSize, "buffers": buffers,
            "startDial": startDial, "dialStepPerBuffer": dialStepPerBuffer, "startSeconds": startSeconds,
            "restartFadeAtBuffer": restartFadeAtBuffer.map { $0 as Any } ?? NSNull(), "samples": samples]
}

golden["chain"] = [
    // Sitting dead on the Carrier on a moving day.
    runChain(sampleRate: 48_000, seed: 7, bufferSize: 128, buffers: 48, startDial: carrier,
             dialStepPerBuffer: 0, startSeconds: epochSeconds + 3 * 86_400 + 40_000, restartFadeAtBuffer: nil),
    // Tuning through the Carrier from 12 notches below to 12 above.
    runChain(sampleRate: 48_000, seed: 1_763_600_000_123, bufferSize: 128, buffers: 96,
             startDial: carrier - 12 * spacing, dialStepPerBuffer: 0.25 * spacing,
             startSeconds: epochSeconds + 3 * 86_400 + 40_000, restartFadeAtBuffer: nil),
    // A Still day, far from anything, at 44.1 kHz with an odd buffer size, with a fade restart.
    runChain(sampleRate: 44_100, seed: 99, bufferSize: 441, buffers: 20, startDial: 0.8123,
             dialStepPerBuffer: 0.003, startSeconds: epochSeconds + 2 * 86_400 + 40_000, restartFadeAtBuffer: 10),
    // Across a day turn: the dropout and the start of the temperature glide.
    runChain(sampleRate: 48_000, seed: 3, bufferSize: 480, buffers: 30, startDial: carrier + 1.5 * spacing,
             dialStepPerBuffer: 0, startSeconds: epochSeconds + 3 * 86_400 - 0.1, restartFadeAtBuffer: nil),
]

// MARK: Write the file

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write("usage: SwiftGolden <output.json>\n".data(using: .utf8)!)
    exit(2)
}
let data = try JSONSerialization.data(withJSONObject: golden, options: [.sortedKeys])
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("Wrote \(data.count) bytes to \(CommandLine.arguments[1])")
