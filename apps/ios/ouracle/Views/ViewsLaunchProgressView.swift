import SwiftUI

struct LaunchProgressView: View {
    @ObservedObject var warmer: PerformanceWarmer

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()

            VStack(spacing: 32) {
                Text("ouracle")
                    .font(.system(size: 48, weight: .heavy, design: .serif))
                    .foregroundStyle(.primary)

                if warmer.state == .warming {
                    ProgressView()
                        .controlSize(.regular)
                }
            }
        }
    }
}

#Preview {
    LaunchProgressView(warmer: PerformanceWarmer.shared)
}
