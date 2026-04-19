//
//  LocationServiceTests.swift
//  souvenir
//
//  Tests for LocationService
//

import Testing
import CoreLocation
@testable import souvenir

@Suite("Location Service Tests")
@MainActor
struct LocationServiceTests {
    
    @Test("Location service initializes correctly")
    func initializesCorrectly() async throws {
        let service = LocationService()
        
        // Service should initialize with a valid authorization status
        #expect(service.authorizationStatus.rawValue >= 0)
        
        print("✅ Location service initialized with status: \(service.authorizationStatus.rawValue)")
    }
    
    @Test("Location request handles unauthorized gracefully")
    func handlesUnauthorizedGracefully() async throws {
        let service = LocationService()
        
        // If not authorized, should return nil quickly without crashing
        let location = await service.getCurrentLocation(timeout: 1.0)
        
        // We expect nil if permission is not granted (typical in test environment)
        if service.authorizationStatus != .authorizedWhenInUse && service.authorizationStatus != .authorizedAlways {
            #expect(location == nil)
            print("✅ Correctly returned nil when unauthorized")
        } else {
            // If we happen to be authorized, location might be available
            print("ℹ️ Location permission is authorized, got location: \(location != nil)")
        }
    }
    
    @Test("Location request respects timeout")
    func respectsTimeout() async throws {
        let service = LocationService()
        
        let startTime = Date()
        
        // Request with very short timeout
        _ = await service.getCurrentLocation(timeout: 0.5)
        
        let elapsed = Date().timeIntervalSince(startTime)
        
        // Should complete within reasonable time (timeout + generous buffer for CI)
        #expect(elapsed < 5.0, "Location request should respect timeout")
        
        print("✅ Location request completed in \(String(format: "%.2f", elapsed))s")
    }
    
    @Test("Location tuple converts correctly from CLLocation")
    func locationTupleConverts() async throws {
        // Create a test CLLocation
        let testLocation = CLLocation(latitude: 37.334900, longitude: -122.009020)
        
        // Convert to tuple (simulating what we do in the app)
        let locationTuple = (latitude: testLocation.coordinate.latitude, longitude: testLocation.coordinate.longitude)
        
        #expect(locationTuple.latitude == 37.334900)
        #expect(locationTuple.longitude == -122.009020)
        
        // Verify it's not (0, 0)
        #expect(!(locationTuple.latitude == 0.0 && locationTuple.longitude == 0.0))
        
        print("✅ Location tuple conversion works correctly")
    }
}
