import Testing
import Foundation
@testable import souvenir

@MainActor
@Suite("Agent Tools Tests")
struct TestsAgentTools {

    @Test("toggle_view_mode posts notification")
    func testToggleViewMode() async throws {
        let tool = ToggleViewModeTool()
        let expectation = NotificationExpectation(name: .svnrSetViewMode)
        defer { expectation.invalidate() }

        let result = try await tool.run(["mode": "map"])
        #expect(result.ok == true)

        let notification = await expectation.wait(timeout: 2)
        #expect(notification != nil)
        let mode = notification?.userInfo?["mode"] as? String
        #expect(mode == "map")
    }

    @Test("request_camera posts notification")
    func testRequestCamera() async throws {
        let tool = RequestCameraTool()
        let expectation = NotificationExpectation(name: .svnrRequestCamera)
        defer { expectation.invalidate() }

        let result = try await tool.run([:])
        #expect(result.ok == true)

        let notification = await expectation.wait(timeout: 2)
        #expect(notification != nil)
    }

    @Test("set_favorite_souvenir writes user defaults")
    func testSetFavoriteSouvenir() async throws {
        let tool = SetFavoriteSouvenirTool()
        let id = UUID()

        let result = try await tool.run(["souvenir_id": id.uuidString])
        #expect(result.ok == true)
        #expect(UserDefaults.standard.string(forKey: "favoriteSouvenirID") == id.uuidString)
    }

    @Test("navigate_souvenir posts notification")
    func testNavigateSouvenir() async throws {
        let tool = NavigateSouvenirTool()
        let souvenirId = UUID()
        let expectation = NotificationExpectation(name: .svnrFocusSouvenir)
        defer { expectation.invalidate() }

        let result = try await tool.run(["souvenir_id": souvenirId.uuidString])
        #expect(result.ok == true)

        let notification = await expectation.wait(timeout: 2)
        #expect(notification != nil)
        let receivedId = notification?.userInfo?["souvenirID"] as? UUID
        #expect(receivedId == souvenirId)
    }

    @Test("open_dev_tools posts notification")
    func testOpenDevTools() async throws {
        let tool = OpenDevToolsTool()
        let expectation = NotificationExpectation(name: .svnrOpenDevTools)
        defer { expectation.invalidate() }

        let result = try await tool.run([:])
        #expect(result.ok == true)

        let notification = await expectation.wait(timeout: 2)
        #expect(notification != nil)
    }
}

private final class NotificationExpectation {
    private let name: Notification.Name
    private var observer: NSObjectProtocol?
    private var continuation: CheckedContinuation<Notification, Never>?
    private var lastNotification: Notification?

    init(name: Notification.Name) {
        self.name = name
        observer = NotificationCenter.default.addObserver(
            forName: name,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.lastNotification = notification
            self?.continuation?.resume(returning: notification)
            self?.continuation = nil
        }
    }

    func wait(timeout seconds: TimeInterval) async -> Notification? {
        if let lastNotification {
            return lastNotification
        }
        // Notification is not Sendable on iOS, so wrap it for task group use.
        struct Box: @unchecked Sendable { let notification: Notification? }
        return await withTaskGroup(of: Box.self) { group in
            group.addTask { [weak self] in
                if let lastNotification = self?.lastNotification {
                    return Box(notification: lastNotification)
                }
                let n = await withCheckedContinuation { continuation in
                    self?.continuation = continuation
                }
                return Box(notification: n)
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                return Box(notification: nil)
            }
            let result = await group.next() ?? Box(notification: nil)
            group.cancelAll()
            return result.notification
        }
    }

    func invalidate() {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
