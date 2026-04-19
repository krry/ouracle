import Foundation

struct AgentContext: Codable, Sendable {
    let version: String
    let appSummary: String
    let nouns: [String: String]
    let recentActivity: [String]
    let currentRoute: String?
    let lastAction: String?
    let tools: [AgentToolDefinition]
}

struct AgentContextBuilder {
    func build() -> AgentContext {
        AgentContext(
            version: "1",
            appSummary: "Ouracle is a reflective AI companion. Clea holds space for the seeker's inner work.",
            nouns: [
                "Session": "A single conversation with Clea.",
                "Thread": "A named sequence of sessions.",
                "Record": "A distilled insight saved from a session."
            ],
            recentActivity: [],
            currentRoute: AgentRuntimeState.shared.currentRoute,
            lastAction: AgentRuntimeState.shared.lastAction,
            tools: AgentToolRegistry.shared.catalog()
        )
    }
}
