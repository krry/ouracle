import Foundation

// MARK: - Models

struct OracleCard: Sendable, Identifiable {
    let id: String
    let deck: String
    let deckLabel: String?
    let title: String
    let keywords: [String]
    let body: String
    let imageURL: URL?
}

struct OracleDeck: Sendable, Identifiable {
    let id: String
    let name: String
    let description: String
    let cardCount: Int
}

// MARK: - Service

@MainActor
final class DeckService {
    static let shared = DeckService()
    private init() {}

    private let baseURL: String = {
        #if DEBUG
        ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"] ?? "https://api.ouracle.kerry.ink"
        #else
        "https://api.ouracle.kerry.ink"
        #endif
    }()

    func listDecks() async -> [OracleDeck] {
        guard let token = AuthService.shared.activeAccessToken,
              let url = URL(string: baseURL + "/decks") else { return [] }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let decoded = try? JSONDecoder().decode([DeckResponse].self, from: data) else { return [] }
        return decoded.map {
            OracleDeck(id: $0.id, name: $0.meta.name, description: $0.meta.description ?? "", cardCount: $0.count)
        }
    }

    func draw(n: Int = 1, deckIDs: [String]? = nil, context: String? = nil) async -> [OracleCard] {
        var components = URLComponents(string: baseURL + "/draw")!
        var items: [URLQueryItem] = [URLQueryItem(name: "n", value: "\(n)")]
        if let ids = deckIDs, !ids.isEmpty {
            items.append(URLQueryItem(name: "decks", value: ids.joined(separator: ",")))
        }
        if let ctx = context {
            items.append(URLQueryItem(name: "context", value: ctx))
        }
        components.queryItems = items
        guard let url = components.url else { return [] }
        var req = URLRequest(url: url)
        if let token = AuthService.shared.activeAccessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                let body = String(data: data, encoding: .utf8) ?? "(unreadable)"
                print("[DeckService] draw HTTP \(http.statusCode): \(body)")
                return []
            }
            return (try JSONDecoder().decode(DrawResponse.self, from: data)).cards.map(cardFromResponse)
        } catch {
            print("[DeckService] draw error: \(error)")
            return []
        }
    }

    func card(from json: [String: Any]) -> OracleCard? {
        guard let id    = json["id"]    as? String,
              let deck  = json["deck"]  as? String,
              let title = json["title"] as? String else { return nil }
        let keywords = json["keywords"] as? [String] ?? []
        let body     = json["body"]     as? String ?? ""
        let label    = json["deckLabel"] as? String
        let imageStr = json["imageUrl"] as? String
        let imageURL = imageStr.flatMap { URL(string: $0) }
        return OracleCard(id: id, deck: deck, deckLabel: label, title: title, keywords: keywords, body: body, imageURL: imageURL)
    }

    private func cardFromResponse(_ r: CardResponse) -> OracleCard {
        OracleCard(
            id: r.id,
            deck: r.deck,
            deckLabel: nil,
            title: r.title,
            keywords: r.keywords ?? [],
            body: r.body ?? "",
            imageURL: r.imageUrl.flatMap { URL(string: $0) }
        )
    }

    // MARK: - Response types

    private struct DeckResponse: Decodable {
        let id: String
        let meta: Meta
        let count: Int
        struct Meta: Decodable {
            let name: String
            let description: String?
        }
    }

    private struct DrawResponse: Decodable {
        let cards: [CardResponse]
    }

    private struct CardResponse: Decodable {
        let id: String
        let deck: String
        let title: String
        let keywords: [String]?
        let body: String?
        let imageUrl: String?
    }
}
