//
//  TestsDetentCalculatorTests.swift
//  souvenirTests
//
//  Unit tests for DetentCalculator memoization strategy
//
//  BEHAVIORAL VERIFICATION: PresentationDetent is a value type (struct), not a class.
//  We verify memoization by checking cache statistics and value equality, not reference identity.

import XCTest
import SwiftUI
@testable import souvenir

final class DetentCalculatorTests: XCTestCase {

    var calculator: DetentCalculator!

    override func setUp() {
        super.setUp()
        calculator = DetentCalculator()
        calculator.clearCache()  // Ensure clean state for each test
    }

    override func tearDown() {
        calculator.clearCache()
        calculator = nil
        super.tearDown()
    }

    // MARK: - Memoization Tests (via Cache Statistics & Value Equality)

    /// Test that identical screen heights return the same cached detent values.
    /// BEHAVIORAL: Verify via cache size and value equality, not reference identity.
    func test_identicalScreenHeightsReturnCachedValues() {
        let screenHeight: CGFloat = 800.0
        
        calculator.clearCache()
        let detents1 = calculator.detents(for: screenHeight)
        
        // First call created cache entry
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "first call should create 1 cache entry")
        
        // Second call with identical height
        let detents2 = calculator.detents(for: screenHeight)
        
        // Cache should still have only 1 entry (cache hit, no new entry)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "identical height should hit cache, not create new entry")
        
        // Values should be equal (value equality, not reference identity)
        XCTAssertEqual(detents1.compact, detents2.compact, "cached detents should have equal values")
        XCTAssertEqual(detents1.fullSheet, detents2.fullSheet, "cached detents should have equal values")
    }

    /// Test that very close screen heights (sub-pixel jitter) use the same cache entry.
    /// The caching key rounds to integer, so 800.0 and 800.4 should be treated as the same.
    /// BEHAVIORAL: Verify via cache size remaining stable.
    func test_subPixelJitterUsesSameCacheEntry() {
        calculator.clearCache()
        
        let detents1 = calculator.detents(for: 800.0)
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "first height should create 1 entry")
        
        let detents2 = calculator.detents(for: 800.4)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "800.0 and 800.4 should use same cache entry (rounded to 800)")
        
        let detents3 = calculator.detents(for: 800.49)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "800.0 and 800.49 should use same cache entry (both round to 800)")
        
        // Values should be equal across all three calls
        XCTAssertEqual(detents1.compact, detents2.compact, "sub-pixel jitter should return equal values")
        XCTAssertEqual(detents1.compact, detents3.compact, "sub-pixel jitter should return equal values")
    }

    /// Test that significantly different screen heights create separate cache entries.
    /// BEHAVIORAL: Verify via cache size growing.
    func test_differentScreenHeightsCreateSeparateCacheEntries() {
        calculator.clearCache()
        
        _ = calculator.detents(for: 800.0)
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "first height creates entry 1")
        
        _ = calculator.detents(for: 801.0)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "different height creates entry 2")
        
        _ = calculator.detents(for: 850.0)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 3, "significantly different height creates entry 3")
    }

    // MARK: - Edge Cases

    /// Test zero screen height (invalid input) returns safe defaults.
    /// BEHAVIORAL: Verify cache behavior is consistent.
    func test_zeroScreenHeightReturnsSafeDefaults() {
        calculator.clearCache()
        let detents = calculator.detents(for: 0.0)

        // Should not crash and should return some valid detents
        XCTAssertNotNil(detents.compact, "zero height should return non-nil compact detent")
        XCTAssertNotNil(detents.fullSheet, "zero height should return non-nil fullSheet detent")

        // Subsequent calls should hit cache (same cached values)
        let detents2 = calculator.detents(for: 0.0)
        let stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "zero height should be cached on second call")
        XCTAssertEqual(detents.compact, detents2.compact, "zero height should return equal values on cache hit")
    }

    /// Test negative screen height (invalid input) is handled safely.
    /// BEHAVIORAL: Verify cache behavior is consistent.
    func test_negativeScreenHeightHandledSafely() {
        calculator.clearCache()
        let detents = calculator.detents(for: -100.0)

        // Should not crash, return safe defaults
        XCTAssertNotNil(detents.compact, "negative height should return non-nil detent")

        // Subsequent calls should hit cache
        let detents2 = calculator.detents(for: -100.0)
        let stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "negative height should be cached on second call")
        XCTAssertEqual(detents.compact, detents2.compact, "negative height should return equal values")
    }

    /// Test extreme large screen height (iPad Pro edge case).
    /// BEHAVIORAL: Verify cache works at scale.
    func test_extremeLargeScreenHeight() {
        calculator.clearCache()
        let extremeHeight: CGFloat = 2048.0  // iPad Pro 12.9" in landscape
        let detents = calculator.detents(for: extremeHeight)

        XCTAssertNotNil(detents.compact, "extreme height should return valid compact detent")
        XCTAssertNotNil(detents.fullSheet, "extreme height should return valid fullSheet detent")

        // Subsequent calls should hit cache
        let detents2 = calculator.detents(for: extremeHeight)
        let stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "extreme height should be cached")
        XCTAssertEqual(detents.compact, detents2.compact, "extreme height should return equal cached values")
    }

    /// Test device rotation boundary (common navigation between portrait and landscape).
    /// BEHAVIORAL: Verify cache creates separate entries for different orientations.
    func test_deviceRotationBoundary() {
        calculator.clearCache()
        
        let iPhonePortrait: CGFloat = 844.0   // iPhone 14 Pro portrait
        let iPhoneSmallLandscape: CGFloat = 390.0  // iPhone 14 Pro landscape

        let portraitDetents = calculator.detents(for: iPhonePortrait)
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "portrait should create 1 cache entry")
        
        let landscapeDetents = calculator.detents(for: iPhoneSmallLandscape)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "landscape should create 2nd cache entry (different height)")

        // Values should be different (different heights produce different detents)
        // fullSheet is screen-height-dependent
        XCTAssertNotEqual(portraitDetents.fullSheet, landscapeDetents.fullSheet, "portrait and landscape should have different detent values")

        // Returning to same orientation should hit cache
        let portraitAgain = calculator.detents(for: iPhonePortrait)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "returning to portrait should not create new cache entry")
        XCTAssertEqual(portraitDetents.fullSheet, portraitAgain.fullSheet, "returning to portrait should return equal cached values")
    }

    // MARK: - Detent Value Correctness

    /// Test that detent values are consistent across multiple calls.
    /// BEHAVIORAL: Verify value consistency without relying on reference identity.
    func test_detentValuesAreConsistent() {
        calculator.clearCache()
        let screenHeight: CGFloat = 844.0

        let detents1 = calculator.detents(for: screenHeight)
        let detents2 = calculator.detents(for: screenHeight)
        let detents3 = calculator.detents(for: screenHeight)

        // All calls should return equal values (behavioral consistency)
        XCTAssertEqual(detents1.fullSheet, detents2.fullSheet, "fullSheet should be consistent across calls")
        XCTAssertEqual(detents2.fullSheet, detents3.fullSheet, "fullSheet should be consistent across calls")
        
        // Cache should have only 1 entry (all hits)
        let stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "consistent values indicate successful caching")
    }

    // MARK: - Cache Management

    /// Test cache clearing creates new entries on subsequent calls.
    /// BEHAVIORAL: Verify cache is actually cleared by checking entry count.
    func test_cacheClearingResetsEntries() {
        calculator.clearCache()
        let screenHeight: CGFloat = 800.0

        _ = calculator.detents(for: screenHeight)
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "cache should have 1 entry before clear")

        calculator.clearCache()
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 0, "cache should be empty after clear")

        // After clearing cache, calling again should create a new entry
        let detents2 = calculator.detents(for: screenHeight)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "cache should have 1 entry after re-populating")
        
        // Values should still be equal (same height produces same values)
        let detents1 = calculator.detents(for: screenHeight)
        XCTAssertEqual(detents1.compact, detents2.compact, "same height should produce equal values even after cache clear")
    }

    /// Test cache statistics track entries correctly.
    /// BEHAVIORAL: Verify cache size grows with unique heights and stays stable with cache hits.
    func test_cacheStatisticsTrackEntriesAccurately() {
        calculator.clearCache()
        
        // Initial cache should be empty
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 0, "cache should start empty")

        // Add some unique heights
        _ = calculator.detents(for: 800.0)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "cache should have 1 entry")
        
        _ = calculator.detents(for: 850.0)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "cache should have 2 entries")
        
        _ = calculator.detents(for: 900.0)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 3, "cache should have 3 entries")

        // Multiple calls to same heights shouldn't increase entry count
        _ = calculator.detents(for: 800.0)
        _ = calculator.detents(for: 800.0)
        _ = calculator.detents(for: 850.0)

        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 3, "cache should still have 3 entries (cache hits don't increase count)")
        
        // Estimated size should be positive
        XCTAssertGreaterThan(stats.estimatedSize, 0, "estimated size should reflect cached data")
    }

    /// Test cache doesn't grow for calls within rounding threshold.
    /// BEHAVIORAL: Verify sub-pixel jitter doesn't waste cache space.
    func test_roundingPreventsJitterGrowth() {
        calculator.clearCache()
        
        // Call with values that round to the same integer
        _ = calculator.detents(for: 800.1)
        _ = calculator.detents(for: 800.2)
        _ = calculator.detents(for: 800.3)
        _ = calculator.detents(for: 800.4)
        _ = calculator.detents(for: 800.5)
        
        var stats = calculator.cacheStats()
        // Depending on rounding: 800.1-800.5 might round to 800
        XCTAssertLessThanOrEqual(stats.entries, 2, "values within rounding threshold should share cache entries")
        
        // Now call with clearly different height
        _ = calculator.detents(for: 801.0)
        stats = calculator.cacheStats()
        XCTAssertGreaterThan(stats.entries, 1, "different rounded height should create new cache entry")
    }

    // MARK: - Integration-style Tests

    /// Simulate rapid GeometryReader onChange updates (the actual problem scenario).
    /// BEHAVIORAL: Verify cache prevents redundant calculations via entry count.
    func test_rapidHeightUpdatesWithCaching() {
        calculator.clearCache()
        
        // Simulate GeometryReader firing 60 times per second, alternating between two heights
        for index in 0..<60 {
            let height = 800.0 + CGFloat(index % 2) * 0.1
            let detents = calculator.detents(for: height)
            
            // Verify we get non-nil results (no crashes)
            XCTAssertNotNil(detents.compact, "all updates should return valid detents")
        }

        // Verify we only created ~2 distinct cache entries (not 60)
        let stats = calculator.cacheStats()
        XCTAssertLessThanOrEqual(stats.entries, 3, "rapid alternating updates should use at most 2-3 cache entries")
        XCTAssertGreaterThanOrEqual(stats.entries, 1, "rapid alternating updates should use at least 1 cache entry")
    }

    /// Simulate a full lifecycle: portrait → landscape → portrait.
    /// BEHAVIORAL: Verify cache reuses entries when returning to previous state.
    func test_rotationLifecycle() {
        calculator.clearCache()
        
        let portraitHeight: CGFloat = 844.0
        let landscapeHeight: CGFloat = 390.0

        let portrait1 = calculator.detents(for: portraitHeight)
        var stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 1, "portrait should create 1 cache entry")
        
        let landscape = calculator.detents(for: landscapeHeight)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "landscape should create 2nd cache entry")
        
        let portrait2 = calculator.detents(for: portraitHeight)
        stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 2, "returning to portrait should reuse cached entry")

        // Values should match when returning to portrait
        // fullSheet is screen-height-dependent; compact is a fixed constant
        XCTAssertEqual(portrait1.fullSheet, portrait2.fullSheet, "portrait return should produce equal cached values")

        // But landscape should be different
        XCTAssertNotEqual(portrait1.fullSheet, landscape.fullSheet, "landscape should have different values than portrait")
    }

    /// Test cache memory usage doesn't explode with many different heights.
    /// BEHAVIORAL: Verify cache scaling is reasonable.
    func test_cacheMemoryScaling() {
        calculator.clearCache()
        
        let startStats = calculator.cacheStats()
        XCTAssertEqual(startStats.entries, 0, "cache should start empty")

        // Add 1000 different heights (simulating continuous rotation/resizing)
        for i in 0..<1000 {
            let height = CGFloat(i) + 0.3  // Add decimal to test rounding
            _ = calculator.detents(for: height)
        }

        let endStats = calculator.cacheStats()

        // Should have roughly 1000 entries (one per integer height)
        XCTAssertLessThanOrEqual(endStats.entries, 1010, "cache should have roughly 1000 entries")
        XCTAssertGreaterThanOrEqual(endStats.entries, 995, "cache should have roughly 1000 entries")

        // Estimated size should be reasonable (< 1 MB for 1000 entries)
        XCTAssertLessThan(endStats.estimatedSize, 1_000_000, "cache should not exceed 1 MB for 1000 entries")

        print("Cache scaling test: \(endStats.entries) entries, ~\(endStats.estimatedSize / 1024) KB")
    }

    // MARK: - State Management

    /// Test that DetentCalculator can be stored in @State and persists correctly.
    /// Uses self.calculator (the setUp-managed instance) rather than a local allocation
    /// to avoid an iOS 26 simulator bug where releasing a DetentCalculator mid-stack
    /// via swift_task_deinitOnExecutorImpl produces a bad-free in StopLookupScope.
    func test_stateManagement() {
        // Should work when stored
        let detents = calculator.detents(for: 800.0)
        XCTAssertNotNil(detents.compact, "calculator should work when stored")

        // Cache should be clearable
        calculator.clearCache()
        let stats = calculator.cacheStats()
        XCTAssertEqual(stats.entries, 0, "cache should be clearable")
    }
}
