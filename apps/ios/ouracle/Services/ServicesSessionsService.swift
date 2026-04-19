import Foundation

struct SessionRecord: Identifiable, Sendable {
    let id: String
    let stage: String
    let quality: String?
    let riteName: String?
    let enacted: Bool
    let createdAt: Date
    let completedAt: Date?
}

@MainActor
final class SessionsService {
    static let shared = SessionsService()
    private init() {}

    private let baseURL: String = {
        #if DEBUG
        ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"] ?? "https://api.ouracle.kerry.ink"
        #else
        "https://api.ouracle.kerry.ink"
        #endif
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    func fetchThread() async -> [SessionRecord] {
        guard let seekerID = AuthService.shared.seekerID,
              let token = AuthService.shared.activeAccessToken,
              let url = URL(string: baseURL + "/seeker/\(seekerID)/thread") else { return [] }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let decoded = try? JSONDecoder().decode(ThreadResponse.self, from: data) else { return [] }
        return decoded.thread.compactMap { row in
            guard let created = Self.iso.date(from: row.created_at) else { return nil }
            return SessionRecord(
                id: row.id,
                stage: row.stage,
                quality: row.quality,
                riteName: row.rite_name,
                enacted: row.enacted ?? false,
                createdAt: created,
                completedAt: row.completed_at.flatMap { Self.iso.date(from: $0) }
            )
        }
    }

    private struct ThreadResponse: Decodable {
        let thread: [Row]
        struct Row: Decodable {
            let id: String
            let stage: String
            let quality: String?
            let rite_name: String?
            let enacted: Bool?
            let created_at: String
            let completed_at: String?
        }
    }
}
