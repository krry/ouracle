import Foundation
import Combine

@MainActor
final class AgentRuntimeState: ObservableObject {
    static let shared = AgentRuntimeState()

    @Published private(set) var currentRoute: String?
    @Published private(set) var lastAction: String?

    func setCurrentRoute(_ route: Route?) {
        currentRoute = route.map(Self.describe)
    }

    func recordAction(_ action: String) {
        lastAction = action
    }

    private static func describe(_ route: Route) -> String {
        switch route {
        case .chat:          return "chat"
        case .thread(let id): return "thread:\(id.uuidString)"
        case .records:       return "records"
        case .record(let id): return "record:\(id.uuidString)"
        case .settings:      return "settings"
        case .devTools:      return "dev_tools"
        }
    }
}
