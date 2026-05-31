import SwiftUI

/// Sheet presenting a ritual prescription emitted by the `rite` SSE event.
struct ViewsRiteSheetView: View {
    @EnvironmentObject private var accent: TreasureAccent
    let rite: RiteData
    let onDismiss: () -> Void

    private var shareText: String {
        var parts = [rite.riteName, "", rite.act]
        if let inv = rite.invocation { parts += ["", inv] }
        return parts.joined(separator: "\n")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Title
                    Text(rite.riteName)
                        .font(.system(size: 28, weight: .heavy, design: .serif))
                        .frame(maxWidth: .infinity, alignment: .leading)

                    // Bija seed syllable — prominent, accent-colored
                    if let bija = rite.bija {
                        Text(bija)
                            .font(.system(size: 40, weight: .bold, design: .serif))
                            .foregroundStyle(accent.color)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 4)
                    }

                    // Orientation
                    if let orientation = rite.orientation {
                        Text(orientation.lowercased())
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .tracking(0.5)
                    }

                    // Act
                    Text(rite.act)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    // Invocation
                    if let invocation = rite.invocation {
                        Text(invocation)
                            .font(.body.italic())
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Texture chips
                    if !rite.textures.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(rite.textures, id: \.self) { texture in
                                    Text(texture)
                                        .font(.system(.caption2, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Color.secondary.opacity(0.12), in: Capsule())
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            .navigationTitle("a rite for you")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ShareLink(
                        item: shareText,
                        preview: SharePreview(
                            rite.riteName,
                            image: Image(uiImage: UIImage(named: "AppIcon") ?? UIImage())
                        )
                    ) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .font(.system(.body, design: .monospaced))
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("done", action: onDismiss)
                        .font(.system(.body, design: .monospaced))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    ViewsRiteSheetView(
        rite: RiteData(
            riteName: "Threshold Breath",
            act: "Stand at any doorway. Before crossing, pause. Inhale for four counts, hold for four, exhale for eight. Cross with the exhale.",
            invocation: "I release what was. I receive what comes.",
            textures: ["breath", "stillness", "transition", "threshold"],
            bija: "हं",
            orientation: "face east, toward new light"
        ),
        onDismiss: {}
    )
    .environmentObject(TreasureAccent())
}
