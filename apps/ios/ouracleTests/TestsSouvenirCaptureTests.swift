//
//  SouvenirCaptureTests.swift
//  souvenirTests
//
//  Created for Phase 2.5 - Testing souvenir creation flows
//

import Testing
import CoreData
@testable import souvenir

/// Tests for souvenir creation flows covering:
/// - New photo + new contact
/// - Existing photo + new contact
/// - New photo + existing contact
@MainActor
@Suite("Souvenir Capture Tests")
struct SouvenirCaptureTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext

    init() {
        // Use in-memory store for testing
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Test: New Photo + New Contact

    @Test("Create souvenir with new photo and new contact")
    func createSouvenirWithNewPhotoAndNewContact() async throws {
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create a new contact
        let contact = try await contactService.createContact(
            givenName: "Test",
            familyName: "User",
            phone: "(217) 555-0100"
        )

        #expect(contact.givenName == "Test")
        #expect(contact.familyName == "User")
        #expect(contact.phoneE164 == "+12175550100")

        // Create photo metadata
        let photoMetadata = PhotoMetadata(
            assetLocalId: "test-asset-123",
            timestamp: Date(),
            timezoneID: TimeZone.current.identifier,
            location: nil
        )

        // Create souvenir with new photo and new contact
        let souvenirID = try await service.createSouvenir(
            photo: photoMetadata,
            contact: contact,
            caption: "Test caption"
        )

        // Fetch the souvenir to verify
        let souvenir = try await viewContext.perform {
            let request = SouvenirEntity.fetchRequest()
            request.predicate = NSPredicate(format: "id == %@", souvenirID as CVarArg)
            request.fetchLimit = 1
            return try self.viewContext.fetch(request).first
        }

        let unwrappedSouvenir = try #require(souvenir)

        #expect(unwrappedSouvenir.primaryContact?.id == contact.id)
        #expect(unwrappedSouvenir.caption == "Test caption")
        #expect(unwrappedSouvenir.photosArray.count == 1)
        #expect(unwrappedSouvenir.photosArray.first?.assetLocalId == "test-asset-123")
    }

    // MARK: - Test: Existing Photo + New Contact

    @Test("Create souvenir with existing photo and new contact")
    func createSouvenirWithExistingPhotoAndNewContact() async throws {
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create first contact and souvenir
        let firstContact = try await contactService.createContact(
            givenName: "First",
            familyName: "Contact",
            phone: "+12175550101"
        )

        let photoMetadata = PhotoMetadata(
            assetLocalId: "shared-asset-456",
            timestamp: Date(),
            timezoneID: TimeZone.current.identifier,
            location: nil
        )

        let firstSouvenirID = try await service.createSouvenir(
            photo: photoMetadata,
            contact: firstContact,
            caption: "First souvenir"
        )

        // Fetch first souvenir to get the photo entity
        let firstSouvenir = try await viewContext.perform {
            let request = SouvenirEntity.fetchRequest()
            request.predicate = NSPredicate(format: "id == %@", firstSouvenirID as CVarArg)
            request.fetchLimit = 1
            return try self.viewContext.fetch(request).first
        }

        let unwrappedFirstSouvenir = try #require(firstSouvenir)

        // Get the photo entity
        let photoEntity = unwrappedFirstSouvenir.photosArray.first
        let unwrappedPhotoEntity = try #require(photoEntity)

        // Create second contact
        let secondContact = try await contactService.createContact(
            givenName: "Second",
            familyName: "Contact",
            phone: "+12175550102"
        )

        // Create second souvenir with SAME photo metadata (should reuse existing photo)
        let secondSouvenirID = try await service.createSouvenir(
            photo: photoMetadata,
            contact: secondContact,
            caption: "Second souvenir"
        )

        // Fetch second souvenir to verify
        let secondSouvenir = try await viewContext.perform {
            let request = SouvenirEntity.fetchRequest()
            request.predicate = NSPredicate(format: "id == %@", secondSouvenirID as CVarArg)
            request.fetchLimit = 1
            return try self.viewContext.fetch(request).first
        }

        let unwrappedSecondSouvenir = try #require(secondSouvenir)

        #expect(unwrappedSecondSouvenir.primaryContact?.id == secondContact.id)
        #expect(unwrappedSecondSouvenir.photosArray.count == 1)

        // Verify the photo is shared between both souvenirs
        let secondPhoto = unwrappedSecondSouvenir.photosArray.first
        #expect(secondPhoto?.id == unwrappedPhotoEntity.id, "Should reuse existing photo")
        #expect(secondPhoto?.assetLocalId == "shared-asset-456")
    }

    // MARK: - Test: New Photo + Existing Contact

    @Test("Create souvenir with new photo and existing contact")
    func createSouvenirWithNewPhotoAndExistingContact() async throws {
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create contact
        let contact = try await contactService.createContact(
            givenName: "Reused",
            familyName: "Contact",
            phone: "+12175550103"
        )

        // Create first souvenir with first photo
        let firstPhoto = PhotoMetadata(
            assetLocalId: "photo-1",
            timestamp: Date(),
            timezoneID: TimeZone.current.identifier,
            location: nil
        )

        let firstSouvenirID = try await service.createSouvenir(
            photo: firstPhoto,
            contact: contact,
            caption: "First photo"
        )

        // Fetch first souvenir to verify
        let firstSouvenir = try await viewContext.perform {
            let request = SouvenirEntity.fetchRequest()
            request.predicate = NSPredicate(format: "id == %@", firstSouvenirID as CVarArg)
            request.fetchLimit = 1
            return try self.viewContext.fetch(request).first
        }

        let unwrappedFirstSouvenir = try #require(firstSouvenir)

        #expect(unwrappedFirstSouvenir.primaryContact?.id == contact.id)
        #expect(unwrappedFirstSouvenir.photosArray.count == 1)

        // Creating a second souvenir with the SAME contact must throw — one souvenir per contact.
        let secondPhoto = PhotoMetadata(
            assetLocalId: "photo-2",
            timestamp: Date().addingTimeInterval(60),
            timezoneID: TimeZone.current.identifier,
            location: nil
        )

        await #expect(throws: SouvenirCaptureError.self) {
            try await service.createSouvenir(
                photo: secondPhoto,
                contact: contact,
                caption: "Second photo"
            )
        }
    }

    // MARK: - Test: System Contact Import

    @Test("Import system contact with proper field mapping")
    func importSystemContact() async throws {
        // Note: This test uses mock data since we can't access CNContactStore in tests
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create a contact manually (simulating import)
        let contact = try await contactService.createContact(
            givenName: "System",
            familyName: "Contact",
            phone: "(555) 123-4567"
        )

        // Verify E.164 normalization
        #expect(contact.phoneE164 == "+15551234567")

        // Verify composite name
        #expect(contact.compositeName == "System Contact")

        // Verify display name
        #expect(contact.displayName == "System Contact")
    }

    // MARK: - Phase 14: Validation Tests

    @Test("Contact creation fails without given name")
    func contactCreationFailsWithoutGivenName() async throws {
        let contactService = ContactSearchService(persistenceController: persistenceController)

        do {
            _ = try await contactService.createContact(
                givenName: nil,
                familyName: "Smith",
                phone: "+12175551234"
            )
            Issue.record("Expected ValidationError.contactRequiresGivenName")
        } catch let error as ValidationError {
            #expect(error == ValidationError.contactRequiresGivenName)
        }
    }

    @Test("Contact creation fails without phone or email")
    func contactCreationFailsWithoutPhoneOrEmail() async throws {
        let contactService = ContactSearchService(persistenceController: persistenceController)

        do {
            _ = try await contactService.createContact(
                givenName: "John",
                familyName: "Smith",
                phone: nil
            )
            Issue.record("Expected ValidationError.contactRequiresPhoneOrEmail")
        } catch let error as ValidationError {
            #expect(error == ValidationError.contactRequiresPhoneOrEmail)
        }
    }

    @Test("Contact creation succeeds with email only")
    func contactCreationSucceedsWithEmailOnly() async throws {
        let contactService = ContactSearchService(persistenceController: persistenceController)

        let contact = try await contactService.createContact(
            givenName: "John",
            familyName: "Smith",
            phone: nil,
            email: "john@example.com"
        )

        #expect(contact.givenName == "John")
        #expect(contact.email == "john@example.com")
    }

    @Test("Souvenir creation fails with invalid phone format")
    func souvenirCreationFailsWithInvalidPhone() async throws {
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // This should fail because the phone can't be normalized to E.164
        do {
            _ = try await contactService.createContact(
                givenName: "Test",
                familyName: "User",
                phone: "invalid-phone"
            )
            Issue.record("Expected ValidationError.invalidPhoneFormat")
        } catch let error as ValidationError {
            #expect(error == ValidationError.invalidPhoneFormat("invalid-phone"))
        }
    }

    @Test("Souvenir creation fails with invalid coordinates")
    func souvenirCreationFailsWithInvalidCoordinates() async throws {
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create valid contact
        let contact = try await contactService.createContact(
            givenName: "Test",
            familyName: "User",
            phone: "+12175550100"
        )

        let photoMetadata = PhotoMetadata(
            assetLocalId: "test-asset-123",
            timestamp: Date(),
            timezoneID: TimeZone.current.identifier,
            location: (latitude: 91.0, longitude: 181.0) // Invalid coordinates
        )

        // This should fail because coordinates are out of range
        do {
            _ = try await service.createSouvenir(
                photo: photoMetadata,
                contact: contact,
                caption: "Test caption"
            )
            Issue.record("Expected ValidationError.invalidGeographicRange")
        } catch let error as ValidationError {
            #expect(error == ValidationError.invalidGeographicRange(field: "latitude", value: 91.0, min: -90.0, max: 90.0))
        }
    }

    @Test("Souvenir creation succeeds with valid data")
    func souvenirCreationSucceedsWithValidData() async throws {
        let service = SouvenirCaptureService(persistenceController: persistenceController)
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create valid contact
        let contact = try await contactService.createContact(
            givenName: "Test",
            familyName: "User",
            phone: "+12175550100"
        )

        let photoMetadata = PhotoMetadata(
            assetLocalId: "test-asset-123",
            timestamp: Date(),
            timezoneID: TimeZone.current.identifier,
            location: (latitude: 40.7128, longitude: -74.0060) // Valid coordinates (NYC)
        )

        // This should succeed
        let souvenirID = try await service.createSouvenir(
            photo: photoMetadata,
            contact: contact,
            caption: "Test caption"
        )

        // Verify souvenir was created
        let souvenir = try await viewContext.perform {
            let request = SouvenirEntity.fetchRequest()
            request.predicate = NSPredicate(format: "id == %@", souvenirID as CVarArg)
            request.fetchLimit = 1
            return try self.viewContext.fetch(request).first
        }

        let unwrappedSouvenir = try #require(souvenir)
        #expect(unwrappedSouvenir.primaryContact?.id == contact.id)
        #expect(unwrappedSouvenir.photosArray.count == 1)
    }

    // MARK: - Test: Contact Search

    @Test("Search contacts by name")
    func searchContactsByName() async throws {
        let contactService = ContactSearchService(persistenceController: persistenceController)

        // Create multiple contacts
        _ = try await contactService.createContact(
            givenName: "Alice",
            familyName: "Anderson",
            phone: "+12175550104"
        )

        _ = try await contactService.createContact(
            givenName: "Bob",
            familyName: "Brown",
            phone: "+12175550105"
        )

        _ = try await contactService.createContact(
            givenName: "Charlie",
            familyName: "Anderson",
            phone: "+12175550106"
        )

        // Search for "Anderson"
        let results = try await contactService.searchContacts(query: "Anderson")

        #expect(results.count == 2)
        #expect(results.contains(where: { $0.givenName == "Alice" }))
        #expect(results.contains(where: { $0.givenName == "Charlie" }))
    }
}
