//
//  TestsSouvenirGoldenPathTests.swift
//  souvenirTests
//
//  End-to-end golden path for the Save Souvenir and Share Souvenir flows.
//  Verifies relationship completeness, derived fields, duplicate prevention,
//  and share state transitions that regressions historically broke.
//

import Testing
import CoreData
@testable import souvenir

@MainActor
@Suite("Souvenir Golden Path Tests")
struct TestsSouvenirGoldenPathTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext

    init() {
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Helpers

    private func makeContact(givenName: String, phone: String) async throws -> ContactEntity {
        let service = ContactSearchService(persistenceController: persistenceController)
        return try await service.createContact(givenName: givenName, familyName: nil, phone: phone)
    }

    private func fetchSouvenir(id: UUID) async throws -> SouvenirEntity? {
        try await viewContext.perform {
            let req = SouvenirEntity.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", id as CVarArg)
            req.fetchLimit = 1
            return try self.viewContext.fetch(req).first
        }
    }

    // MARK: - Relationship completeness

    @Test("Created souvenir has favoritePhoto, primaryContact, meetTime, and caption")
    func createSouvenir_setsAllRelationships() async throws {
        let contact = try await makeContact(givenName: "Alice", phone: "+12175550200")
        let photo = PhotoMetadata(
            assetLocalId: "golden-rel-1",
            timestamp: Date(timeIntervalSince1970: 1_700_000_000),
            timezoneID: "America/Chicago",
            location: nil
        )

        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(photo: photo, contact: contact, caption: "hello world")
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        #expect(sv.favoritePhoto != nil)
        #expect(sv.primaryContact?.id == contact.id)
        #expect(sv.meetTime != nil)
        #expect(sv.caption == "hello world")
        #expect(sv.photosArray.count == 1)
        #expect(sv.photosArray.first?.assetLocalId == "golden-rel-1")
    }

    @Test("Reverse relationship: contact.primarySouvenir points back to the created souvenir")
    func createSouvenir_reverseRelationshipIntact() async throws {
        let contact = try await makeContact(givenName: "Beth", phone: "+12175550201")
        let photo = PhotoMetadata(
            assetLocalId: "golden-rev-1",
            timestamp: Date(),
            timezoneID: "UTC",
            location: nil
        )

        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(photo: photo, contact: contact, caption: nil)
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        // The contact's reverse relationship must point back to this souvenir
        #expect(sv.primaryContact?.primarySouvenir?.id == souvenirID)
    }

    // MARK: - Derived fields (recomputeDerivedFields)

    @Test("Souvenir with geotagged photo stores lastLatitude and lastLongitude")
    func createSouvenir_derivedCoordinatesFromPhoto() async throws {
        let contact = try await makeContact(givenName: "Carl", phone: "+12175550202")
        let photo = PhotoMetadata(
            assetLocalId: "golden-geo-1",
            timestamp: Date(),
            timezoneID: "America/New_York",
            location: (latitude: 40.7128, longitude: -74.0060)
        )

        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(photo: photo, contact: contact, caption: nil)
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        let lat = try #require(sv.latestPhotoLatitude)
        let lon = try #require(sv.latestPhotoLongitude)
        #expect(abs(lat - 40.7128) < 0.001)
        #expect(abs(lon - (-74.0060)) < 0.001)
    }

    @Test("Souvenir without location does not set lastLatitude")
    func createSouvenir_noLocation_noLatitude() async throws {
        let contact = try await makeContact(givenName: "Dana", phone: "+12175550203")
        let photo = PhotoMetadata(
            assetLocalId: "golden-nogeo-1",
            timestamp: Date(),
            timezoneID: "UTC",
            location: nil
        )

        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(photo: photo, contact: contact, caption: nil)
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        #expect(sv.latestPhotoLatitude == nil)
        #expect(sv.latestPhotoLongitude == nil)
    }

    // MARK: - displayTitle

    @Test("displayTitle returns contact name when no custom title is set")
    func displayTitle_fallsBackToContactName() async throws {
        let contact = try await makeContact(givenName: "Evan", phone: "+12175550204")
        let photo = PhotoMetadata(assetLocalId: "golden-title-1", timestamp: Date(), timezoneID: "UTC", location: nil)

        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(photo: photo, contact: contact, caption: nil)
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        #expect(sv.displayTitle == "Evan")
    }

    // MARK: - Duplicate prevention

    @Test("Creating a second souvenir for the same contact throws")
    func createSouvenir_duplicateContact_throws() async throws {
        let contact = try await makeContact(givenName: "Fiona", phone: "+12175550205")
        let service = SouvenirCaptureService(persistenceController: persistenceController)

        _ = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "dup-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: nil
        )

        do {
            _ = try await service.createSouvenir(
                photo: PhotoMetadata(assetLocalId: "dup-2", timestamp: Date(), timezoneID: "UTC", location: nil),
                contact: contact,
                caption: nil
            )
            Issue.record("Expected error for duplicate contact, but createSouvenir succeeded")
        } catch is SouvenirCaptureError {
            // expected
        } catch is ValidationError {
            // also acceptable
        }
    }

    @Test("Re-using the same photo asset for two different contacts reuses the photo entity")
    func createSouvenir_sharedPhotoAsset_reusesEntity() async throws {
        let c1 = try await makeContact(givenName: "George", phone: "+12175550206")
        let c2 = try await makeContact(givenName: "Hannah", phone: "+12175550207")
        let sharedAsset = "shared-asset-xyz"
        let service = SouvenirCaptureService(persistenceController: persistenceController)

        let id1 = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: sharedAsset, timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: c1,
            caption: nil
        )
        let id2 = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: sharedAsset, timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: c2,
            caption: nil
        )

        let sv1 = try #require(try await fetchSouvenir(id: id1))
        let sv2 = try #require(try await fetchSouvenir(id: id2))

        let photo1 = try #require(sv1.photosArray.first)
        let photo2 = try #require(sv2.photosArray.first)
        #expect(photo1.id == photo2.id, "Same asset should reuse the same PhotoEntity")
    }

    // MARK: - Share Souvenir golden path

    @Test("createShare produces a valid token that round-trips through validateToken")
    func shareGoldenPath_tokenRoundTrip() async throws {
        let contact = try await makeContact(givenName: "Ivan", phone: "+12175550208")
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "share-rt-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: nil
        )
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        let shareService = ShareService.shared
        let share = shareService.createShare(for: sv, in: viewContext)
        try viewContext.save()

        #expect(!share.token.isEmpty)
        #expect(share.souvenir?.id == souvenirID)
        #expect(!share.isRevoked)
        #expect(share.expiresAt > Date())

        let found = shareService.validateToken(share.token, in: viewContext)
        #expect(found?.id == souvenirID)
    }

    @Test("Share state is pendingInvite after creation and sharedRevoked after revoke")
    func shareGoldenPath_stateTransitions() async throws {
        let contact = try await makeContact(givenName: "Jana", phone: "+12175550209")
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "share-state-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: nil
        )
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        let shareService = ShareService.shared
        let share = shareService.createShare(for: sv, in: viewContext)
        try viewContext.save()

        #expect(shareService.shareState(for: sv, in: viewContext) == .pendingInvite)

        try await shareService.revokeShare(share, in: viewContext)

        #expect(shareService.validateToken(share.token, in: viewContext) == nil)
        #expect(shareService.shareState(for: sv, in: viewContext) == .sharedRevoked)
    }

    @Test("smsShareText includes token URL and TestFlight link")
    func shareGoldenPath_smsText() async throws {
        let contact = try await makeContact(givenName: "Kyle", phone: "+12175550210")
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "share-sms-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: "A caption for sharing"
        )
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        let shareService = ShareService.shared
        let share = shareService.createShare(for: sv, in: viewContext)
        try viewContext.save()

        let text = shareService.smsShareText(for: sv, share: share)
        #expect(text.contains(share.token))
        #expect(text.contains("testflight.apple.com"))
    }

    @Test("inAppShareText includes token URL")
    func shareGoldenPath_inAppText() async throws {
        let contact = try await makeContact(givenName: "Lena", phone: "+12175550211")
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "share-inapp-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: "In-app caption"
        )
        let sv = try #require(try await fetchSouvenir(id: souvenirID))

        let shareService = ShareService.shared
        let share = shareService.createShare(for: sv, in: viewContext)
        try viewContext.save()

        let text = shareService.inAppShareText(for: sv, share: share)
        #expect(text.contains(share.token))
    }

    // MARK: - activePredicate (soft-delete integration)

    @Test("activePredicate excludes soft-deleted souvenirs created via SouvenirCaptureService")
    func activePredicate_excludesDeletedAfterCapture() async throws {
        let contact = try await makeContact(givenName: "Mara", phone: "+12175550212")
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let souvenirID = try await service.createSouvenir(
            photo: PhotoMetadata(assetLocalId: "del-golden-1", timestamp: Date(), timezoneID: "UTC", location: nil),
            contact: contact,
            caption: nil
        )
        let sv = try #require(try await fetchSouvenir(id: souvenirID))
        try await DeleteSouvenirService.shared.deleteSouvenir(sv, in: viewContext)

        let active = try viewContext.fetch({
            let r = SouvenirEntity.fetchRequest()
            r.predicate = SouvenirEntity.activePredicate
            return r
        }())
        #expect(!active.contains(where: { $0.id == souvenirID }))
        #expect(sv.deletedAt != nil)
    }
}
