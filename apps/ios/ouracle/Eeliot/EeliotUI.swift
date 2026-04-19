import SwiftUI

public struct EeliotPresenter: ViewModifier {
    @Bindable var engine: EeliotEngine

    public init(engine: EeliotEngine) {
        self.engine = engine
    }

    public func body(content: Content) -> some View {
        content
            .overlay {
                if let session = engine.active {
                    EeliotOverlay(
                        session: session,
                        onDismiss: { engine.dismiss(reason: $0) },
                        onSubmit: { engine.submit($0) }
                    )
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                    .zIndex(1000)
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.9), value: engine.active)
    }
}

public extension View {
    func eeliotPresenter(engine: EeliotEngine) -> some View {
        modifier(EeliotPresenter(engine: engine))
    }
}

private struct EeliotOverlay: View {
    let session: EeliotSession
    let onDismiss: (EeliotDismissReason) -> Void
    let onSubmit: (EeliotResponseValue) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.black.opacity(0.15)
                .ignoresSafeArea()
                .onTapGesture { onDismiss(.close) }

            VStack {
                Spacer()
                EeliotCard(session: session, onDismiss: onDismiss, onSubmit: onSubmit)
                    .padding(16)
                    .shadow(color: .black.opacity(0.12), radius: 30, x: 0, y: 16)
            }
        }
        .transaction { txn in
            if reduceMotion { txn.animation = nil }
        }
        .accessibilityAddTraits(.isModal)
    }
}

private struct EeliotCard: View {
    let session: EeliotSession
    let onDismiss: (EeliotDismissReason) -> Void
    let onSubmit: (EeliotResponseValue) -> Void

    @State private var text: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 10) {
                EeliotAlienMark()
                VStack(alignment: .leading, spacing: 2) {
                    Text("Eeliot")
                        .font(.system(.headline, design: .rounded))
                    Text(session.trigger)
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    onDismiss(.close)
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .padding(10)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .buttonStyle(.plain)
            }

            Text(session.prompt.question)
                .font(.system(.title3, design: .rounded).weight(.semibold))

            switch session.prompt.answerType {
            case .emoji5:
                EeliotEmoji5Scale { value in
                    onSubmit(.emoji5(value))
                }
            case .mcq:
                Text("MCQ not wired yet.")
                    .font(.system(.callout, design: .rounded))
                    .foregroundStyle(.secondary)
            case .text:
                TextField("Tell us what happened", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                Button("Send") {
                    onSubmit(.text(text.trimmingCharacters(in: .whitespacesAndNewlines)))
                }
                .buttonStyle(.borderedProminent)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            HStack {
                Button("Not now") {
                    onDismiss(.notNow)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)

                Spacer()
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(.white.opacity(0.15), lineWidth: 1)
        )
    }
}

private struct EeliotEmoji5Scale: View {
    let onSelect: (Int) -> Void

    private let emojis = ["😡", "😕", "😐", "🙂", "🤩"]

    var body: some View {
        HStack(spacing: 10) {
            ForEach(Array(emojis.enumerated()), id: \.offset) { idx, emoji in
                Button {
                    onSelect(idx + 1)
                } label: {
                    Text(emoji)
                        .font(.system(size: 28))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct EeliotAlienMark: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)
                .frame(width: 34, height: 34)
                .overlay(Circle().strokeBorder(.white.opacity(0.2), lineWidth: 1))
            HStack(spacing: 6) {
                Circle().fill(.primary.opacity(0.9)).frame(width: 4, height: 4)
                Circle().fill(.primary.opacity(0.9)).frame(width: 4, height: 4)
            }
        }
        .accessibilityHidden(true)
    }
}

