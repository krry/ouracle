//
//  TestsValidationServiceTests.swift
//  souvenirTests
//
//  Created for Phase 14: Validation Tests
//

import Testing
import CoreData
@preconcurrency @testable import souvenir

@MainActor
@Suite("Validation Service Tests")
struct TestsValidationServiceTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext

    init() {
        // Use in-memory store for testing
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Phone Validation Tests

    @Test("Valid E.164 phone numbers")
    func testValidPhoneNumbers() {
        #expect(ValidationService.validatePhoneFormat("+12175551234"))
        #expect(ValidationService.validatePhoneFormat("+442071838750"))
        #expect(ValidationService.validatePhoneFormat("+81312345678"))
    }

    @Test("Invalid phone numbers")
    func testInvalidPhoneNumbers() {
        #expect(!ValidationService.validatePhoneFormat("2175551234")) // Missing +
        #expect(!ValidationService.validatePhoneFormat("+1217555123")) // Too short
        #expect(!ValidationService.validatePhoneFormat("+1217555123456789")) // Too long
        #expect(!ValidationService.validatePhoneFormat("(217) 555-1234")) // Invalid format
        #expect(!ValidationService.validatePhoneFormat("")) // Empty
        #expect(!ValidationService.validatePhoneFormat(nil)) // Nil
    }

    @Test("Phone validation throws correct errors")
    func testPhoneValidationErrors() {
        #expect(throws: ValidationError.invalidPhoneFormat("2175551234")) {
            try ValidationService.validatePhoneFormatOrThrow("2175551234")
        }

        #expect(throws: ValidationError.missingRequiredField("phone number")) {
            try ValidationService.validatePhoneFormatOrThrow(nil)
        }
    }

    // MARK: - Email Validation Tests

    @Test("Valid email addresses")
    func testValidEmails() {
        #expect(ValidationService.validateEmailFormat("test@example.com"))
        #expect(ValidationService.validateEmailFormat("user.name+tag@sub.domain.co.uk"))
        #expect(ValidationService.validateEmailFormat("john.doe@university.edu"))
    }

    @Test("Invalid email addresses")
    func testInvalidEmails() {
        #expect(!ValidationService.validateEmailFormat("test@example")) // Missing TLD
        #expect(!ValidationService.validateEmailFormat("test@.com")) // Missing domain
        #expect(!ValidationService.validateEmailFormat("test")) // Missing @
        #expect(!ValidationService.validateEmailFormat("")) // Empty
        #expect(!ValidationService.validateEmailFormat(nil)) // Nil
    }

    @Test("Email validation throws correct errors")
    func testEmailValidationErrors() {
        #expect(throws: ValidationError.invalidEmailFormat("test@example")) {
            try ValidationService.validateEmailFormatOrThrow("test@example")
        }

        #expect(throws: ValidationError.missingRequiredField("email")) {
            try ValidationService.validateEmailFormatOrThrow(nil)
        }
    }

    // MARK: - Coordinate Validation Tests

    @Test("Valid geographic coordinates")
    func testValidCoordinates() throws {
        try ValidationService.validateCoordinates(latitude: 40.7128, longitude: -74.0060) // New York
        try ValidationService.validateCoordinates(latitude: -33.8688, longitude: 151.2093) // Sydney
        try ValidationService.validateCoordinates(latitude: 0.0, longitude: 0.0) // Equator/Prime Meridian
        try ValidationService.validateCoordinates(latitude: 89.9999, longitude: 179.9999) // Near poles
        try ValidationService.validateCoordinates(latitude: -89.9999, longitude: -179.9999) // Near poles
    }

    @Test("Invalid latitude ranges")
    func testInvalidLatitude() {
        #expect(throws: ValidationError.invalidGeographicRange(field: "latitude", value: 91.0, min: -90.0, max: 90.0)) {
            try ValidationService.validateLatitude(91.0)
        }

        #expect(throws: ValidationError.invalidGeographicRange(field: "latitude", value: -91.0, min: -90.0, max: 90.0)) {
            try ValidationService.validateLatitude(-91.0)
        }
    }

    @Test("Invalid longitude ranges")
    func testInvalidLongitude() {
        #expect(throws: ValidationError.invalidGeographicRange(field: "longitude", value: 181.0, min: -180.0, max: 180.0)) {
            try ValidationService.validateLongitude(181.0)
        }

        #expect(throws: ValidationError.invalidGeographicRange(field: "longitude", value: -181.0, min: -180.0, max: 180.0)) {
            try ValidationService.validateLongitude(-181.0)
        }
    }

    // MARK: - Contact Validation Tests

    @Test("Contact requires given name")
    func testContactRequiresGivenName() {
        #expect(throws: ValidationError.contactRequiresGivenName) {
            try ValidationService.validateContactRequirements(
                givenName: nil,
                familyName: "Smith",
                phone: "+12175551234",
                email: "test@example.com"
            )
        }
    }

    @Test("Contact requires phone or email")
    func testContactRequiresPhoneOrEmail() {
        #expect(throws: ValidationError.contactRequiresPhoneOrEmail) {
            try ValidationService.validateContactRequirements(
                givenName: "John",
                familyName: "Smith",
                phone: nil,
                email: nil
            )
        }
    }

    @Test("Valid contact with phone")
    func testValidContactWithPhone() throws {
        try ValidationService.validateContactRequirements(
            givenName: "John",
            familyName: "Smith",
            phone: "+12175551234",
            email: nil
        )
    }

    @Test("Valid contact with email")
    func testValidContactWithEmail() throws {
        try ValidationService.validateContactRequirements(
            givenName: "John",
            familyName: "Smith",
            phone: nil,
            email: "john@example.com"
        )
    }

    @Test("Valid contact with both phone and email")
    func testValidContactWithBoth() throws {
        try ValidationService.validateContactRequirements(
            givenName: "John",
            familyName: "Smith",
            phone: "+12175551234",
            email: "john@example.com"
        )
    }

    // MARK: - Souvenir Validation Tests

    @Test("Souvenir requires at least one photo")
    func testSouvenirRequiresAtLeastOnePhoto() throws {
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        // No photos added

        #expect(throws: ValidationError.souvenirRequiresAtLeastOnePhoto) {
            try ValidationService.validateSouvenir(souvenir)
        }
    }

    @Test("Souvenir requires primary contact")
    func testSouvenirRequiresPrimaryContact() throws {
        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "test-asset-123"
        photo.timestamp = Date()

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.photos = [photo]
        // No primary contact

        #expect(throws: ValidationError.missingRequiredField("primary contact")) {
            try ValidationService.validateSouvenir(souvenir)
        }
    }

    @Test("Valid souvenir with photo and contact")
    func testValidSouvenirWithPhotoAndContact() throws {
        let contact = ContactEntity(context: viewContext)
        contact.id = UUID()
        contact.givenName = "Test"
        contact.familyName = "User"
        contact.phoneE164 = "+12175551234"
        contact.createdAt = Date()

        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "test-asset-123"
        photo.timestamp = Date()

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact
        souvenir.photos = [photo]

        try ValidationService.validateSouvenir(souvenir)
    }

    // MARK: - Photo Validation Tests

    @Test("Photo requires assetLocalId")
    func testPhotoRequiresAssetLocalId() throws {
        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        // No assetLocalId

        #expect(throws: ValidationError.missingRequiredField("assetLocalId")) {
            try ValidationService.validatePhoto(photo)
        }
    }

    @Test("Photo with invalid coordinates")
    func testPhotoWithInvalidCoordinates() throws {
        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "test-asset-123"
        photo.timestamp = Date()
        photo.latitude = NSNumber(value: 91.0) // Invalid latitude
        photo.longitude = NSNumber(value: 181.0) // Invalid longitude

        #expect(throws: ValidationError.invalidGeographicRange(field: "latitude", value: 91.0, min: -90.0, max: 90.0)) {
            try ValidationService.validatePhoto(photo)
        }
    }

    @Test("Valid photo")
    func testValidPhoto() throws {
        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "test-asset-123"
        photo.timestamp = Date()
        photo.latitude = NSNumber(value: 40.7128)
        photo.longitude = NSNumber(value: -74.0060)

        try ValidationService.validatePhoto(photo)
    }

    // MARK: - Relationship Validation Tests

    @Test("Duplicate photo in souvenir")
    func testDuplicatePhotoInSouvenir() throws {
        let contact = ContactEntity(context: viewContext)
        contact.id = UUID()
        contact.givenName = "Test"
        contact.phoneE164 = "+12175551234"
        contact.createdAt = Date()

        let photo = PhotoEntity(context: viewContext)
        photo.id = UUID()
        photo.assetLocalId = "test-asset-123"
        photo.timestamp = Date()

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact
        souvenir.photos = [photo]

        #expect(ValidationService.checkDuplicatePhotoInSouvenir(photo: photo, souvenir: souvenir))
    }

    @Test("Photo not in souvenir")
    func testPhotoNotInSouvenir() throws {
        let contact = ContactEntity(context: viewContext)
        contact.id = UUID()
        contact.givenName = "Test"
        contact.phoneE164 = "+12175551234"
        contact.createdAt = Date()

        let photo1 = PhotoEntity(context: viewContext)
        photo1.id = UUID()
        photo1.assetLocalId = "test-asset-123"
        photo1.timestamp = Date()

        let photo2 = PhotoEntity(context: viewContext)
        photo2.id = UUID()
        photo2.assetLocalId = "test-asset-456"
        photo2.timestamp = Date()

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        souvenir.primaryContact = contact
        souvenir.photos = [photo1]

        #expect(!ValidationService.checkDuplicatePhotoInSouvenir(photo: photo2, souvenir: souvenir))
    }

    // MARK: - Uniqueness Enforcement Tests

    @Test("Duplicate contact externalIdentifier throws")
    func testDuplicateContactExternalIdentifierThrows() throws {
        let contact1 = ContactEntity(context: viewContext)
        contact1.id = UUID()
        contact1.externalIdentifier = "external-123"
        contact1.createdAt = Date()
        try viewContext.save()

        let contact2 = ContactEntity(context: viewContext)
        contact2.id = UUID()
        contact2.externalIdentifier = "external-123"
        contact2.createdAt = Date()

        #expect(throws: ValidationError.custom("Duplicate contact externalIdentifier: external-123")) {
            try ValidationService.validateContact(contact2)
        }
    }

    @Test("Duplicate contact phoneE164 throws")
    func testDuplicateContactPhoneThrows() throws {
        let contact1 = ContactEntity(context: viewContext)
        contact1.id = UUID()
        contact1.phoneE164 = "+14155551234"
        contact1.createdAt = Date()
        try viewContext.save()

        let contact2 = ContactEntity(context: viewContext)
        contact2.id = UUID()
        contact2.phoneE164 = "+14155551234"
        contact2.createdAt = Date()

        #expect(throws: ValidationError.custom("Duplicate contact phoneE164: +14155551234")) {
            try ValidationService.validateContact(contact2)
        }
    }

    @Test("Allowing duplicate contact identifiers bypasses uniqueness errors")
    func testAllowDuplicateContactIdentifiers() throws {
        ValidationService.allowDuplicateContactIdentifiers(on: viewContext)
        defer {
            viewContext.userInfo["allowDuplicateContactExternalIdentifier"] = nil
            viewContext.userInfo["allowDuplicateContactPhoneE164"] = nil
        }

        let contact1 = ContactEntity(context: viewContext)
        contact1.id = UUID()
        contact1.externalIdentifier = "external-allow"
        contact1.phoneE164 = "+14155550000"
        contact1.createdAt = Date()
        try viewContext.save()

        let contact2 = ContactEntity(context: viewContext)
        contact2.id = UUID()
        contact2.externalIdentifier = "external-allow"
        contact2.phoneE164 = "+14155550000"
        contact2.createdAt = Date()

        try ValidationService.validateContact(contact2)
    }

    @Test("Duplicate photo assetLocalId throws")
    func testDuplicatePhotoAssetLocalIdThrows() throws {
        let photo1 = PhotoEntity(context: viewContext)
        photo1.id = UUID()
        photo1.assetLocalId = "local://asset-1"
        photo1.timestamp = Date()
        try viewContext.save()

        let photo2 = PhotoEntity(context: viewContext)
        photo2.id = UUID()
        photo2.assetLocalId = "local://asset-1"
        photo2.timestamp = Date()

        #expect(throws: ValidationError.custom("Duplicate photo assetLocalId: local://asset-1")) {
            try ValidationService.validatePhoto(photo2)
        }
    }

    @Test("Allowing duplicate photo assetLocalId bypasses uniqueness errors")
    func testAllowDuplicatePhotoAssetLocalId() throws {
        ValidationService.allowDuplicatePhotoAssetLocalId(on: viewContext)
        defer {
            viewContext.userInfo["allowDuplicatePhotoAssetLocalId"] = nil
        }

        let photo1 = PhotoEntity(context: viewContext)
        photo1.id = UUID()
        photo1.assetLocalId = "local://asset-2"
        photo1.timestamp = Date()
        try viewContext.save()

        let photo2 = PhotoEntity(context: viewContext)
        photo2.id = UUID()
        photo2.assetLocalId = "local://asset-2"
        photo2.timestamp = Date()

        try ValidationService.validatePhoto(photo2)
    }

    @Test("Duplicate share tokens throw")
    func testDuplicateShareTokensThrow() throws {
        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        try viewContext.save()

        let share1 = ShareEntity(context: viewContext)
        share1.id = UUID()
        share1.createdAt = Date()
        share1.expiresAt = Date().addingTimeInterval(60)
        share1.isRevoked = false
        share1.token = "token-123"
        share1.souvenir = souvenir
        try viewContext.save()

        let share2 = ShareEntity(context: viewContext)
        share2.id = UUID()
        share2.createdAt = Date()
        share2.expiresAt = Date().addingTimeInterval(60)
        share2.isRevoked = false
        share2.token = "token-123"
        share2.souvenir = souvenir

        #expect(throws: ValidationError.custom("Duplicate share token: token-123")) {
            try ValidationService.validateShare(share2)
        }
    }

    @Test("Allowing duplicate share tokens bypasses uniqueness errors")
    func testAllowDuplicateShareTokens() throws {
        ValidationService.allowDuplicateShareTokens(on: viewContext)
        defer {
            viewContext.userInfo["allowDuplicateShareToken"] = nil
        }

        let souvenir = SouvenirEntity(context: viewContext)
        souvenir.id = UUID()
        souvenir.createdAt = Date()
        souvenir.updatedAt = Date()
        try viewContext.save()

        let share1 = ShareEntity(context: viewContext)
        share1.id = UUID()
        share1.createdAt = Date()
        share1.expiresAt = Date().addingTimeInterval(60)
        share1.isRevoked = false
        share1.token = "token-allow"
        share1.souvenir = souvenir
        try viewContext.save()

        let share2 = ShareEntity(context: viewContext)
        share2.id = UUID()
        share2.createdAt = Date()
        share2.expiresAt = Date().addingTimeInterval(60)
        share2.isRevoked = false
        share2.token = "token-allow"
        share2.souvenir = souvenir

        try ValidationService.validateShare(share2)
    }
}
