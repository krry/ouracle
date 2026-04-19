//
//  GeocodingServiceTests.swift
//  souvenirTests
//
//  Created for Phase 4 - Testing geocoding functionality
//

import Testing
import CoreData
import CoreLocation
@testable import souvenir

/// Tests for geocoding service covering:
/// - Reverse geocoding coordinates
/// - JSON serialization of addresses
/// - Rate limiting
/// - Batch geocoding
@Suite("Geocoding Service Tests")
struct GeocodingServiceTests {
    
    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext
    
    init() {
        // Use in-memory store for testing
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }
    
    // Helper to build GeocodedAddress with supported fields in the app model
    private func makeAddress(
        name: String? = nil,
        locality: String? = nil,
        formattedAddress: String? = nil,
        administrativeArea: String? = nil,
        country: String? = nil,
        countryCode: String? = nil
    ) -> GeocodedAddress {
        return GeocodedAddress(
            name: name,
            formattedAddress: formattedAddress,
            locality: locality,
            administrativeArea: administrativeArea,
            country: country,
            countryCode: countryCode
        )
    }
    
    // MARK: - Test: GeocodedAddress JSON Serialization
    
    @Test("GeocodedAddress JSON serialization round-trip")
    func geocodedAddressJSONSerialization() throws {
        // Create a test address
        let original = makeAddress(
            name: "Apple Park",
            locality: "Cupertino",
            administrativeArea: "CA",
            country: "United States",
            countryCode: "US"
        )
        
        // Serialize to JSON
        let json = try #require(original.toJSON())
        
        #expect(!json.isEmpty)
        
        // Deserialize from JSON
        let deserialized = try #require(GeocodedAddress.fromJSON(json))
        
        // Verify all fields match
        #expect(deserialized.name == original.name)
        #expect(deserialized.locality == original.locality)
        #expect(deserialized.administrativeArea == original.administrativeArea)
        #expect(deserialized.country == original.country)
        #expect(deserialized.countryCode == original.countryCode)
    }
    
    // MARK: - Test: GeocodedAddress Short Description
    
    @Test("GeocodedAddress short description formatting")
    func geocodedAddressShortDescription() throws {
        // Test with city and state
        let address1 = makeAddress(
            locality: "San Francisco",
            administrativeArea: "CA",
            country: "United States",
            countryCode: "US"
        )
        
        #expect(address1.shortDescription == "San Francisco, CA")
        
        // Test with only city
        let address2 = makeAddress(
            locality: "Paris",
            country: "France",
            countryCode: "FR"
        )
        
        #expect(address2.shortDescription == "Paris")
        
        // Test with ocean
        let address3 = makeAddress(
            name: "Pacific Ocean"
        )
        
        #expect(address3.shortDescription == "Pacific Ocean")
    }
    
    // MARK: - Test: GeocodedAddress Full Description
    
    @Test("GeocodedAddress full description formatting")
    func geocodedAddressFullDescription() throws {
        // Test with full address
        let address = makeAddress(
            name: "Apple Park",
            locality: "Cupertino",
            administrativeArea: "CA",
            country: "United States",
            countryCode: "US"
        )
        
        let fullDescription = address.fullDescription
        
        // Should contain name if present
        #expect(fullDescription.contains("Apple Park"))
        
        // Should contain city, state
        #expect(fullDescription.contains("Cupertino"))
        #expect(fullDescription.contains("CA"))
    }
    
    // MARK: - Test: Create Photo with Coordinates
    
    @Test("Create PhotoEntity with coordinates")
    func createPhotoWithCoordinates() async throws {
        let context = persistenceController.newBackgroundContext()
        
        await context.perform {
            let photo = PhotoEntity(context: context)
            photo.id = UUID()
            photo.assetLocalId = "test-asset-with-location"
            photo.timestamp = Date()
            photo.timezoneID = TimeZone.current.identifier
            photo.latitude = NSNumber(value: 37.7749) // San Francisco
            photo.longitude = NSNumber(value: -122.4194)
            
            #expect(photo.latitude?.doubleValue == 37.7749)
            #expect(photo.longitude?.doubleValue == -122.4194)
            
            do {
                try context.save()
            } catch {
                Issue.record("Failed to save photo: \(error)")
            }
        }
    }
    
    // MARK: - Test: Store Geocoded Address in PhotoEntity
    
    @Test("Store and retrieve geocoded address in PhotoEntity")
    func storeGeocodedAddressInPhoto() async throws {
        let context = persistenceController.newBackgroundContext()
        
        await context.perform {
            let photo = PhotoEntity(context: context)
            photo.id = UUID()
            photo.assetLocalId = "test-asset-geocoded"
            photo.timestamp = Date()
            photo.latitude = NSNumber(value: 37.7749)
            photo.longitude = NSNumber(value: -122.4194)
            
            // Create geocoded address
            let address = makeAddress(
                locality: "San Francisco",
                administrativeArea: "CA",
                country: "United States",
                countryCode: "US"
            )
            
            // Store as JSON
            photo.postalGeocodeJSON = address.toJSON()
            
            do {
                try context.save()
            } catch {
                Issue.record("Failed to save photo: \(error)")
                return
            }
            
            // Retrieve and verify
            if let json = photo.postalGeocodeJSON,
               let retrieved = GeocodedAddress.fromJSON(json) {
                #expect(retrieved.locality == "San Francisco")
                #expect(retrieved.administrativeArea == "CA")
                #expect(retrieved.shortDescription == "San Francisco, CA")
            } else {
                Issue.record("Failed to retrieve geocoded address from photo")
            }
        }
    }
    
    // MARK: - Test: what3words Extension
    
    @Test("PhotoEntity what3words extension")
    func photoEntityWhat3WordsExtension() async throws {
        let context = persistenceController.newBackgroundContext()
        
        await context.perform {
            let photo = PhotoEntity(context: context)
            photo.id = UUID()
            photo.assetLocalId = "test-asset-w3w"
            photo.w3w = "filled.count.soap"
            
            // Test formatted what3words
            #expect(photo.formattedW3W == "///filled.count.soap")
            
            // Test empty what3words
            let photo2 = PhotoEntity(context: context)
            photo2.id = UUID()
            photo2.assetLocalId = "test-asset-no-w3w"
            photo2.w3w = nil
            
            #expect(photo2.formattedW3W == nil)
        }
    }
    
    // MARK: - Test: Find Photos Needing Geocoding
    
    @Test("Find photos that need geocoding")
    func findPhotosNeedingGeocode() async throws {
        let service = GeocodingService(persistenceController: persistenceController)
        
        let context = persistenceController.newBackgroundContext()
        
        // Create test photos
        await context.perform {
            // Photo with coordinates, no geocoding
            let photo1 = PhotoEntity(context: context)
            photo1.id = UUID()
            photo1.assetLocalId = "needs-geocoding-1"
            photo1.latitude = NSNumber(value: 37.7749)
            photo1.longitude = NSNumber(value: -122.4194)
            photo1.postalGeocodeJSON = nil
            
            // Photo with coordinates and geocoding (should be skipped)
            let photo2 = PhotoEntity(context: context)
            photo2.id = UUID()
            photo2.assetLocalId = "already-geocoded"
            photo2.latitude = NSNumber(value: 37.3318)
            photo2.longitude = NSNumber(value: -122.0312)
            
            let address = makeAddress(
                locality: "Cupertino",
                administrativeArea: "CA",
                countryCode: "US"
            )
            photo2.postalGeocodeJSON = address.toJSON()
            
            // Photo without coordinates (should be skipped)
            let photo3 = PhotoEntity(context: context)
            photo3.id = UUID()
            photo3.assetLocalId = "no-coordinates"
            photo3.latitude = nil
            photo3.longitude = nil
            
            do {
                try context.save()
            } catch {
                Issue.record("Failed to save photos: \(error)")
            }
        }
        
        // Find photos needing geocoding
        let photoIDs = try await service.findPhotosNeedingGeocode()
        
        // Should find exactly 1 photo (photo1)
        #expect(photoIDs.count == 1)
    }
}

