import SwiftUI
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await AuthService.shared.registerPushToken(deviceToken) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("🔔 [Push] Failed to register: \(error)")
    }
}

@main
struct OuracleApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear { PushManager.shared.configure() }
                .task {
                    do {
                        try await DeviceAuthService.shared.authenticate()
                    } catch {
                        print("[Auth] device auth failed: \(error)")
                    }
                    await PerformanceWarmer.shared.warmup()
                }
        }
    }
}
