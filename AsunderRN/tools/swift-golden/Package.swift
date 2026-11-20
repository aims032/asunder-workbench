// swift-tools-version: 5.9
//
// A tiny command-line tool that asks the ORIGINAL Swift code (AsunderCore) for
// its answers and writes them to a JSON file. The TypeScript tests then check
// that the React Native port gives the same answers (SwiftParity.test.ts).
//
// Run it from the AsunderRN folder with:   npm run golden
// You only need to re-run it when the Swift core changes.

import PackageDescription

let package = Package(
    name: "SwiftGolden",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(path: "../../../AsunderCore"),
    ],
    targets: [
        .executableTarget(
            name: "SwiftGolden",
            dependencies: [.product(name: "AsunderCore", package: "AsunderCore")]
        ),
    ]
)
