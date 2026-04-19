import SwiftUI

struct ViewsSettingsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "gearshape")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Settings")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.primary)
            Text("Coming soon")
                .font(.callout)
                .foregroundStyle(.secondary)

            #if DEBUG
            NavigationLink(destination: ViewsDevToolsView()) {
                GlassCapsuleButton(
                    title: "Dev Tools",
                    systemImage: "hammer.fill",
                    action: {}
                )
                .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
            #endif
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
    }
}

#Preview {
    NavigationStack {
        ViewsSettingsView()
    }
}
