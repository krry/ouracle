import UIKit
import UserNotifications

@MainActor
final class PushManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushManager()

    private override init() { super.init() }

    func configure() {
        UNUserNotificationCenter.current().delegate = self
        requestAuthorizationAndRegister()
    }

    private func requestAuthorizationAndRegister() {
        #if targetEnvironment(simulator)
        return
        #endif
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
