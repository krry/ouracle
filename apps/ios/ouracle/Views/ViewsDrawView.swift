import SwiftUI

struct ViewsDrawView: View {
    @EnvironmentObject private var accent: TreasureAccent
    @State private var decks: [OracleDeck] = []
    @State private var selectedDeckIDs: Set<String> = []
    @State private var drawnCard: OracleCard? = nil
    @State private var isDrawing = false
    @State private var isLoadingDecks = true
    @State private var sheetDetent: PresentationDetent = .height(96)

    private let smallDetent = PresentationDetent.height(96)

    var body: some View {
        cardArea
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .sheet(isPresented: .constant(true)) {
                deckSheet
                    .presentationDetents([smallDetent, .large], selection: $sheetDetent)
                    .presentationBackgroundInteraction(.enabled(upThrough: smallDetent))
                    .presentationDragIndicator(.visible)
                    .presentationCornerRadius(20)
                    .interactiveDismissDisabled()
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
                .padding(.bottom, 80)
            }
        } else {
            Button(action: drawCard) {
                VStack(spacing: 16) {
                    Text(isDrawing ? "·" : "✶")
                        .font(.system(size: 56))
                        .foregroundStyle(isDrawing ? Color.secondary : accent.color)
                    Text(isLoadingDecks ? "loading decks..." : isDrawing ? "drawing..." : "draw a card")
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .disabled(isDrawing || isLoadingDecks)
        }
    }

    // MARK: - Sheet

    private var deckSheet: some View {
        VStack(spacing: 0) {
            List {
                Section {
                    if isLoadingDecks {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    } else if decks.isEmpty {
                        Text("no decks available")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    } else {
                        ForEach(decks) { deck in
                            deckRow(deck)
                        }
                    }
                } header: {
                    HStack(spacing: 0) {
                        Text("decks")
                            .font(.system(.footnote, design: .monospaced).weight(.semibold))
                            .textCase(nil)
                        Spacer()
                        quickSelectButtons
                    }
                }
            }
            .listStyle(.plain)

            Divider()
            drawButton
        }
    }

    private func deckRow(_ deck: OracleDeck) -> some View {
        let selected = selectedDeckIDs.contains(deck.id)
        return Button {
            if selected { selectedDeckIDs.remove(deck.id) }
            else { selectedDeckIDs.insert(deck.id) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(deck.name)
                        .foregroundStyle(.primary)
                    Text("\(deck.cardCount) cards")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(accent.color)
                        .fontWeight(.semibold)
                }
            }
        }
        .foregroundStyle(.primary)
    }

    private var quickSelectButtons: some View {
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

    private func quickSelectButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(label, action: action)
            .font(.system(.caption, design: .monospaced))
            .foregroundStyle(.secondary)
            .buttonStyle(.plain)
    }

    private var drawButton: some View {
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
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
        }
        .disabled(isDrawing || isLoadingDecks)
        .foregroundStyle(isDrawing ? Color.secondary : accent.color)
    }

    // MARK: - Selection helpers

    private func selectAll()  { selectedDeckIDs = Set(decks.map(\.id)) }
    private func selectNone() { selectedDeckIDs = [] }

    private func selectOne() {
        guard !decks.isEmpty else { return }
        selectNone()
        selectedDeckIDs.insert(decks[Int.random(in: 0..<decks.count)].id)
    }

    private func selectSome() {
        guard !decks.isEmpty else { return }
        selectNone()
        var pool = decks
        for i in stride(from: pool.count - 1, through: 1, by: -1) {
            pool.swapAt(i, Int.random(in: 0...i))
        }
        pool.prefix(Int.random(in: 1...pool.count)).forEach {
            selectedDeckIDs.insert($0.id)
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
        .environmentObject(TreasureAccent())
}
