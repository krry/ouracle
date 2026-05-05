import SwiftUI

struct ViewsCovenantView: View {
    @EnvironmentObject private var accent: TreasureAccent
    let session: ChatSession

    @State private var lines: [String] = []
    @State private var accepting = false

    private let base = "https://api.ouracle.kerry.ink"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if lines.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 40)
                    } else {
                        ForEach(lines, id: \.self) { line in
                            Text(line)
                                .font(.system(.body, design: .serif))
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(24)
                .padding(.bottom, 40)
            }
            .navigationTitle("the covenant")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                Button {
                    accepting = true
                    Task {
                        await session.acceptCovenant()
                        accepting = false
                    }
                } label: {
                    Group {
                        if accepting {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("I accept")
                                .font(.system(.body, design: .monospaced).weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
                .disabled(accepting || lines.isEmpty)
                .foregroundStyle(accepting ? Color.secondary : accent.color)
                .background(.ultraThinMaterial)
                .overlay(alignment: .top) { Divider() }
            }
        }
        .task { await loadCovenant() }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled()
    }

    private func loadCovenant() async {
        guard let url = URL(string: base + "/covenant/current"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let text = json["text"] as? [String] else { return }
        lines = text
    }
}
