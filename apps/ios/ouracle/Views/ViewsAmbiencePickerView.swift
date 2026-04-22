import SwiftUI

struct ViewsAmbiencePickerView: View {
    @ObservedObject private var ambience = AmbienceService.shared
    @State private var isLoading = false
    @State private var loadFailed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            climePicker
            if ambience.manifest != nil {
                overlayPicker
                volumeControls
            }
        }
        .padding(20)
        .task {
            if ambience.manifest == nil {
                isLoading = true
                await ambience.loadManifest()
                isLoading = false
                loadFailed = ambience.manifest == nil
            }
        }
    }

    // MARK: - Climes

    private var climePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("clime")
            if let climes = ambience.manifest?.climes {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        climeChip(id: nil, label: "off")
                        ForEach(climes) { clime in
                            climeChip(id: clime.id, label: clime.label)
                        }
                    }
                }
            } else if isLoading {
                ProgressView().controlSize(.small)
            } else if loadFailed {
                Button {
                    loadFailed = false
                    isLoading = true
                    Task {
                        await ambience.loadManifest()
                        isLoading = false
                        loadFailed = ambience.manifest == nil
                    }
                } label: {
                    Text("retry")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(Color.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func climeChip(id: String?, label: String) -> some View {
        let active = ambience.activeClimeID == id
        return Button {
            ambience.playClime(id)
        } label: {
            Text(label)
                .font(.system(.caption, design: .monospaced).weight(active ? .semibold : .regular))
                .foregroundStyle(active ? Color.jing : Color.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(active ? Color.jing.opacity(0.12) : Color.secondary.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(active ? Color.jing.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Overlays

    private var overlayPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("overlays")
            if let overlays = ambience.manifest?.overlays {
                HStack(spacing: 8) {
                    ForEach(overlays) { overlay in
                        overlayChip(overlay)
                    }
                }
            }
        }
    }

    private func overlayChip(_ overlay: AmbienceTrack) -> some View {
        let active = ambience.activeOverlayIDs.contains(overlay.id)
        return Button {
            ambience.toggleOverlay(overlay.id)
        } label: {
            Text(overlay.label)
                .font(.system(.caption, design: .monospaced).weight(active ? .semibold : .regular))
                .foregroundStyle(active ? Color.qi : Color.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(active ? Color.qi.opacity(0.12) : Color.secondary.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(active ? Color.qi.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Volume

    private var volumeControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            if ambience.activeClimeID != nil {
                HStack(spacing: 10) {
                    label("scene")
                    Slider(value: Binding(
                        get: { ambience.climeVolume },
                        set: { ambience.setClimeVolume($0) }
                    ), in: 0...1)
                    .tint(Color.jing)
                }
            }
            if !ambience.activeOverlayIDs.isEmpty {
                HStack(spacing: 10) {
                    label("tones")
                    Slider(value: Binding(
                        get: { ambience.overlayVolume },
                        set: { ambience.setOverlayVolume($0) }
                    ), in: 0...1)
                    .tint(Color.qi)
                }
            }
        }
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.tertiary)
            .tracking(1)
            .textCase(.uppercase)
    }
}

#Preview {
    ViewsAmbiencePickerView()
        .padding()
}
