import SwiftUI

struct ViewsThreadsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("threads")
                .font(.system(size: 20, weight: .semibold, design: .serif))
            Text("conversations coming soon")
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("threads")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        ViewsThreadsView()
    }
}
