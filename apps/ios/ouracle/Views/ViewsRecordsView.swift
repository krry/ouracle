import SwiftUI

struct ViewsRecordsView: View {
    @State private var sessions: [SessionRecord] = []
    @State private var isLoading = true
    @State private var failed = false

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if sessions.isEmpty {
                emptyState
            } else {
                sessionList
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: - List

    private var sessionList: some View {
        List(sessions) { session in
            SessionRow(session: session)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("☷")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("no records yet")
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(.secondary)
            Text("your sessions will appear here")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func load() async {
        isLoading = true
        sessions = await SessionsService.shared.fetchThread()
        isLoading = false
    }
}

// MARK: - SessionRow

private struct SessionRow: View {
    let session: SessionRecord

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(Self.dateFmt.string(from: session.createdAt))
                    .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                    .foregroundStyle(.primary)
                Spacer()
                stagePill
            }

            if let quality = session.quality {
                Text(quality)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            if let rite = session.riteName {
                HStack(spacing: 6) {
                    Text(session.enacted ? "✦" : "◇")
                        .font(.caption2)
                        .foregroundStyle(session.enacted ? Color.qi : Color.secondary)
                    Text(rite)
                        .font(.system(.caption, design: .serif).italic())
                        .foregroundStyle(session.enacted ? Color.qi : Color.secondary)
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }

    private var stagePill: some View {
        let (label, color): (String, Color) = switch session.stage {
        case "complete":   ("complete", .qi)
        case "prescribed": ("prescribed", .jing)
        default:           (session.stage, .secondary)
        }
        return Text(label)
            .font(.system(.caption2, design: .monospaced).weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
    }
}

#Preview {
    NavigationStack {
        ViewsRecordsView()
    }
}
