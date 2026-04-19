//
//  TestsMapAnnotationTests.swift
//  souvenirTests
//
//  Tests for per-photo MapAnnotation behavior.
//

import Testing
import CoreData
import MapKit
@preconcurrency @testable import souvenir

@MainActor
@Suite("Map Annotation Tests")
struct TestsMapAnnotationTests {
    private func makeViewContext() -> NSManagedObjectContext {
        let persistenceController = PersistenceController(inMemory: true)
        return persistenceController.container.viewContext
    }

    @Test("Creates one annotation per photo with valid coordinates")
    func testAnnotationsFromSouvenirPhotos() throws {
        let viewContext = makeViewContext()

        let contact = ContactEntity(context: viewContext)
        contact.givenName = "Test"

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.title = "Test"
        souvenir.caption = "Caption"
        souvenir.primaryContact = contact

        let validPhoto = PhotoEntity(context: viewContext)
        validPhoto.id = UUID()
        validPhoto.assetLocalId = "local://photo-1"
        validPhoto.timestamp = Date()
        validPhoto.latitude = NSNumber(value: 37.7749)
        validPhoto.longitude = NSNumber(value: -122.4194)

        let zeroPhoto = PhotoEntity(context: viewContext)
        zeroPhoto.id = UUID()
        zeroPhoto.assetLocalId = "local://photo-2"
        zeroPhoto.timestamp = Date()
        zeroPhoto.latitude = NSNumber(value: 0.0)
        zeroPhoto.longitude = NSNumber(value: 0.0)

        souvenir.photos = [validPhoto, zeroPhoto]
        try viewContext.save()

        let annotations = MapAnnotation.annotations(from: [souvenir])
        #expect(annotations.count == 1)
        let annotation = annotations[0]
        #expect(annotation.photoID == validPhoto.id)
        #expect(annotation.thumbnailAssetId == validPhoto.assetLocalId)
        #expect(annotation.title == souvenir.displayTitle)
        #expect(annotation.subtitle == souvenir.caption)
        #expect(annotation.coordinate.latitude == 37.7749)
        #expect(annotation.coordinate.longitude == -122.4194)
    }

    @Test("Coordinate override takes precedence")
    func testCoordinateOverride() throws {
        let viewContext = makeViewContext()
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()

        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "local://photo-override"
        photo.timestamp = Date()
        photo.latitude = NSNumber(value: 10.0)
        photo.longitude = NSNumber(value: 10.0)

        let override = CLLocationCoordinate2D(latitude: 48.8584, longitude: 2.2945)
        let annotation = MapAnnotation(souvenir: souvenir, photo: photo, coordinateOverride: override)

        #expect(annotation.coordinate.latitude == override.latitude)
        #expect(annotation.coordinate.longitude == override.longitude)
    }

    @Test("Annotation key is unique per souvenir-photo pair")
    func testAnnotationKeyIdentity() throws {
        let viewContext = makeViewContext()
        let sharedPhotoID = UUID()

        let souvenirA = SouvenirEntity(context: viewContext)
        souvenirA.id = UUID()
        souvenirA.createdAt = Date()
        souvenirA.updatedAt = Date()

        let souvenirB = SouvenirEntity(context: viewContext)
        souvenirB.id = UUID()
        souvenirB.createdAt = Date()
        souvenirB.updatedAt = Date()

        let photoA = PhotoEntity(context: viewContext)
        photoA.id = sharedPhotoID
        photoA.assetLocalId = "local://shared-photo"
        photoA.timestamp = Date()
        photoA.latitude = NSNumber(value: 1.0)
        photoA.longitude = NSNumber(value: 2.0)

        let photoB = PhotoEntity(context: viewContext)
        photoB.id = sharedPhotoID
        photoB.assetLocalId = "local://shared-photo"
        photoB.timestamp = Date()
        photoB.latitude = NSNumber(value: 1.0)
        photoB.longitude = NSNumber(value: 2.0)

        let annotationA = MapAnnotation(souvenir: souvenirA, photo: photoA)
        let annotationB = MapAnnotation(souvenir: souvenirB, photo: photoB)

        #expect(annotationA.photoID == annotationB.photoID)
        #expect(annotationA.souvenirID != annotationB.souvenirID)
        #expect(annotationA.id != annotationB.id)
        #expect(annotationA.isEqual(annotationB) == false)
    }

    @Test("Shared photo uses canonical coordinate across souvenirs")
    func testSharedPhotoCanonicalCoordinate() throws {
        let viewContext = makeViewContext()

        let contactA = ContactEntity(context: viewContext)
        contactA.givenName = "Alice"

        let contactB = ContactEntity(context: viewContext)
        contactB.givenName = "Bob"

        let souvenirA = SouvenirEntity(context: viewContext)
        souvenirA.id = UUID()
        souvenirA.createdAt = Date()
        souvenirA.updatedAt = Date()
        souvenirA.primaryContact = contactA

        let souvenirB = SouvenirEntity(context: viewContext)
        souvenirB.id = UUID()
        souvenirB.createdAt = Date()
        souvenirB.updatedAt = Date()
        souvenirB.primaryContact = contactB

        // One PhotoEntity shared across both souvenirs — the canonical coordinate
        // should come from whichever appears first when annotations are built.
        let sharedPhoto = PhotoEntity(context: viewContext)
        sharedPhoto.id = UUID()
        sharedPhoto.assetLocalId = "local://shared-canonical"
        sharedPhoto.timestamp = Date()
        sharedPhoto.latitude = NSNumber(value: 10.0)
        sharedPhoto.longitude = NSNumber(value: 20.0)

        souvenirA.photos = [sharedPhoto]
        souvenirB.photos = [sharedPhoto]
        try viewContext.save()

        let annotations = MapAnnotation.annotations(from: [souvenirA, souvenirB])
        #expect(annotations.count == 2)
        #expect(annotations[0].coordinate.latitude == annotations[1].coordinate.latitude)
        #expect(annotations[0].coordinate.longitude == annotations[1].coordinate.longitude)
        #expect(annotations[0].coordinate.latitude == 10.0)
        #expect(annotations[0].coordinate.longitude == 20.0)
    }
}
