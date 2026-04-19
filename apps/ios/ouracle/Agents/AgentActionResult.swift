import Foundation

struct AgentActionResult: Codable, Sendable {
    let ok: Bool
    let message: String
    let data: [String: String]

    static func success(_ message: String, data: [String: String] = [:]) -> AgentActionResult {
        AgentActionResult(ok: true, message: message, data: data)
    }

    static func failure(_ message: String, data: [String: String] = [:]) -> AgentActionResult {
        AgentActionResult(ok: false, message: message, data: data)
    }
}
