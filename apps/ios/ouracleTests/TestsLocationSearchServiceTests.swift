//
//  TestsLocationSearchServiceTests.swift
//  souvenirTests
//

import Testing
import MapKit
import CoreData
@testable import souvenir

@MainActor
@Suite("Location Search Service Tests")
struct LocationSearchServiceTests {

    @Test("Location search result ID is stable")
    func resultIDIsStable() async throws {
        let coordinate = CLLocationCoordinate2D(latitude: 37.3349, longitude: -122.0090)
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let item = MKMapItem(location: location, address: nil)
        item.name = "Test place"

        let first = LocationSearchResult(mapItem: item, source: .localSearch)
        let second = LocationSearchResult(mapItem: item, source: .localSearch)

        #expect(first.id == second.id)
    }

    @Test("Apply location selection updates photo coordinates")
    func applyLocationSelectionUpdatesPhoto() async throws {
        let controller = PersistenceController(inMemory: true, waitForStores: true)
        let context = controller.container.viewContext

        let contact = ContactEntity(context: context)
        contact.givenName = "Test"

        let souvenir = SouvenirEntity(context: context)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact

        let photo = PhotoEntity(context: context)
        photo.id = UUID()
        photo.assetLocalId = "test-asset"
        photo.timestamp = Date()
        photo.timezoneID = TimeZone.current.identifier

        souvenir.photos = Set([photo])
        souvenir.favoritePhoto = photo

        try context.save()

        let coordinate = CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060)
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let item = MKMapItem(location: location, address: nil)
        item.name = "Test Location"

        let service = LocationSearchService(persistenceController: controller, enableEnrichment: false)
        try await service.applyLocationSelection(photoID: photo.id, mapItem: item)

        let request: NSFetchRequest<PhotoEntity> = PhotoEntity.fetchRequest()
        request.fetchLimit = 1
        request.predicate = NSPredicate(format: "id == %@", photo.id as CVarArg)
        let updated = try context.fetch(request).first

        #expect(updated?.latitude?.doubleValue == coordinate.latitude)
        #expect(updated?.longitude?.doubleValue == coordinate.longitude)
        #expect(updated?.postalGeocodeJSON != nil)
    }
}

