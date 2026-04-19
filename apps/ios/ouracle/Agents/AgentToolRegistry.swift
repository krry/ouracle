import Foundation

final class AgentToolRegistry {
    static let shared = AgentToolRegistry()

    private var tools: [String: AgentTool] = [:]

    func register(_ tool: AgentTool) {
        tools[tool.id] = tool
    }

    func tool(id: String) -> AgentTool? {
        tools[id]
    }

    func catalog() -> [AgentToolDefinition] {
        tools.values
            .sorted { $0.id < $1.id }
            .map { AgentToolDefinition(id: $0.id, summary: $0.summary, inputSchema: $0.inputSchema) }
    }
}

struct AgentToolDefinition: Codable, Sendable {
    let id: String
    let summary: String
    let inputSchema: [String: String]
}
