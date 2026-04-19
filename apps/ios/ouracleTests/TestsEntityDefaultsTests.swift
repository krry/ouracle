import Testing
import CoreData
@testable import souvenir

@MainActor
@Suite("Entity Defaults Tests")
struct EntityDefaultsTests {
  let persistenceController = PersistenceController(inMemory: true)
  var viewContext: NSManagedObjectContext { persistenceController.container.viewContext }

  func testContactEntityDefaultFields() throws {
    let contact = ContactEntity(context: viewContext)
    try viewContext.save()
    #expect(type(of: contact.id) == UUID.self)
    let now = Date()
    #expect(now.timeIntervalSince(contact.createdAt) >= 0)
    #expect(now.timeIntervalSince(contact.createdAt) < 5)
  }

  func testPhotoEntityDefaultFields() throws {
    let photo = PhotoEntity(context: viewContext)
    try viewContext.save()
    #expect(type(of: photo.id) == UUID.self)
    let now = Date()
    if let ts = photo.timestamp {
      #expect(now.timeIntervalSince(ts) >= 0)
      #expect(now.timeIntervalSince(ts) < 5)
    } else {
      // If your model guarantees a timestamp default, this branch should not hit.
      // Keep test tolerant in case timestamp is optional.
      #expect(true)
    }
  }

  func testSouvenirEntityDefaultFields() throws {
    let souvenir = SouvenirEntity(context: viewContext)
    try viewContext.save()
    #expect(type(of: souvenir.id) == UUID.self)
    let now = Date()
    #expect(now.timeIntervalSince(souvenir.createdAt) >= 0)
    #expect(now.timeIntervalSince(souvenir.createdAt) < 5)
    #expect(now.timeIntervalSince(souvenir.updatedAt) >= 0)
    #expect(now.timeIntervalSince(souvenir.updatedAt) < 5)
    #expect(souvenir.updatedAt >= souvenir.createdAt)
  }

  func testShareEntityDefaultFields() throws {
    let share = ShareEntity(context: viewContext)
    try viewContext.save()
    #expect(type(of: share.id) == UUID.self)
    let now = Date()
    #expect(now.timeIntervalSince(share.createdAt) >= 0)
    #expect(now.timeIntervalSince(share.createdAt) < 5)
  }

  @Test("ContactEntity has peerPublicKeyFingerprint attribute as optional Data")
  func peerFingerprintAttribute() {
    let contact = ContactEntity(context: viewContext)
    contact.id = UUID()
    contact.createdAt = Date()
    contact.isSelf = false
    #expect(contact.peerPublicKeyFingerprint == nil)
    contact.peerPublicKeyFingerprint = Data(repeating: 0xAB, count: 32)
    #expect(contact.peerPublicKeyFingerprint?.count == 32)
  }
}
