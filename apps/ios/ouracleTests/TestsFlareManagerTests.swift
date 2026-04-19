//  TestsFlareManagerTests.swift
//  souvenirTests

import Testing
import SwiftUI
@testable import souvenir

@Suite("FlareManager")
@MainActor
struct FlareManagerTests {

    // MARK: - show

    @Test("show adds a flare")
    func showAddsFlare() {
        let manager = FlareManager()
        manager.show(Flare(id: "a", duration: .infinity))
        #expect(manager.activeFlares.count == 1)
        #expect(manager.activeFlares.first?.id == "a")
    }

    @Test("show replaces existing flare with same id")
    func showReplacesById() {
        let manager = FlareManager()
        manager.show(Flare(id: "dup", color: .blue, duration: .infinity))
        manager.show(Flare(id: "dup", color: .red, duration: .infinity))
        #expect(manager.activeFlares.count == 1)
        #expect(manager.activeFlares.first?.color == .red)
    }

    @Test("show accepts multiple flares with distinct ids")
    func showMultiple() {
        let manager = FlareManager()
        manager.show(Flare(id: "x", duration: .infinity))
        manager.show(Flare(id: "y", duration: .infinity))
        #expect(manager.activeFlares.count == 2)
    }

    // MARK: - dismiss

    @Test("dismiss removes the matching flare")
    func dismissRemoves() {
        let manager = FlareManager()
        manager.show(Flare(id: "b", duration: .infinity))
        manager.dismiss(id: "b")
        #expect(manager.activeFlares.isEmpty)
    }

    @Test("dismiss unknown id is a no-op")
    func dismissUnknown() {
        let manager = FlareManager()
        manager.show(Flare(id: "c", duration: .infinity))
        manager.dismiss(id: "nope")
        #expect(manager.activeFlares.count == 1)
    }

    // MARK: - dismissAll

    @Test("dismissAll clears all flares")
    func dismissAll() {
        let manager = FlareManager()
        manager.show(Flare(id: "1", duration: .infinity))
        manager.show(Flare(id: "2", duration: .infinity))
        manager.show(Flare(id: "3", duration: .infinity))
        manager.dismissAll()
        #expect(manager.activeFlares.isEmpty)
    }

    // MARK: - Flare defaults

    @Test("Flare default values are sensible")
    func flareDefaults() {
        let flare = Flare()
        #expect(!flare.id.isEmpty)
        #expect(flare.size == 14)
        #expect(flare.duration == 4)
        #expect(flare.targetID == nil)
        #expect(flare.action == nil)
    }

    @Test("Flare with .infinity duration is not auto-dismissed")
    func persistentFlare() async throws {
        let manager = FlareManager()
        manager.show(Flare(id: "persist", duration: .infinity))
        try await Task.sleep(for: .milliseconds(100))
        #expect(manager.activeFlares.first?.id == "persist")
    }
}
