import Testing
import CoreGraphics
@testable import souvenir

@Suite("Hybrid Layout Tests")
struct TestsHybridLayoutTests {
    @Test("Uses one column below two-card threshold")
    func testColumnCountSingle() {
        #expect(SvnrHybridLayout.columnCount(for: 815, isLandscape: false) == 1)
    }

    @Test("Uses two columns at two-card threshold")
    func testColumnCountDouble() {
        #expect(SvnrHybridLayout.columnCount(for: 816, isLandscape: false) == 2)
    }

    @Test("Uses two columns in landscape even below threshold")
    func testColumnCountLandscape() {
        #expect(SvnrHybridLayout.columnCount(for: 760, isLandscape: true) == 2)
    }

    @Test("Capsule width is capped at 384")
    func testCapsuleWidthCap() {
        #expect(SvnrHybridLayout.capsuleWidth(for: 1200, isLandscape: false) == 384)
    }

    @Test("Two-column width resolves to 384 at threshold")
    func testThresholdWidth() {
        #expect(SvnrHybridLayout.capsuleWidth(for: 816, isLandscape: false) == 384)
    }
}
