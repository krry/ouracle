//
//  TestsShareLifecycleTests.swift
//  souvenirTests
//
//  Tests for share state transitions and ShareService lifecycle methods.
//

import Testing
import CoreData
@preconcurrency @testable import souvenir

@MainActor
@Suite("Share Lifecycle Tests")
struct TestsShareLifecycleTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext
    let service = ShareService.shared

    init() {
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Helpers

    private func makeSouvenir() throws -> SouvenirEntity {
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        try viewContext.save()
        return souvenir
    }

    private func makeShare(
        for souvenir: SouvenirEntity,
        status: String,
        isRevoked: Bool = false
    ) throws -> ShareEntity {
        let share = ShareEntity(context: viewContext)
        share.id = UUID()
        share.createdAt = Date()
        share.expiresAt = Date().addingTimeInterval(72 * 60 * 60)
        share.isRevoked = isRevoked
        share.token = UUID().uuidString
        share.status = status
        share.souvenir = souvenir
        try viewContext.save()
        return share
    }

    // MARK: - State: localOnly

    @Test("Souvenir with no shares is localOnly")
    func testLocalOnlyState() throws {
        let souvenir = try makeSouvenir()
        #expect(service.shareState(for: souvenir, in: viewContext) == .localOnly)
    }

    // MARK: - State: pendingInvite

    @Test("Souvenir with pending share is pendingInvite")
    func testPendingInviteState() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.pending)
        #expect(service.shareState(for: souvenir, in: viewContext) == .pendingInvite)
    }

    @Test("Revoked pending share does not make souvenir pendingInvite")
    func testRevokedPendingShare() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.pending, isRevoked: true)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedRevoked)
    }

    // MARK: - State: sharedActive

    @Test("Souvenir with accepted share is sharedActive")
    func testSharedActiveState() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.accepted)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedActive)
    }

    @Test("Active share takes priority over pending share")
    func testActiveOverPending() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.pending)
        _ = try makeShare(for: souvenir, status: ShareStatus.accepted)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedActive)
    }

    // MARK: - State: sharedRevoked

    @Test("Souvenir with only declined shares is sharedRevoked")
    func testDeclinedShareState() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.declined)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedRevoked)
    }

    @Test("Souvenir with only revoked shares is sharedRevoked")
    func testAllRevokedState() throws {
        let souvenir = try makeSouvenir()
        _ = try makeShare(for: souvenir, status: ShareStatus.accepted, isRevoked: true)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedRevoked)
    }

    // MARK: - Revoke

    @Test("revokeShare marks share revoked with timestamp")
    func testRevokeShare() async throws {
        let souvenir = try makeSouvenir()
        let share = try makeShare(for: souvenir, status: ShareStatus.accepted)
        let beforeRevoke = Date()

        try await service.revokeShare(share, in: viewContext)

        #expect(share.isRevoked == true)
        #expect(share.status == ShareStatus.revoked)
        #expect((share.revokedAt ?? .distantPast) >= beforeRevoke)
        #expect(service.shareState(for: souvenir, in: viewContext) == .sharedRevoked)
    }

    // MARK: - Token Lifecycle

    @Test("createShare produces valid token and URL")
    func testCreateShare() throws {
        let souvenir = try makeSouvenir()
        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()

        #expect(!share.token.isEmpty)
        let url = service.shareURL(for: share)
        #expect(url.absoluteString.contains(share.token))
        #expect(service.parseToken(from: url) == share.token)
    }

    @Test("validateToken returns souvenir for valid non-expired token")
    func testValidateToken() throws {
        let souvenir = try makeSouvenir()
        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()

        let found = service.validateToken(share.token, in: viewContext)
        #expect(found?.id == souvenir.id)
    }

    @Test("validateToken returns nil for revoked share")
    func testValidateRevokedToken() async throws {
        let souvenir = try makeSouvenir()
        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()
        try await service.revokeShare(share, in: viewContext)

        let found = service.validateToken(share.token, in: viewContext)
        #expect(found == nil)
    }

    @Test("validateToken returns nil for expired share")
    func testValidateExpiredToken() throws {
        let souvenir = try makeSouvenir()
        let share = service.createShare(
            for: souvenir,
            in: viewContext,
            expirationInterval: -1  // Already expired
        )
        try viewContext.save()

        let found = service.validateToken(share.token, in: viewContext)
        #expect(found == nil)
    }

    // MARK: - Share Text

    @Test("smsShareText includes token URL")
    func testSmsShareText() throws {
        let souvenir = try makeSouvenir()
        let share = service.createShare(for: souvenir, in: viewContext)
        try viewContext.save()

        let text = service.smsShareText(for: souvenir, share: share)
        #expect(text.contains(share.token))
    }
}
