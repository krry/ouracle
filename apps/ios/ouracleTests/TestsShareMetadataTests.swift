//
//  TestsShareMetadataTests.swift
//  souvenirTests
//
//  Tests for ShareService metadata encoding/decoding and parsing.
//

import Testing
import CoreData
@preconcurrency @testable import souvenir

@MainActor
@Suite("Share Metadata Tests")
struct TestsShareMetadataTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext
    let service = ShareService.shared

    init() {
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    private func makeSouvenirWithPhoto(timestamp: Date, plusCode: String?) throws -> SouvenirEntity {
        let contact = ContactEntity(context: viewContext)
        contact.givenName = "Test"

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact

        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "local://meta-1"
        photo.timestamp = timestamp
        photo.plusCode = plusCode
        photo.latitude = NSNumber(value: 37.3349)
        photo.longitude = NSNumber(value: -122.0090)

        souvenir.photos = [photo]
        try viewContext.save()
        return souvenir
    }

    @Test("Share metadata encodes and decodes timestamp + plusCode")
    func testShareMetadataEncodeDecode() throws {
        let photoTime = Date(timeIntervalSince1970: 1_700_000_000)
        let souvenir = try makeSouvenirWithPhoto(timestamp: photoTime, plusCode: "849VCWC8+R9")
        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()

        let url = service.shareURL(for: share, includeMetadata: true)
        let decoded = service.decodeMetadata(from: url)

        #expect(decoded != nil)
        #expect(decoded?.plusCode == "849VCWC8+R9")

        if let decodedDate = decoded?.timestamp {
            let delta = abs(decodedDate.timeIntervalSince(photoTime))
            #expect(delta < 2.0)
        } else {
            #expect(Bool(false), "Expected a timestamp in decoded metadata")
        }
    }

    @Test("Share URL omits metadata when unavailable")
    func testShareURLNoMetadataWhenMissing() throws {
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        try viewContext.save()

        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()

        let url = service.shareURL(for: share, includeMetadata: true)
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        #expect(components?.queryItems == nil)
    }

    @Test("Parse token from custom scheme URL")
    func testParseTokenFromCustomScheme() {
        let url = URL(string: "souvenir://s/abc123")!
        #expect(service.parseToken(from: url) == "abc123")
    }

    @Test("Expiration warning returns message for near expiry and expired")
    func testExpirationWarningMessages() {
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()

        let shareSoon = ShareEntity(context: viewContext)
        shareSoon.id = UUID()
        shareSoon.createdAt = Date()
        shareSoon.expiresAt = Date().addingTimeInterval(2.5 * 60 * 60)
        shareSoon.token = "soon"
        shareSoon.souvenir = souvenir

        let warningSoon = service.expirationWarning(for: shareSoon)
        #expect(warningSoon?.contains("expires in about 2 hours") == true)

        let shareExpired = ShareEntity(context: viewContext)
        shareExpired.id = UUID()
        shareExpired.createdAt = Date()
        shareExpired.expiresAt = Date().addingTimeInterval(-60)
        shareExpired.token = "expired"
        shareExpired.souvenir = souvenir

        let warningExpired = service.expirationWarning(for: shareExpired)
        #expect(warningExpired == "This share link has expired.")
    }
}

