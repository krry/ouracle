//
//  TestsRingOrderServiceTests.swift
//  souvenirTests
//
//  Tests for the Ring model (capacity boundaries and from(ringOrder:) mapping)
//  and RingOrderService (applyOrderedBonds, reorderBond, ring cascade).
//
//  BondEntity/Ring are the backbone of the trust-forest rings feature introduced
//  in v0.6. These tests lock the boundary behaviour so it can't silently regress.
//

import Testing
import CoreData
@testable import souvenir

@MainActor
@Suite("Ring and RingOrderService Tests")
struct TestsRingOrderServiceTests {

    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext

    init() {
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }

    // MARK: - Helpers

    private func makeContact(name: String) -> ContactEntity {
        let c = ContactEntity(context: viewContext)
        c.id = UUID()
        c.givenName = name
        c.compositeName = name
        c.createdAt = Date()
        return c
    }

    /// Create a bond with an explicit ringOrder and matching ring.
    private func makeBond(owner: ContactEntity, contact: ContactEntity, ringOrder: Int16) -> BondEntity {
        let b = BondEntity(context: viewContext)
        b.owner = owner
        b.contact = contact
        b.ringOrder = ringOrder
        b.ring = Ring.from(ringOrder: ringOrder).rawValue
        return b
    }

    /// Create a bond with ring/ringOrder both set to 0 (uninitialized state).
    private func makeRawBond(owner: ContactEntity, contact: ContactEntity) -> BondEntity {
        let b = BondEntity(context: viewContext)
        b.owner = owner
        b.contact = contact
        b.ringOrder = 0
        b.ring = 0
        return b
    }

    // MARK: - Ring.from(ringOrder:) — boundary values

    @Test("ringOrder 1 maps to innerFire")
    func ringOrder1_innerFire() {
        #expect(Ring.from(ringOrder: 1) == .innerFire)
    }

    @Test("ringOrder 5 is the innerFire upper boundary")
    func ringOrder5_innerFire() {
        #expect(Ring.from(ringOrder: 5) == .innerFire)
        // capacity = 5 — still innerFire
        #expect(Ring.innerFire.capacity == 5)
    }

    @Test("ringOrder 6 crosses into innerCircle")
    func ringOrder6_innerCircle() {
        #expect(Ring.from(ringOrder: 6) == .innerCircle)
    }

    @Test("ringOrder 20 is the innerCircle upper boundary")
    func ringOrder20_innerCircle() {
        // innerFire(5) + innerCircle(15) = 20
        #expect(Ring.from(ringOrder: 20) == .innerCircle)
        #expect(Ring.innerFire.capacity + Ring.innerCircle.capacity == 20)
    }

    @Test("ringOrder 21 crosses into closeFriends")
    func ringOrder21_closeFriends() {
        #expect(Ring.from(ringOrder: 21) == .closeFriends)
    }

    @Test("ringOrder 70 is the closeFriends upper boundary")
    func ringOrder70_closeFriends() {
        // innerFire(5) + innerCircle(15) + closeFriends(50) = 70
        #expect(Ring.from(ringOrder: 70) == .closeFriends)
        #expect(Ring.innerFire.capacity + Ring.innerCircle.capacity + Ring.closeFriends.capacity == 70)
    }

    @Test("ringOrder 71 crosses into friends")
    func ringOrder71_friends() {
        #expect(Ring.from(ringOrder: 71) == .friends)
    }

    @Test("ringOrder 0 clamps to innerFire (min 1 guard)")
    func ringOrder0_clampsToInnerFire() {
        // from(ringOrder:) does max(1, Int(ringOrder)) so 0 → 1 → innerFire
        #expect(Ring.from(ringOrder: 0) == .innerFire)
    }

    // MARK: - Ring.from(_ rawValue:)

    @Test("Ring.from rawValue round-trips for all cases")
    func ringFromRawValue_allCases() {
        for ring in Ring.allCases {
            #expect(Ring.from(ring.rawValue) == ring)
        }
    }

    @Test("Ring.from unknown rawValue returns unassigned")
    func ringFromUnknownRawValue_unassigned() {
        #expect(Ring.from(99) == .unassigned)
    }

    // MARK: - applyOrderedBonds

    @Test("applyOrderedBonds assigns sequential ringOrder and correct ring for each bond")
    func applyOrderedBonds_setsRingAndOrder() throws {
        let owner = makeContact(name: "Owner-A")
        let contacts = (1...3).map { makeContact(name: "C\($0)") }
        // Start all bonds at ringOrder 0 so apply is forced to update every one.
        let bonds = contacts.map { makeRawBond(owner: owner, contact: $0) }
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        let affected = service.applyOrderedBonds(bonds)

        // All three need updating from 0 → correct value
        #expect(affected.count == 3)
        #expect(bonds[0].ringOrder == 1)
        #expect(bonds[1].ringOrder == 2)
        #expect(bonds[2].ringOrder == 3)
        // All three are within innerFire capacity (1–5)
        for b in bonds {
            #expect(Ring.from(b.ring) == .innerFire)
        }
    }

    @Test("applyOrderedBonds in reverse order reassigns all ringOrders")
    func applyOrderedBonds_reverseOrder() throws {
        let owner = makeContact(name: "Owner-B")
        let c1 = makeContact(name: "First")
        let c2 = makeContact(name: "Second")
        let c3 = makeContact(name: "Third")
        let b1 = makeBond(owner: owner, contact: c1, ringOrder: 1)
        let b2 = makeBond(owner: owner, contact: c2, ringOrder: 2)
        let b3 = makeBond(owner: owner, contact: c3, ringOrder: 3)
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        // Reverse: b3 first, b1 last
        let affected = service.applyOrderedBonds([b3, b2, b1])

        #expect(affected.count == 2) // b3 and b1 swap; b2 stays at position 2
        #expect(b3.ringOrder == 1)
        #expect(b2.ringOrder == 2)
        #expect(b1.ringOrder == 3)
    }

    @Test("applyOrderedBonds skips bonds already in correct position")
    func applyOrderedBonds_noOpWhenAlreadyCorrect() throws {
        let owner = makeContact(name: "Owner-C")
        let c1 = makeContact(name: "Alpha")
        let c2 = makeContact(name: "Beta")
        let b1 = makeBond(owner: owner, contact: c1, ringOrder: 1)
        let b2 = makeBond(owner: owner, contact: c2, ringOrder: 2)
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        let affected = service.applyOrderedBonds([b1, b2])
        #expect(affected.isEmpty)
    }

    @Test("applyOrderedBonds cascades ring when bond crosses innerFire→innerCircle boundary")
    func applyOrderedBonds_cascadesRingAtBoundary() throws {
        let owner = makeContact(name: "Owner-D")
        // 6 bonds starting at ringOrder 0 — apply will assign 1..6
        var bonds: [BondEntity] = []
        for i in 1...6 {
            let c = makeContact(name: "Contact-\(i)")
            bonds.append(makeRawBond(owner: owner, contact: c))
        }
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        service.applyOrderedBonds(bonds)

        // Positions 1–5 → innerFire; position 6 → innerCircle
        for i in 0..<5 {
            #expect(Ring.from(bonds[i].ring) == .innerFire, "bond at position \(i + 1) should be innerFire")
        }
        #expect(Ring.from(bonds[5].ring) == .innerCircle, "bond at position 6 should be innerCircle")
    }

    // MARK: - reorderBond

    @Test("reorderBond moves a bond from last to first position")
    func reorderBond_lastToFirst() throws {
        let owner = makeContact(name: "Owner-E")
        let c1 = makeContact(name: "One")
        let c2 = makeContact(name: "Two")
        let c3 = makeContact(name: "Three")
        let b1 = makeBond(owner: owner, contact: c1, ringOrder: 1)
        let b2 = makeBond(owner: owner, contact: c2, ringOrder: 2)
        let b3 = makeBond(owner: owner, contact: c3, ringOrder: 3)
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        // Move b3 (currently at position 3) to position 1
        let affected = try service.reorderBond(b3, from: 3, to: 1)

        #expect(!affected.isEmpty)
        #expect(b3.ringOrder == 1)
        #expect(b1.ringOrder == 2)
        #expect(b2.ringOrder == 3)
    }

    @Test("reorderBond moves a bond from first to last position")
    func reorderBond_firstToLast() throws {
        let owner = makeContact(name: "Owner-F")
        let c1 = makeContact(name: "One")
        let c2 = makeContact(name: "Two")
        let c3 = makeContact(name: "Three")
        let b1 = makeBond(owner: owner, contact: c1, ringOrder: 1)
        let b2 = makeBond(owner: owner, contact: c2, ringOrder: 2)
        let b3 = makeBond(owner: owner, contact: c3, ringOrder: 3)
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        let affected = try service.reorderBond(b1, from: 1, to: 3)

        #expect(!affected.isEmpty)
        #expect(b2.ringOrder == 1)
        #expect(b3.ringOrder == 2)
        #expect(b1.ringOrder == 3)
    }

    @Test("reorderBond with same from/to is a no-op")
    func reorderBond_samePosition_noOp() throws {
        let owner = makeContact(name: "Owner-G")
        let c1 = makeContact(name: "Static")
        let b1 = makeBond(owner: owner, contact: c1, ringOrder: 2)
        try viewContext.save()

        let service = RingOrderService(viewContext: viewContext, owner: owner)
        let affected = try service.reorderBond(b1, from: 2, to: 2)
        #expect(affected.isEmpty)
    }

    // MARK: - BondEntity defaults

    @Test("BondEntity awakeFromInsert sets id, createdAt, updatedAt")
    func bondEntity_defaultsFromAwakeFromInsert() throws {
        let owner = makeContact(name: "Owner-H")
        let contact = makeContact(name: "Target-H")
        let b = BondEntity(context: viewContext)
        b.owner = owner
        b.contact = contact
        b.ringOrder = 1
        b.ring = Ring.innerFire.rawValue
        try viewContext.save()

        #expect(b.id != nil)
        #expect(b.createdAt <= Date())
        #expect(b.updatedAt <= Date())
    }
}
