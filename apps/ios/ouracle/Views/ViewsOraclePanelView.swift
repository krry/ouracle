import SwiftUI

struct ViewsOraclePanelView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var decks: [OracleDeck] = []
    @State private var selectedDeckIDs: Set<String> = []
    @State private var drawnCard: OracleCard? = nil
    @State private var isDrawing = false
    @State private var isLoadingDecks = true

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                deckPicker
                Divider()
                cardArea
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Divider()
                drawBar
            }
            .navigationTitle("oracle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("done") { dismiss() }
                        .font(.system(.body, design: .monospaced))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task { await loadDecks() }
    }

    // MARK: - Deck picker

    private var deckPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if isLoadingDecks {
                    ProgressView().controlSize(.small)
                } else {
                    ForEach(decks) { deck in
                        deckChip(deck)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    private func deckChip(_ deck: OracleDeck) -> some View {
        let selected = selectedDeckIDs.contains(deck.id)
        return Button {
            if selected { selectedDeckIDs.remove(deck.id) }
            else { selectedDeckIDs.insert(deck.id) }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(deck.name)
                    .font(.system(.caption, design: .monospaced).weight(.semibold))
                Text("\(deck.cardCount)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                selected ? Color.jing.opacity(0.15) : Color.clear
            )
            .foregroundStyle(selected ? Color.jing : Color.secondary)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(
                        selected ? Color.jing.opacity(0.5) : Color.secondary.opacity(0.2),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Card area

    @ViewBuilder
    private var cardArea: some View {
        if let card = drawnCard {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(.system(size: 22, weight: .heavy, design: .serif))
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
                .padding(20)
            }
        } else {
            VStack(spacing: 16) {
                Image(systemName: "sparkles")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text(isLoadingDecks ? "loading decks..." : "draw a card")
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Draw bar

    private var drawBar: some View {
        Button(action: drawCard) {
            HStack(spacing: 8) {
                if isDrawing {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "sparkles")
                }
                Text(isDrawing ? "drawing..." : "draw")
                    .font(.system(.body, design: .monospaced).weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .disabled(isDrawing || isLoadingDecks)
        .foregroundStyle(isDrawing ? Color.secondary : Color.jing)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Actions

    private func loadDecks() async {
        isLoadingDecks = true
        decks = await DeckService.shared.listDecks()
        isLoadingDecks = false
    }

    private func drawCard() {
        isDrawing = true
        let deckIDs = selectedDeckIDs.isEmpty ? nil : Array(selectedDeckIDs)
        Task {
            defer { isDrawing = false }
            let cards = await DeckService.shared.draw(n: 1, deckIDs: deckIDs)
            drawnCard = cards.first
        }
    }
}

#Preview {
    ViewsOraclePanelView()
}
