import Foundation

struct AgentCapability: Codable, Sendable {
    let uiAction: String
    let location: String
    let toolId: String
    let status: String
}

struct AgentCapabilityMap {
    static let initial: [AgentCapability] = [
        AgentCapability(
            uiAction: "Toggle Map/List",
            location: "souvenir/Views/ViewsOuracleToolbar.swift",
            toolId: "toggle_view_mode",
            status: "missing"
        ),
        AgentCapability(
            uiAction: "Start onboarding camera",
            location: "souvenir/ContentView.swift",
            toolId: "request_camera",
            status: "missing"
        ),
        AgentCapability(
            uiAction: "Navigate to Souvenir detail",
            location: "souvenir/Views/ViewsOuracleHybridView.swift",
            toolId: "navigate_souvenir",
            status: "missing"
        ),
        AgentCapability(
            uiAction: "Open Dev Tools",
            location: "souvenir/ContentView.swift",
            toolId: "open_dev_tools",
            status: "missing"
        )
    ]
}
