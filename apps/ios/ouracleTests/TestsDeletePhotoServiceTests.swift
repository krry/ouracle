//
//  TestsDeletePhotoServiceTests.swift
//  souvenirTests
//

import Testing
import CoreData
@testable import souvenir

@Suite("Delete Photo Service Tests")
@MainActor
struct DeletePhotoServiceTests {

    @Test("Delete removes photo from souvenir and keeps entity")
    func deletePhotoRemovesEntity() async throws {
        let controller = PersistenceController(inMemory: true, waitForStores: true)
        let context = controller.container.viewContext

        let contact = ContactEntity(context: context)
        contact.givenName = "Test"

        let souvenir = SouvenirEntity(context: context)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact

        let photo1 = PhotoEntity(context: context)
        photo1.id = UUID()
        photo1.assetLocalId = "test-asset-1"
        photo1.timestamp = Date()
        photo1.timezoneID = TimeZone.current.identifier

        let photo2 = PhotoEntity(context: context)
        photo2.id = UUID()
        photo2.assetLocalId = "test-asset-2"
        photo2.timestamp = Date().addingTimeInterval(-60)
        photo2.timezoneID = TimeZone.current.identifier

        souvenir.photos = Set([photo1, photo2])
        souvenir.favoritePhoto = photo1

        try context.save()

        let service = DeletePhotoService(persistenceController: controller)
        try await service.deletePhoto(photoID: photo1.id, from: souvenir.id)

        let souvenirRequest: NSFetchRequest<SouvenirEntity> = SouvenirEntity.fetchRequest()
        souvenirRequest.fetchLimit = 1
        souvenirRequest.predicate = NSPredicate(format: "id == %@", souvenir.id as CVarArg)
        let updatedSouvenir = try context.fetch(souvenirRequest).first

        #expect(updatedSouvenir?.photos?.count == 1)
        #expect(updatedSouvenir?.favoritePhoto?.id == photo2.id)

        let photoRequest: NSFetchRequest<PhotoEntity> = PhotoEntity.fetchRequest()
        photoRequest.fetchLimit = 1
        photoRequest.predicate = NSPredicate(format: "id == %@", photo1.id as CVarArg)
        let deletedPhoto = try context.fetch(photoRequest).first

        #expect(deletedPhoto != nil)
    }

    @Test("Delete allows removing last photo and leaves souvenir empty")
    func deleteAllowsLastPhoto() async throws {
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

        let service = DeletePhotoService(persistenceController: controller)

        try await service.deletePhoto(photoID: photo.id, from: souvenir.id)

        let souvenirRequest: NSFetchRequest<SouvenirEntity> = SouvenirEntity.fetchRequest()
        souvenirRequest.fetchLimit = 1
        souvenirRequest.predicate = NSPredicate(format: "id == %@", souvenir.id as CVarArg)
        let updatedSouvenir = try context.fetch(souvenirRequest).first

        #expect(updatedSouvenir?.photos?.isEmpty == true)
        #expect(updatedSouvenir?.favoritePhoto == nil)
    }
}
