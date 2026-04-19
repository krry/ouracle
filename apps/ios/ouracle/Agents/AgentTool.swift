import Foundation

typealias AgentToolInput = [String: String]

protocol AgentTool {
    var id: String { get }
    var summary: String { get }
    var inputSchema: [String: String] { get }
    func run(_ input: AgentToolInput) async throws -> AgentActionResult
}
