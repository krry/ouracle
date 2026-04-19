import Foundation

enum Config {
    static let apiBaseURL: String = {
        #if DEBUG
        let env = ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let env, !env.isEmpty { return env }
        #endif
        return "https://api.ouracle.kerry.ink"
    }()
}
