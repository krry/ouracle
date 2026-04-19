import Foundation

enum AgentToolBootstrapper {
    private static var hasBootstrapped = false

    static func bootstrap() {
        guard !hasBootstrapped else { return }
        hasBootstrapped = true

        // Ouracle-specific tools registered here when built
    }
}
