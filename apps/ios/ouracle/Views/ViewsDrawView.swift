import SwiftUI

struct ViewsDrawView: View {
    @EnvironmentObject private var accent: TreasureAccent
    @State private var decks: [OracleDeck] = []
    @State private var selectedDeckIDs: Set<String> = []
    @State private var drawnCard: OracleCard? = nil
    @State private var isDrawing = false
    @State private var isLoadingDecks = true
    @State private var panelExpanded = false

    var body: some View {
        cardArea
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                deckPanel
            }
            .task { await loadDecks() }
    }

    // MARK: - Helpers

    private func titleCase(_ s: String) -> String {
        s.replacingOccurrences(of: "_", with: " ")
         .capitalized
    }

    private var deckSummary: String {
        if selectedDeckIDs.isEmpty { return "from all decks" }
        let names = decks
            .filter { selectedDeckIDs.contains($0.id) }
            .map { titleCase($0.name) }
        return "from \(names.joined(separator: " · "))"
    }

    private var cardShareText: String? {
        guard let card = drawnCard else { return nil }
        var parts = [card.title]
        if !card.keywords.isEmpty {
            parts.append(card.keywords.joined(separator: " · "))
        }
        if !card.body.isEmpty {
            parts += ["", card.body]
        }
        return parts.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Card area

    @ViewBuilder
    private var cardArea: some View {
        if let card = drawnCard {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let url = card.imageURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFit()
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            case .failure:
                                EmptyView()
                            default:
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.secondary.opacity(0.12))
                                    .frame(height: 240)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(.system(size: 26, weight: .heavy, design: .serif))
                        if !card.keywords.isEmpty {
                            Text(card.keywords.joined(separator: " · "))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .tracking(0.5)
                        }
                        Text(titleCase(card.deckLabel ?? card.deck))
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    if !card.body.isEmpty {
                        Text(card.body)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let link = card.cardLink {
                        Link("read more ↗", destination: link)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
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

    // MARK: - Deck panel

    private var deckPanel: some View {
        VStack(spacing: 0) {
            // Handle sits ABOVE the material — tap or drag to toggle
            Capsule()
                .fill(Color.secondary.opacity(0.4))
                .frame(width: 36, height: 4)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        panelExpanded.toggle()
                    }
                }
                .gesture(
                    DragGesture(minimumDistance: 10)
                        .onEnded { value in
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                panelExpanded = value.translation.height < 0
                            }
                        }
                )

            // Panel material — rounded top corners, anchors to screen bottom
            VStack(spacing: 0) {
                if panelExpanded {
                    deckListHeader
                    Divider()
                    deckListScroll
                    Divider()
                }
                panelFooter
            }
            .background {
                UnevenRoundedRectangle(
                    topLeadingRadius: 16, bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0, topTrailingRadius: 16
                )
                .fill(.regularMaterial)
                .ignoresSafeArea(edges: .bottom)
            }
            .shadow(color: .black.opacity(0.07), radius: 6, y: -2)
        }
    }

    // MARK: - Deck list (header fixed, rows scrollable)

    private var deckListHeader: some View {
        HStack(spacing: 0) {
            Text("decks")
                .font(.system(.footnote, design: .monospaced).weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer()
            quickSelectButtons
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var deckListScroll: some View {
        ScrollView {
            VStack(spacing: 0) {
                if isLoadingDecks {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else if decks.isEmpty {
                    Text("no decks available")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    ForEach(decks) { deck in
                        deckRow(deck)
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .frame(maxHeight: 280)
    }

    private func deckRow(_ deck: OracleDeck) -> some View {
        let selected = selectedDeckIDs.contains(deck.id)
        return Button {
            if selected { selectedDeckIDs.remove(deck.id) }
            else { selectedDeckIDs.insert(deck.id) }
        } label: {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(titleCase(deck.name))
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
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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

    private var panelFooter: some View {
        HStack(spacing: 0) {
            Button(action: drawCard) {
                VStack(spacing: 3) {
                    HStack(spacing: 8) {
                        if isDrawing {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("✶")
                        }
                        Text(isDrawing ? "drawing..." : "draw")
                            .font(.system(.body, design: .monospaced).weight(.semibold))
                    }
                    Text(deckSummary)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 14)
            }
            .disabled(isDrawing || isLoadingDecks)
            .foregroundStyle(isDrawing ? Color.secondary : accent.color)

            if let shareText = cardShareText {
                Divider().frame(height: 24)
                ShareLink(
                    item: shareText,
                    preview: SharePreview(
                        drawnCard?.title ?? "Ouracle",
                        image: Image(uiImage: UIImage(named: "AppIcon") ?? UIImage())
                    )
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 20)
                        .padding(.top, 20)
                        .padding(.bottom, 14)
                }
            }
        }
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
