// swift-tools-version: 5.9
//
// AsunderCore holds the pure logic of the receiver: the band, the clock,
// the dial physics, and every "feel" constant in Tuning.swift.
//
// Nothing in here touches the screen, the speaker, or the haptic engine.
// That keeps it testable on any machine (including Linux CI) and keeps
// the rules every phone must agree on in one place.

import PackageDescription

let package = Package(
    name: "AsunderCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "AsunderCore", targets: ["AsunderCore"]),
    ],
    targets: [
        .target(name: "AsunderCore"),
        .testTarget(name: "AsunderCoreTests", dependencies: ["AsunderCore"]),
    ]
)
