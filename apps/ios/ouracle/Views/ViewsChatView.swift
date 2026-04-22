import SwiftUI

struct ViewsChatView: View {
    @EnvironmentObject private var accent: TreasureAccent
    @ObservedObject var session: ChatSession
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool

    private var showDrawnCard: Binding<Bool> {
        Binding(
            get: { session.drawnCard != nil },
            set: { if !$0 { session.dismissCard() } }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            messageList
            Divider()
            inputBar
        }
        .overlay(alignment: .top) {
            if let err = session.lastError {
                Text(err)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.shen.opacity(0.85), in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { session.lastError = nil }
            }
        }
        .animation(.easeOut(duration: 0.2), value: session.lastError)
        .sheet(isPresented: showDrawnCard) {
            if let card = session.drawnCard {
                DrawnCardSheet(card: card, onDismiss: session.dismissCard)
            }
        }
    }

    // MARK: - Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if session.messages.isEmpty {
                        emptyState
                    }
                    ForEach(session.messages) { msg in
                        let isLast = msg.id == session.messages.last?.id
                        MessageRow(
                            message: msg,
                            showCursor: isLast && session.isStreaming && !msg.isFromSeeker
                        )
                        .id(msg.id)
                    }
                }
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .onChange(of: session.messages.count) { _, _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: session.messages.last?.text) { _, _ in
                if session.isStreaming { scrollToBottom(proxy: proxy) }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("ouracle")
                .font(.system(size: 36, weight: .heavy, design: .serif))
                .foregroundStyle(.primary)
            Text("what do you seek?")
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 80)
    }

    // MARK: - Input bar

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            Button {
                session.voiceEnabled.toggle()
            } label: {
                Image(systemName: session.voiceEnabled ? "waveform" : "mic")
                    .font(.body)
                    .foregroundStyle(session.voiceEnabled ? accent.color : Color.secondary)
                    .animation(.easeOut(duration: 0.2), value: session.voiceEnabled)
            }
            .buttonStyle(.plain)

            TextField("ask...", text: $inputText)
                .font(.body)
                .focused($isInputFocused)
                .submitLabel(.send)
                .onSubmit { sendIfReady() }

            Button(action: sendIfReady) {
                Text("ꜛ")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(canSend ? accent.color : Color.secondary)
            }
            .disabled(!canSend)
            .animation(.easeOut(duration: 0.15), value: canSend)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !session.isStreaming
    }

    private func sendIfReady() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !session.isStreaming else { return }
        inputText = ""
        session.send(text)
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        guard let lastID = session.messages.last?.id else { return }
        withAnimation(.easeOut(duration: 0.15)) {
            proxy.scrollTo(lastID, anchor: .bottom)
        }
    }
}

// MARK: - MessageRow

private struct MessageRow: View {
    let message: ChatMessage
    let showCursor: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(message.isFromSeeker ? "you" : "clea")
                .font(.system(.caption2, design: .monospaced).weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(1.5)

            Text(displayText)
                .font(.body)
                .foregroundStyle(.primary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
    }

    private var displayText: String {
        showCursor ? message.text + "▋" : message.text
    }
}

// MARK: - DrawnCardSheet (Clea-initiated draws)

private struct DrawnCardSheet: View {
    let card: OracleCard
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(.system(size: 24, weight: .heavy, design: .serif))
                        if !card.keywords.isEmpty {
                            Text(card.keywords.joined(separator: " · "))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .tracking(0.5)
                        }
                        if let label = card.deckLabel {
                            Text(label.lowercased())
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundStyle(.tertiary)
                        }
                    }

                    if !card.body.isEmpty {
                        Text(card.body)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            .navigationTitle("a card for you")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
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
    NavigationStack {
        ViewsChatView(session: ChatSession())
    }
}
