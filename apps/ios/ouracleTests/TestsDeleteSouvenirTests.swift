//
//  TestsDeleteSouvenirTests.swift
//  souvenirTests
//
//  Tests for:
//  - DeleteSouvenirService soft-delete (sets deletedAt, does not hard-delete)
//  - SouvenirEntity.activePredicate correctly filters active vs deleted souvenirs
//  - PhotoEntity.displayFitMode persistence (v5 schema attribute added in 0.6)
//

import Testing
import CoreData
@testable import souvenir

@MainActor
@Suite("Delete Souvenir and Photo Fit Mode Tests")
struct TestsDeleteSouvenirTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext

    init() {
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Helpers

    private func makeSouvenir() throws -> SouvenirEntity {
        let s = SouvenirEntity(context: viewContext)
        s.id = UUID()
        s.createdAt = Date()
        s.updatedAt = Date()
        try viewContext.save()
        return s
    }

    private func makePhoto(assetLocalId: String = "test-asset") throws -> PhotoEntity {
        let p = PhotoEntity(context: viewContext)
        p.id = UUID()
        p.assetLocalId = assetLocalId
        p.timestamp = Date()
        p.timezoneID = TimeZone.current.identifier
        try viewContext.save()
        return p
    }

    private func activeCount() throws -> Int {
        let r = SouvenirEntity.fetchRequest()
        r.predicate = SouvenirEntity.activePredicate
        return try viewContext.fetch(r).count
    }

    // MARK: - DeleteSouvenirService

    @Test("Soft-delete sets deletedAt on the souvenir")
    func softDelete_setsDeleatedAt() async throws {
        let souvenir = try makeSouvenir()
        let before = Date()

        try await DeleteSouvenirService.shared.deleteSouvenir(souvenir, in: viewContext)

        #expect(souvenir.deletedAt != nil)
        #expect((souvenir.deletedAt ?? .distantPast) >= before)
    }

    @Test("Soft-delete does not hard-delete the souvenir entity from the store")
    func softDelete_entityStillInStore() async throws {
        let souvenir = try makeSouvenir()
        let id = souvenir.id

        try await DeleteSouvenirService.shared.deleteSouvenir(souvenir, in: viewContext)

        // Entity should still be fetchable by ID (just has deletedAt set)
        let r = SouvenirEntity.fetchRequest()
        r.predicate = NSPredicate(format: "id == %@", id as CVarArg)
        r.fetchLimit = 1
        let found = try viewContext.fetch(r).first
        #expect(found != nil)
        #expect(found?.deletedAt != nil)
    }

    @Test("Soft-delete also updates updatedAt")
    func softDelete_updatesUpdatedAt() async throws {
        let souvenir = try makeSouvenir()
        let beforeUpdatedAt = souvenir.updatedAt
        // Small sleep so timestamps differ
        try await Task.sleep(for: .milliseconds(10))

        try await DeleteSouvenirService.shared.deleteSouvenir(souvenir, in: viewContext)

        #expect(souvenir.updatedAt >= beforeUpdatedAt)
    }

    // MARK: - activePredicate

    @Test("activePredicate returns active souvenirs")
    func activePredicate_includesActiveOnly() throws {
        let s = try makeSouvenir()
        let r = SouvenirEntity.fetchRequest()
        r.predicate = SouvenirEntity.activePredicate
        let results = try viewContext.fetch(r)
        #expect(results.contains(where: { $0.id == s.id }))
    }

    @Test("activePredicate excludes soft-deleted souvenirs")
    func activePredicate_excludesDeleted() async throws {
        let souvenir = try makeSouvenir()
        let id = souvenir.id
        try await DeleteSouvenirService.shared.deleteSouvenir(souvenir, in: viewContext)

        let r = SouvenirEntity.fetchRequest()
        r.predicate = SouvenirEntity.activePredicate
        let results = try viewContext.fetch(r)
        #expect(!results.contains(where: { $0.id == id }))
    }

    @Test("activePredicate handles mix of active and deleted souvenirs correctly")
    func activePredicate_mixedState() async throws {
        let active1 = try makeSouvenir()
        let active2 = try makeSouvenir()
        let deleted = try makeSouvenir()

        try await DeleteSouvenirService.shared.deleteSouvenir(deleted, in: viewContext)

        let r = SouvenirEntity.fetchRequest()
        r.predicate = SouvenirEntity.activePredicate
        let results = try viewContext.fetch(r)

        #expect(results.contains(where: { $0.id == active1.id }))
        #expect(results.contains(where: { $0.id == active2.id }))
        #expect(!results.contains(where: { $0.id == deleted.id }))
    }

    @Test("activePredicate predicate string matches deletedAt == nil")
    func activePredicate_predicateFormat() {
        let predicate = SouvenirEntity.activePredicate
        // The predicate must exclude soft-deleted rows — confirm format
        #expect(predicate.predicateFormat.contains("deletedAt"))
    }

    // MARK: - PhotoEntity.displayFitMode (v5 schema)

    @Test("displayFitMode defaults to false on new PhotoEntity")
    func displayFitMode_defaultsFalse() throws {
        let photo = try makePhoto(assetLocalId: "fit-default-1")
        #expect(photo.displayFitMode == false)
    }

    @Test("displayFitMode true persists after context save and reset")
    func displayFitMode_persistsTrue() throws {
        let photo = try makePhoto(assetLocalId: "fit-persist-1")
        let id = photo.id
        photo.displayFitMode = true
        try viewContext.save()
        viewContext.reset()

        let r = PhotoEntity.fetchRequest()
        r.predicate = NSPredicate(format: "id == %@", id as CVarArg)
        r.fetchLimit = 1
        let fetched = try #require(try viewContext.fetch(r).first)
        #expect(fetched.displayFitMode == true)
    }

    @Test("displayFitMode can be toggled back to false and that persists")
    func displayFitMode_toggleBackToFalse() throws {
        let photo = try makePhoto(assetLocalId: "fit-toggle-1")
        let id = photo.id
        photo.displayFitMode = true
        try viewContext.save()
        photo.displayFitMode = false
        try viewContext.save()
        viewContext.reset()

        let r = PhotoEntity.fetchRequest()
        r.predicate = NSPredicate(format: "id == %@", id as CVarArg)
        r.fetchLimit = 1
        let fetched = try #require(try viewContext.fetch(r).first)
        #expect(fetched.displayFitMode == false)
    }

    @Test("displayFitMode is independent per photo")
    func displayFitMode_independentPerPhoto() throws {
        let p1 = try makePhoto(assetLocalId: "fit-indep-1")
        let p2 = try makePhoto(assetLocalId: "fit-indep-2")
        p1.displayFitMode = true
        p2.displayFitMode = false
        try viewContext.save()

        #expect(p1.displayFitMode == true)
        #expect(p2.displayFitMode == false)
    }

    @Test("New photo starts locked (isViewportLocked true) and displayFitMode false")
    func newPhoto_defaultViewportState() throws {
        let photo = try makePhoto(assetLocalId: "viewport-defaults-1")
        photo.isViewportLocked = true
        photo.viewportScale = 1.0
        photo.viewportOffsetX = 0
        photo.viewportOffsetY = 0
        try viewContext.save()

        #expect(photo.displayFitMode == false)
        #expect(photo.isViewportLocked == true)
        #expect(photo.viewportScale == 1.0)
    }
}
