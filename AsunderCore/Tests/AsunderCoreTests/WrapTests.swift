import XCTest
@testable import AsunderCore

final class WrapTests: XCTestCase {
    func testInsideTheLoopIsUnchanged() {
        XCTAssertEqual(wrapUnit(0.0), 0.0)
        XCTAssertEqual(wrapUnit(0.5), 0.5)
    }

    func testPastTheEndWrapsToTheStart() {
        XCTAssertEqual(wrapUnit(1.0), 0.0)
        XCTAssertEqual(wrapUnit(1.25), 0.25, accuracy: 1e-12)
        XCTAssertEqual(wrapUnit(3.0), 0.0)
    }

    func testBeforeTheStartWrapsToTheEnd() {
        XCTAssertEqual(wrapUnit(-0.1), 0.9, accuracy: 1e-12)
        XCTAssertEqual(wrapUnit(-1.0), 0.0)
    }

    func testTinyNegativeNeverReturnsOne() {
        // -1e-20 + 1 rounds to exactly 1.0 in floating point; must still land in 0..<1.
        let r = wrapUnit(-1e-20)
        XCTAssertTrue(r >= 0 && r < 1)
    }
}
