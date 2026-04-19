import SwiftUI

struct ViewsDrawView: View {
    @State private var decks: [OracleDeck] = []
    @State private var selectedDeckIDs: Set<String> = []
    @State private var drawnCard: OracleCard? = nil
    @State private var isDrawing = false
    @State private var isLoadingDecks = true
    @State private var deckPickerOpen = false

    var body: some View {
        VStack(spacing: 0) {
            cardArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Divider()
            deckMenu
            drawBar
        }
        .task { await loadDecks() }
    }

    // MARK: - Card area

    @ViewBuilder
    private var cardArea: some View {
        if let card = drawnCard {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(.system(size: 26, weight: .heavy, design: .serif))
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
        } else {
            VStack(spacing: 16) {
                Text("✶")
                    .font(.system(size: 56))
                    .foregroundStyle(.secondary)
                Text(isLoadingDecks ? "loading decks..." : "draw a card")
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Deck menu

    private var deckMenu: some View {
        VStack(spacing: 0) {
            // Header row: "decks" toggle + all · some · one · none
            HStack(spacing: 0) {
                Button {
                    withAnimation(.easeOut(duration: 0.18)) {
                        deckPickerOpen.toggle()
                    }
                } label: {
                    HStack(spacing: 5) {
                        Text("decks")
                            .font(.system(.caption, design: .monospaced).weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(deckPickerOpen ? "▴" : "▾")
                            .font(.system(size: 8))
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                HStack(spacing: 0) {
                    quickSelectButton("all")  { selectAll() }
                    Text("·").foregroundStyle(.tertiary).font(.caption).padding(.horizontal, 6)
                    quickSelectButton("some") { selectSome() }
                    Text("·").foregroundStyle(.tertiary).font(.caption).padding(.horizontal, 6)
                    quickSelectButton("one")  { selectOne() }
                    Text("·").foregroundStyle(.tertiary).font(.caption).padding(.horizontal, 6)
                    quickSelectButton("none") { selectNone() }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, deckPickerOpen ? 10 : 12)

            // Expandable deck list
            if deckPickerOpen {
                if isLoadingDecks {
                    ProgressView().controlSize(.small).padding(.bottom, 10)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(decks) { deck in
                                deckChip(deck)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 12)
                    }
                }
            }
        }
        .background(.ultraThinMaterial)
    }

    private func quickSelectButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(label, action: action)
            .font(.system(.caption, design: .monospaced))
            .foregroundStyle(.secondary)
            .buttonStyle(.plain)
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
            .background(selected ? Color.jing.opacity(0.15) : Color.clear)
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

    // MARK: - Draw bar

    private var drawBar: some View {
        Button(action: drawCard) {
            HStack(spacing: 8) {
                if isDrawing {
                    ProgressView().controlSize(.small)
                } else {
                    Text("✶")
                }
                Text(isDrawing ? "drawing..." : "draw")
                    .font(.system(.body, design: .monospaced).weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
        .disabled(isDrawing || isLoadingDecks)
        .foregroundStyle(isDrawing ? Color.secondary : Color.jing)
        .background(.ultraThinMaterial)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    // MARK: - Selection helpers (ported from OraclePanel.svelte)

    private func selectAll() {
        selectedDeckIDs = Set(decks.map(\.id))
    }

    private func selectNone() {
        selectedDeckIDs = []
    }

    private func selectOne() {
        guard !decks.isEmpty else { return }
        selectNone()
        let chosen = decks[Int.random(in: 0..<decks.count)]
        selectedDeckIDs.insert(chosen.id)
    }

    private func selectSome() {
        guard !decks.isEmpty else { return }
        selectNone()
        // Fisher-Yates shuffle, pick random 1…n decks
        var pool = decks
        for i in stride(from: pool.count - 1, through: 1, by: -1) {
            let j = Int.random(in: 0...i)
            pool.swapAt(i, j)
        }
        let count = Int.random(in: 1...pool.count)
        for deck in pool.prefix(count) {
            selectedDeckIDs.insert(deck.id)
        }
    }

    // MARK: - Actions

    private func loadDecks() async {
        isLoadingDecks = true
        decks = await DeckService.shared.listDecks()
        isLoadingDecks = false
    }

    private func drawCard() {
        isDrawing = true
        // empty selection = draw from all (pass nil)
        let deckIDs = selectedDeckIDs.isEmpty ? nil : Array(selectedDeckIDs)
        Task {
            defer { isDrawing = false }
            let cards = await DeckService.shared.draw(n: 1, deckIDs: deckIDs)
            drawnCard = cards.first
        }
    }
}

#Preview {
    ViewsDrawView()
}
