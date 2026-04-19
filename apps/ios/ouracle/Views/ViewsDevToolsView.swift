import SwiftUI

struct ViewsDevToolsView: View {
    @State private var authStatus = "checking..."
    @ObservedObject private var auth = DeviceAuthService.shared

    var body: some View {
        List {
            Section("Auth") {
                LabeledContent("device authenticated", value: auth.isAuthenticated ? "yes" : "no")
                LabeledContent("access token", value: AuthService.shared.activeAccessToken != nil ? "present" : "absent")
            }

            Section("Build") {
                LabeledContent("bundle", value: Bundle.main.bundleIdentifier ?? "—")
                LabeledContent("version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                LabeledContent("build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—")
            }

            Section("Actions") {
                Button("re-authenticate") {
                    Task { try? await DeviceAuthService.shared.authenticate() }
                }
                .foregroundStyle(Color.jing)
            }
        }
        .navigationTitle("dev tools")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        ViewsDevToolsView()
    }
}
