//
//  FrecencyServiceTests.swift
//  souvenirTests
//
//  Created for Phase 7 - Frecency Sorting Tests
//

import Testing
import Foundation
@testable import souvenir

/// Tests for frecency score calculation covering edge cases and expected behaviors.
@Suite("Frecency Service Tests")
struct FrecencyServiceTests {
    
    let service = FrecencyService()
    
    // MARK: - Basic Calculation Tests
    
    @Test("Recent souvenir with many photos scores high")
    func recentWithManyPhotos() {
        // 10 photos added 1 day ago
        let score = service.calculateScore(photoCount: 10, daysSinceLastPhoto: 1.0)
        
        // Should be high (log1p(10) ≈ 2.4, exp(-0.0495 * 1) ≈ 0.95)
        // Expected: ~2.3
        #expect(score > 2.0, "Recent souvenir with many photos should score high")
    }
    
    @Test("Old souvenir scores low even with many photos")
    func oldWithManyPhotos() {
        // 10 photos added 90 days ago
        let score = service.calculateScore(photoCount: 10, daysSinceLastPhoto: 90.0)
        
        // Exponential decay should dramatically reduce score
        // exp(-0.0495 * 90) ≈ 0.01
        // Expected: ~0.024
        #expect(score < 0.5, "Old souvenir should score low despite many photos")
    }
    
    @Test("Recent souvenir with few photos scores moderately")
    func recentWithFewPhotos() {
        // 1 photo added 1 day ago
        let score = service.calculateScore(photoCount: 1, daysSinceLastPhoto: 1.0)
        
        // log1p(1) ≈ 0.69, exp(-0.0495 * 1) ≈ 0.95
        // Expected: ~0.66
        #expect(score > 0.5 && score < 1.5, "Recent souvenir with few photos should score moderately")
    }
    
    @Test("Today's souvenir scores at full recency")
    func todaysSouvenir() {
        // 5 photos added today (0 days ago)
        let score = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 0.0)
        
        // exp(-0.0495 * 0) = 1.0 (full recency)
        // log1p(5) ≈ 1.79
        // Expected: ~1.79
        #expect(score > 1.5, "Today's souvenir should have maximum recency boost")
    }
    
    // MARK: - Edge Cases
    
    @Test("Zero photos returns zero score")
    func zeroPhotos() {
        let score = service.calculateScore(photoCount: 0, daysSinceLastPhoto: 1.0)
        #expect(score == 0.0, "Souvenir with no photos should have zero score")
    }
    
    @Test("Negative photo count returns zero")
    func negativePhotos() {
        let score = service.calculateScore(photoCount: -5, daysSinceLastPhoto: 1.0)
        #expect(score == 0.0, "Negative photo count should return zero")
    }
    
    @Test("Negative days returns zero")
    func negativeDays() {
        let score = service.calculateScore(photoCount: 5, daysSinceLastPhoto: -1.0)
        #expect(score == 0.0, "Negative days should return zero")
    }
    
    @Test("Very old souvenir approaches zero")
    func veryOldSouvenir() {
        // 365 days old (1 year)
        let score = service.calculateScore(photoCount: 10, daysSinceLastPhoto: 365.0)
        
        // Should be extremely low due to exponential decay
        #expect(score < 0.01, "Year-old souvenir should have nearly zero score")
    }
    
    // MARK: - 14-Day Half-Life Tests
    
    @Test("Score halves every 14 days")
    func halfLifeVerification() {
        let scoreToday = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 0.0)
        let score14Days = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 14.0)
        let score28Days = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 28.0)
        
        // After 14 days, score should be approximately half
        let ratio14 = score14Days / scoreToday
        #expect(ratio14 > 0.45 && ratio14 < 0.55, "Score should halve after 14 days")
        
        // After 28 days (two half-lives), score should be approximately 1/4
        let ratio28 = score28Days / scoreToday
        #expect(ratio28 > 0.20 && ratio28 < 0.30, "Score should quarter after 28 days")
    }
    
    // MARK: - Comparative Tests
    
    @Test("More photos beats fewer photos when both recent")
    func morePhotosWins() {
        let scoreFew = service.calculateScore(photoCount: 2, daysSinceLastPhoto: 1.0)
        let scoreMany = service.calculateScore(photoCount: 10, daysSinceLastPhoto: 1.0)
        
        #expect(scoreMany > scoreFew, "More photos should score higher when both recent")
    }
    
    @Test("Recent souvenir beats old souvenir with same photo count")
    func recencyWins() {
        let scoreRecent = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 1.0)
        let scoreOld = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 30.0)
        
        #expect(scoreRecent > scoreOld, "Recent souvenir should score higher than old one")
    }
    
    @Test("Very recent with few photos can beat old with many photos")
    func recencyCanOvercomeQuantity() {
        let scoreRecentFew = service.calculateScore(photoCount: 2, daysSinceLastPhoto: 0.0)
        let scoreOldMany = service.calculateScore(photoCount: 20, daysSinceLastPhoto: 60.0)
        
        // After 60 days, even 20 photos can't beat today's 2 photos
        #expect(scoreRecentFew > scoreOldMany, "Very recent activity should overcome old quantity")
    }
    
    // MARK: - Date-Based API Tests
    
    @Test("Date-based calculation works correctly")
    func dateBasedCalculation() {
        let now = Date()
        let yesterday = now.addingTimeInterval(-86400) // 1 day ago
        
        let scoreDays = service.calculateScore(photoCount: 5, daysSinceLastPhoto: 1.0)
        let scoreDates = service.calculateScore(photoCount: 5, lastPhotoDate: yesterday, now: now)
        
        // Should be approximately equal (allowing for small floating point differences)
        let difference = abs(scoreDays - scoreDates)
        #expect(difference < 0.01, "Date-based and day-based calculations should match")
    }
    
    @Test("Days between calculation is correct")
    func daysBetweenCalculation() {
        let start = Date(timeIntervalSince1970: 0) // Jan 1, 1970
        let end = Date(timeIntervalSince1970: 86400 * 7) // 7 days later
        
        let days = service.daysBetween(from: start, to: end)
        
        #expect(abs(days - 7.0) < 0.01, "Should calculate 7 days difference")
    }
    
    // MARK: - Custom Half-Life Tests
    
    @Test("Custom half-life affects decay rate")
    func customHalfLife() {
        let service7Days = FrecencyService(halfLifeDays: 7.0)
        let service14Days = FrecencyService(halfLifeDays: 14.0)
        
        let score7 = service7Days.calculateScore(photoCount: 5, daysSinceLastPhoto: 7.0)
        let score14 = service14Days.calculateScore(photoCount: 5, daysSinceLastPhoto: 7.0)
        
        // With 7-day half-life, score should be lower at day 7
        #expect(score7 < score14, "Shorter half-life should decay faster")
    }
}
